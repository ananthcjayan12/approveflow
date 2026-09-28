import { AwsClient } from 'aws4fetch';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  SESSION_SECRET: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME: string;
  MAX_SINGLE_UPLOAD_BYTES: string;
  MAX_VIDEO_BYTES: string;
  DEFAULT_STORAGE_QUOTA_BYTES: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RAZORPAY_PLAN_SOLO?: string;
  RAZORPAY_PLAN_FREELANCER?: string;
  RAZORPAY_PLAN_AGENCY?: string;
};

type SessionInfo = { userId: string; workspaceId: string };
type ReviewInfo = {
  link_id: string;
  approval_request_id: string;
  workspace_id: string;
  project_id: string;
  reviewer_name: string | null;
  reviewer_email: string | null;
  status: string;
  project_name: string;
  company_name: string;
};

const app = new Hono<{ Bindings: Env }>();
const enc = new TextEncoder();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
const now = () => new Date().toISOString();
const addHours = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function passwordHash(password: string, saltB64?: string) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120_000 }, key, 256);
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  const saltOut = btoa(String.fromCharCode(...salt));
  return { hash, salt: saltOut };
}

async function getSession(c: any): Promise<SessionInfo | null> {
  const token = getCookie(c, 'approveflow_session');
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await c.env.DB.prepare(`
    SELECT s.user_id AS userId, w.id AS workspaceId
    FROM sessions s JOIN workspaces w ON w.owner_user_id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(tokenHash).first();
  return (row as SessionInfo | null) || null;
}

async function requireSession(c: any): Promise<SessionInfo | Response> {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Authentication required' }, 401);
  return session;
}

async function createSession(c: any, userId: string) {
  const token = randomToken(32);
  await c.env.DB.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)')
    .bind(id('ses'), userId, await sha256(token), addHours(24 * 30)).run();
  setCookie(c, 'approveflow_session', token, {
    httpOnly: true,
    secure: !c.env.APP_ORIGIN.includes('localhost'),
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
}

async function audit(env: Env, workspaceId: string, eventType: string, data: Record<string, unknown> = {}) {
  await env.DB.prepare('INSERT INTO activity_events (id,workspace_id,project_id,asset_id,approval_request_id,event_type,actor_name,metadata_json) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id('evt'), workspaceId, data.projectId || null, data.assetId || null, data.approvalRequestId || null, eventType, data.actorName || null, JSON.stringify(data)).run();
}

async function sendEmail(env: Env, to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY || !to) return { skipped: true };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html })
  });
  if (!response.ok) throw new Error(`Email failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function s3Client(env: Env) {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) throw new Error('R2 S3 credentials are not configured');
  return new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
}

function s3Url(env: Env, key: string, query = '') {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(env.R2_BUCKET_NAME)}/${encodedKey}${query}`;
}

function safeFilename(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-140) || 'upload.bin';
}

async function workspaceForUpload(c: any): Promise<string | null> {
  const session = await getSession(c);
  if (session) return session.workspaceId;
  if (c.env.APP_ORIGIN.includes('localhost')) return 'ws_demo';
  return null;
}

async function checkQuota(env: Env, workspaceId: string, size: number) {
  const row = (await env.DB.prepare('SELECT storage_used_bytes AS used, storage_quota_bytes AS quota FROM workspaces WHERE id=?').bind(workspaceId).first()) as {used:number;quota:number} | null;
  if (!row) throw new Error('Workspace not found');
  if (row.used + size > row.quota) throw new Error('Storage quota exceeded');
}

app.get('/health', (c) => c.json({ service: 'approveflow-worker', ok: true, time: now() }));

// ---- Authentication -------------------------------------------------------
const authBody = z.object({ name: z.string().min(1).max(100).optional(), email: z.string().email(), password: z.string().min(8).max(200) });

app.post('/api/auth/signup', async (c) => {
  const body = authBody.parse(await c.req.json());
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE lower(email)=lower(?)').bind(body.email).first();
  if (existing) return c.json({ error: 'Email already registered' }, 409);
  const userId = id('usr'); const workspaceId = id('ws'); const pwd = await passwordHash(body.password);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id,name,email,password_hash,password_salt,email_verified_at) VALUES (?,?,?,?,?,?)').bind(userId, body.name || body.email.split('@')[0], body.email.toLowerCase(), pwd.hash, pwd.salt, now()),
    c.env.DB.prepare('INSERT INTO workspaces (id,owner_user_id,name,reply_to_email,storage_quota_bytes) VALUES (?,?,?,?,?)').bind(workspaceId, userId, `${body.name || 'My'} Workspace`, body.email.toLowerCase(), Number(c.env.DEFAULT_STORAGE_QUOTA_BYTES || 1073741824))
  ]);
  await createSession(c, userId);
  return c.json({ userId, workspaceId }, 201);
});

app.post('/api/auth/login', async (c) => {
  const body = authBody.pick({ email: true, password: true }).parse(await c.req.json());
  const user = (await c.env.DB.prepare('SELECT id,password_hash,password_salt,name,email FROM users WHERE lower(email)=lower(?)').bind(body.email).first()) as {id:string;password_hash:string;password_salt:string;name:string;email:string} | null;
  if (!user) return c.json({ error: 'Invalid email or password' }, 401);
  const pwd = await passwordHash(body.password, user.password_salt);
  if (pwd.hash !== user.password_hash) return c.json({ error: 'Invalid email or password' }, 401);
  await createSession(c, user.id);
  return c.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, 'approveflow_session');
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
  deleteCookie(c, 'approveflow_session', { path: '/' });
  return c.json({ ok: true });
});

app.get('/api/auth/me', async (c) => {
  const session = await requireSession(c); if (session instanceof Response) return session;
  const row = await c.env.DB.prepare(`SELECT u.id,u.name,u.email,w.id AS workspace_id,w.name AS workspace_name,w.plan_key,w.storage_used_bytes,w.storage_quota_bytes FROM users u JOIN workspaces w ON w.owner_user_id=u.id WHERE u.id=?`).bind(session.userId).first();
  return c.json(row);
});

// ---- Core CRUD ------------------------------------------------------------
app.get('/api/clients', async (c) => {
  const session = await requireSession(c); if (session instanceof Response) return session;
  const rows = await c.env.DB.prepare('SELECT * FROM clients WHERE workspace_id=? AND archived_at IS NULL ORDER BY created_at DESC').bind(session.workspaceId).all();
  return c.json(rows.results);
});

app.post('/api/clients', async (c) => {
  const session = await requireSession(c); if (session instanceof Response) return session;
  const body = z.object({ companyName:z.string().min(1), contactName:z.string().optional(), email:z.string().email().optional(), notes:z.string().optional() }).parse(await c.req.json());
  const clientId = id('cl');
  await c.env.DB.prepare('INSERT INTO clients (id,workspace_id,company_name,contact_name,email,notes) VALUES (?,?,?,?,?,?)').bind(clientId,session.workspaceId,body.companyName,body.contactName||null,body.email||null,body.notes||null).run();
  await audit(c.env, session.workspaceId, 'client.created', { clientId, actorName: 'Owner' });
  return c.json({ id: clientId }, 201);
});

app.get('/api/projects', async (c) => {
  const session = await requireSession(c); if (session instanceof Response) return session;
  const rows = await c.env.DB.prepare(`SELECT p.*,c.company_name FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.workspace_id=? AND p.archived_at IS NULL ORDER BY p.created_at DESC`).bind(session.workspaceId).all();
  return c.json(rows.results);
});

app.post('/api/projects', async (c) => {
  const session = await requireSession(c); if (session instanceof Response) return session;
  const body = z.object({ clientId:z.string(), name:z.string().min(1), description:z.string().optional(), dueAt:z.string().optional() }).parse(await c.req.json());
  const projectId=id('prj');
  await c.env.DB.prepare('INSERT INTO projects (id,workspace_id,client_id,name,description,due_at,status) VALUES (?,?,?,?,?,?,?)').bind(projectId,session.workspaceId,body.clientId,body.name,body.description||null,body.dueAt||null,'draft').run();
  await audit(c.env,session.workspaceId,'project.created',{projectId,actorName:'Owner'});
  return c.json({id:projectId},201);
});

app.post('/api/assets/finalize-upload', async (c) => {
  const session = await requireSession(c); if (session instanceof Response) return session;
  const body = z.object({ projectId:z.string(), assetId:z.string().optional(), name:z.string().min(1), kind:z.enum(['image','video','carousel','pdf']), r2Key:z.string(), mimeType:z.string(), size:z.number().int().nonnegative(), durationMs:z.number().int().optional(), caption:z.string().optional() }).parse(await c.req.json());
  await checkQuota(c.env, session.workspaceId, body.size);
  const assetId=body.assetId||id('ast');
  const existing=(await c.env.DB.prepare('SELECT latest_version_no FROM assets WHERE id=? AND workspace_id=?').bind(assetId,session.workspaceId).first()) as {latest_version_no:number} | null;
  const version=(existing?.latest_version_no||0)+1; const versionId=id('ver');
  const statements=[] as D1PreparedStatement[];
  if(!existing) statements.push(c.env.DB.prepare('INSERT INTO assets (id,workspace_id,project_id,name,kind,caption,status,latest_version_no) VALUES (?,?,?,?,?,?,?,?)').bind(assetId,session.workspaceId,body.projectId,body.name,body.kind,body.caption||null,'draft',version));
  else statements.push(c.env.DB.prepare('UPDATE assets SET latest_version_no=?,status=? WHERE id=? AND workspace_id=?').bind(version,'revised',assetId,session.workspaceId));
  statements.push(c.env.DB.prepare('INSERT INTO asset_versions (id,asset_id,version_no,r2_key,mime_type,size_bytes,duration_ms) VALUES (?,?,?,?,?,?,?)').bind(versionId,assetId,version,body.r2Key,body.mimeType,body.size,body.durationMs||null));
  statements.push(c.env.DB.prepare('UPDATE workspaces SET storage_used_bytes=storage_used_bytes+? WHERE id=?').bind(body.size,session.workspaceId));
  await c.env.DB.batch(statements);
  await audit(c.env,session.workspaceId,'asset.version_uploaded',{projectId:body.projectId,assetId,version,bytes:body.size,actorName:'Owner'});
  return c.json({assetId,versionId,version},201);
});

// ---- Approval requests / secure client links -----------------------------
app.post('/api/approvals', async (c) => {
  const session = await requireSession(c); if (session instanceof Response) return session;
  const body=z.object({projectId:z.string(),assetIds:z.array(z.string()).min(1),reviewerName:z.string().optional(),reviewerEmail:z.string().email(),message:z.string().optional(),dueAt:z.string().optional(),reminders:z.boolean().default(true)}).parse(await c.req.json());
  const requestId=id('apr'); const linkId=id('lnk'); const token=randomToken(32); const tokenHash=await sha256(token);
  const nextReminder=body.reminders?addHours(24):null;
  const statements:D1PreparedStatement[]=[c.env.DB.prepare('INSERT INTO approval_requests (id,workspace_id,project_id,reviewer_name,reviewer_email,message,requested_by,reminder_enabled,next_reminder_at,due_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(requestId,session.workspaceId,body.projectId,body.reviewerName||null,body.reviewerEmail,body.message||null,session.userId,body.reminders?1:0,nextReminder,body.dueAt||null,'waiting'),c.env.DB.prepare('INSERT INTO review_links (id,approval_request_id,token_hash) VALUES (?,?,?)').bind(linkId,requestId,tokenHash)];
  for(const assetId of body.assetIds) statements.push(c.env.DB.prepare('INSERT INTO approval_request_assets (approval_request_id,asset_id) VALUES (?,?)').bind(requestId,assetId));
  await c.env.DB.batch(statements);
  const reviewUrl=`${c.env.APP_ORIGIN.replace(/\/$/,'')}/review/${token}`;
  await sendEmail(c.env,body.reviewerEmail,'Content ready for your review',`<p>${body.message||'Your content is ready for review.'}</p><p><a href="${reviewUrl}">Review content</a></p>`);
  await audit(c.env,session.workspaceId,'approval.sent',{projectId:body.projectId,approvalRequestId:requestId,reviewerEmail:body.reviewerEmail,actorName:'Owner'});
  return c.json({id:requestId,reviewUrl},201);
});

async function resolveReview(env:Env,token:string){
  const tokenHash=await sha256(token);
  return env.DB.prepare(`SELECT rl.id AS link_id,rl.approval_request_id,ar.workspace_id,ar.project_id,ar.reviewer_name,ar.reviewer_email,ar.status,p.name AS project_name,c.company_name FROM review_links rl JOIN approval_requests ar ON ar.id=rl.approval_request_id JOIN projects p ON p.id=ar.project_id JOIN clients c ON c.id=p.client_id WHERE rl.token_hash=? AND rl.revoked_at IS NULL AND (rl.expires_at IS NULL OR rl.expires_at>datetime('now')) LIMIT 1`).bind(tokenHash).first<ReviewInfo>();
}

app.get('/api/review/:token', async (c)=>{
  const review=await resolveReview(c.env,c.req.param('token')); if(!review) return c.json({error:'Review link is invalid or expired'},404);
  const assets=await c.env.DB.prepare(`SELECT a.*,v.id AS version_id,v.version_no,v.r2_key,v.mime_type,v.size_bytes,v.duration_ms FROM approval_request_assets ara JOIN assets a ON a.id=ara.asset_id LEFT JOIN asset_versions v ON v.asset_id=a.id AND v.version_no=a.latest_version_no WHERE ara.approval_request_id=? ORDER BY a.created_at`).bind(review.approval_request_id).all();
  return c.json({...review,assets:assets.results});
});

app.post('/api/review/:token/comments', async (c)=>{
  const review=await resolveReview(c.env,c.req.param('token')); if(!review) return c.json({error:'Invalid review link'},404);
  const body=z.object({assetId:z.string(),assetVersionId:z.string().optional(),body:z.string().min(1),annotation:z.object({kind:z.enum(['point','rectangle','drawing','video_timestamp','video_range','pdf_point','slide_point']),x:z.number().min(0).max(1).optional(),y:z.number().min(0).max(1).optional(),width:z.number().min(0).max(1).optional(),height:z.number().min(0).max(1).optional(),timestampMs:z.number().int().nonnegative().optional(),startMs:z.number().int().nonnegative().optional(),endMs:z.number().int().nonnegative().optional(),slideNo:z.number().int().positive().optional(),pageNo:z.number().int().positive().optional()}).optional()}).parse(await c.req.json());
  const commentId=id('com'); const statements:D1PreparedStatement[]=[c.env.DB.prepare('INSERT INTO comments (id,approval_request_id,asset_id,asset_version_id,author_type,author_name,body) VALUES (?,?,?,?,?,?,?)').bind(commentId,review.approval_request_id,body.assetId,body.assetVersionId||null,'reviewer',review.reviewer_name||review.reviewer_email,body.body)];
  if(body.annotation){const a=body.annotation; statements.push(c.env.DB.prepare('INSERT INTO annotations (id,comment_id,kind,page_no,slide_no,x,y,width,height,timestamp_ms,start_ms,end_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id('ann'),commentId,a.kind,a.pageNo||null,a.slideNo||null,a.x??null,a.y??null,a.width??null,a.height??null,a.timestampMs??null,a.startMs??null,a.endMs??null));}
  await c.env.DB.batch(statements); await audit(c.env,review.workspace_id,'review.comment',{projectId:review.project_id,assetId:body.assetId,approvalRequestId:review.approval_request_id,actorName:review.reviewer_name||review.reviewer_email});
  return c.json({id:commentId},201);
});

app.post('/api/review/:token/decision', async (c)=>{
  const review=await resolveReview(c.env,c.req.param('token')); if(!review) return c.json({error:'Invalid review link'},404);
  const body=z.object({assetId:z.string(),assetVersionId:z.string().optional(),decision:z.enum(['approved','changes_requested'])}).parse(await c.req.json());
  await c.env.DB.batch([c.env.DB.prepare('INSERT INTO approval_decisions (id,approval_request_id,asset_id,asset_version_id,decision,reviewer_name,reviewer_email,user_agent) VALUES (?,?,?,?,?,?,?,?)').bind(id('dec'),review.approval_request_id,body.assetId,body.assetVersionId||null,body.decision,review.reviewer_name||null,review.reviewer_email||null,c.req.header('user-agent')||null),c.env.DB.prepare('UPDATE assets SET status=? WHERE id=?').bind(body.decision==='approved'?'approved':'changes_requested',body.assetId)]);
  await audit(c.env,review.workspace_id,`asset.${body.decision}`,{projectId:review.project_id,assetId:body.assetId,approvalRequestId:review.approval_request_id,actorName:review.reviewer_name||review.reviewer_email});
  return c.json({ok:true});
});

// ---- Private R2 uploads: direct browser -> R2 ----------------------------
app.post('/api/uploads/single/presign', async (c)=>{
  const workspaceId=await workspaceForUpload(c); if(!workspaceId) return c.json({error:'Authentication required'},401);
  const body=z.object({filename:z.string().min(1),contentType:z.string().min(1),size:z.number().int().positive()}).parse(await c.req.json());
  if(body.size>Number(c.env.MAX_SINGLE_UPLOAD_BYTES||104857600)) return c.json({error:'Use multipart upload for this file size'},413);
  await checkQuota(c.env,workspaceId,body.size);
  const key=`workspaces/${workspaceId}/uploads/${Date.now()}-${crypto.randomUUID()}-${safeFilename(body.filename)}`;
  const aws=s3Client(c.env);
  const signed=await aws.sign(s3Url(c.env,key),{method:'PUT',headers:{'content-type':body.contentType},aws:{signQuery:true}} as any) as Request;
  return c.json({key,url:signed.url});
});

app.post('/api/uploads/multipart/create', async (c)=>{
  const workspaceId=await workspaceForUpload(c); if(!workspaceId) return c.json({error:'Authentication required'},401);
  const body=z.object({filename:z.string().min(1),contentType:z.string().min(1),size:z.number().int().positive()}).parse(await c.req.json());
  if(body.contentType.startsWith('video/')&&body.size>Number(c.env.MAX_VIDEO_BYTES||5368709120)) return c.json({error:'Video exceeds the current per-file limit'},413);
  await checkQuota(c.env,workspaceId,body.size);
  const key=`workspaces/${workspaceId}/uploads/${Date.now()}-${crypto.randomUUID()}-${safeFilename(body.filename)}`;
  const aws=s3Client(c.env); const response=await aws.fetch(s3Url(c.env,key,'?uploads'),{method:'POST',headers:{'content-type':body.contentType}} as any);
  if(!response.ok) return c.json({error:`R2 multipart create failed: ${response.status}`,detail:await response.text()},502);
  const xml=await response.text(); const uploadId=xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1]; if(!uploadId) return c.json({error:'R2 did not return an upload ID'},502);
  return c.json({key,uploadId,partSize:64*1024*1024});
});

app.post('/api/uploads/multipart/part-url', async (c)=>{
  const workspaceId=await workspaceForUpload(c); if(!workspaceId) return c.json({error:'Authentication required'},401);
  const body=z.object({key:z.string(),uploadId:z.string(),partNumber:z.number().int().min(1).max(10000)}).parse(await c.req.json());
  if(!body.key.startsWith(`workspaces/${workspaceId}/`)) return c.json({error:'Invalid upload key'},403);
  const query=`?partNumber=${body.partNumber}&uploadId=${encodeURIComponent(body.uploadId)}`; const signed=await s3Client(c.env).sign(s3Url(c.env,body.key,query),{method:'PUT',aws:{signQuery:true}} as any) as Request;
  return c.json({url:signed.url});
});

app.post('/api/uploads/multipart/complete', async (c)=>{
  const workspaceId=await workspaceForUpload(c); if(!workspaceId) return c.json({error:'Authentication required'},401);
  const body=z.object({key:z.string(),uploadId:z.string(),parts:z.array(z.object({partNumber:z.number().int(),etag:z.string()})).min(1)}).parse(await c.req.json());
  if(!body.key.startsWith(`workspaces/${workspaceId}/`)) return c.json({error:'Invalid upload key'},403);
  const xml=`<CompleteMultipartUpload>${body.parts.sort((a,b)=>a.partNumber-b.partNumber).map(p=>`<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag.replaceAll('&','&amp;').replaceAll('<','&lt;')}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
  const response=await s3Client(c.env).fetch(s3Url(c.env,body.key,`?uploadId=${encodeURIComponent(body.uploadId)}`),{method:'POST',headers:{'content-type':'application/xml'},body:xml} as any);
  if(!response.ok) return c.json({error:`R2 multipart completion failed: ${response.status}`,detail:await response.text()},502);
  return c.json({ok:true,key:body.key});
});

app.post('/api/media/presign-get', async (c)=>{
  const session=await requireSession(c); if(session instanceof Response) return session;
  const body=z.object({key:z.string()}).parse(await c.req.json()); if(!body.key.startsWith(`workspaces/${session.workspaceId}/`)) return c.json({error:'Forbidden'},403);
  const signed=await s3Client(c.env).sign(s3Url(c.env,body.key),{method:'GET',aws:{signQuery:true}} as any) as Request;
  return c.json({url:signed.url});
});

// ---- Razorpay subscriptions ---------------------------------------------
app.post('/api/billing/subscription', async (c)=>{
  const session=await requireSession(c); if(session instanceof Response) return session;
  const body=z.object({plan:z.enum(['solo','freelancer','agency'])}).parse(await c.req.json());
  if(!c.env.RAZORPAY_KEY_ID||!c.env.RAZORPAY_KEY_SECRET) return c.json({error:'Razorpay is not configured'},503);
  const planId={solo:c.env.RAZORPAY_PLAN_SOLO,freelancer:c.env.RAZORPAY_PLAN_FREELANCER,agency:c.env.RAZORPAY_PLAN_AGENCY}[body.plan]; if(!planId) return c.json({error:'Razorpay plan ID is missing'},503);
  const response=await fetch('https://api.razorpay.com/v1/subscriptions',{method:'POST',headers:{authorization:`Basic ${btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)}`,'content-type':'application/json'},body:JSON.stringify({plan_id:planId,total_count:120,quantity:1,customer_notify:1,notes:{workspace_id:session.workspaceId,plan_key:body.plan}})});
  const data:any=await response.json(); if(!response.ok) return c.json({error:'Razorpay subscription creation failed',detail:data},502);
  await c.env.DB.prepare(`INSERT INTO subscriptions (id,workspace_id,razorpay_subscription_id,plan_key,status) VALUES (?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET razorpay_subscription_id=excluded.razorpay_subscription_id,plan_key=excluded.plan_key,status=excluded.status,updated_at=datetime('now')`).bind(id('sub'),session.workspaceId,data.id,body.plan,data.status||'created').run();
  return c.json({id:data.id,shortUrl:data.short_url,status:data.status});
});

async function hmacHex(secret:string,payload:string){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=await crypto.subtle.sign('HMAC',key,enc.encode(payload));return [...new Uint8Array(signature)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function timingSafeEqualHex(a:string,b:string){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0}

app.post('/api/webhooks/razorpay', async (c)=>{
  if(!c.env.RAZORPAY_WEBHOOK_SECRET) return c.json({error:'Webhook secret is not configured'},503);
  const raw=await c.req.text(); const supplied=c.req.header('x-razorpay-signature')||''; const expected=await hmacHex(c.env.RAZORPAY_WEBHOOK_SECRET,raw); if(!timingSafeEqualHex(supplied,expected)) return c.json({error:'Invalid signature'},401);
  const payload:any=JSON.parse(raw); const subscription=payload?.payload?.subscription?.entity; const eventId=c.req.header('x-razorpay-event-id')||`${payload.event}:${subscription?.id||await sha256(raw).then(x=>x.slice(0,24))}`; const payloadHash=await sha256(raw);
  const exists=await c.env.DB.prepare('SELECT id FROM payment_events WHERE event_id=?').bind(eventId).first(); if(exists) return c.json({ok:true,duplicate:true});
  await c.env.DB.prepare('INSERT INTO payment_events (id,event_id,event_type,payload_hash) VALUES (?,?,?,?)').bind(id('payevt'),eventId,payload.event||'unknown',payloadHash).run();
  if(subscription?.id){const workspaceId=subscription.notes?.workspace_id; const planKey=subscription.notes?.plan_key; if(workspaceId){await c.env.DB.prepare(`INSERT INTO subscriptions (id,workspace_id,razorpay_subscription_id,plan_key,status,current_period_start,current_period_end) VALUES (?,?,?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET razorpay_subscription_id=excluded.razorpay_subscription_id,plan_key=COALESCE(excluded.plan_key,subscriptions.plan_key),status=excluded.status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=datetime('now')`).bind(id('sub'),workspaceId,subscription.id,planKey||'unknown',subscription.status||payload.event,subscription.current_start?new Date(subscription.current_start*1000).toISOString():null,subscription.current_end?new Date(subscription.current_end*1000).toISOString():null).run(); const quota={solo:10,freelancer:50,agency:150}[planKey as 'solo'|'freelancer'|'agency']; if(quota&&['active','authenticated'].includes(subscription.status)) await c.env.DB.prepare('UPDATE workspaces SET plan_key=?,storage_quota_bytes=? WHERE id=?').bind(planKey,quota*1024*1024*1024,workspaceId).run();}}
  return c.json({ok:true});
});

// ---- Reminder cron --------------------------------------------------------
async function runReminders(env:Env){
  const rows=await env.DB.prepare(`SELECT ar.id,ar.workspace_id,ar.project_id,ar.reviewer_email,ar.reviewer_name,ar.reminder_count,p.name AS project_name FROM approval_requests ar JOIN projects p ON p.id=ar.project_id WHERE ar.status='waiting' AND ar.reminder_enabled=1 AND ar.next_reminder_at IS NOT NULL AND ar.next_reminder_at<=datetime('now') ORDER BY ar.next_reminder_at LIMIT 100`).all<any>();
  for(const row of rows.results){try{await sendEmail(env,row.reviewer_email,`Reminder: ${row.project_name} is waiting for review`,`<p>Hi ${row.reviewer_name||'there'},</p><p>${row.project_name} is still waiting for your review.</p>`); const nextCount=Number(row.reminder_count||0)+1; const next=nextCount===1?addHours(48):nextCount===2?addHours(96):null; await env.DB.prepare('UPDATE approval_requests SET reminder_count=?,next_reminder_at=? WHERE id=?').bind(nextCount,next,row.id).run(); await audit(env,row.workspace_id,'reminder.sent',{projectId:row.project_id,approvalRequestId:row.id,actorName:'System',reminderCount:nextCount});}catch(e){console.error('Reminder failed',row.id,e)}}
}

app.notFound((c)=>c.json({error:'Not found'},404));
app.onError((err,c)=>{console.error(err); if(err instanceof z.ZodError) return c.json({error:'Invalid request',issues:err.issues},400); return c.json({error:err instanceof Error?err.message:'Internal error'},500)});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(runReminders(env)); }
};
