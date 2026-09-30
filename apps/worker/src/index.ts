import { AwsClient } from "aws4fetch";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";

type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
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
  message: string | null;
  due_at: string | null;
  project_name: string;
  company_name: string;
  workspace_name: string;
  brand_color: string | null;
};

const app = new Hono<{ Bindings: Env }>();
const enc = new TextEncoder();
const id = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const now = () => new Date().toISOString();
const addHours = (hours: number) =>
  new Date(Date.now() + hours * 3600_000).toISOString();

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function passwordHash(password: string, saltB64?: string) {
  const salt = saltB64
    ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    key,
    256,
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  const saltOut = btoa(String.fromCharCode(...salt));
  return { hash, salt: saltOut };
}

async function getSession(c: any): Promise<SessionInfo | null> {
  const token = getCookie(c, "approveflow_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await c.env.DB.prepare(
    `
    SELECT s.user_id AS userId, w.id AS workspaceId
    FROM sessions s JOIN workspaces w ON w.owner_user_id = s.user_id
    WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
    LIMIT 1
  `,
  )
    .bind(tokenHash)
    .first();
  return (row as SessionInfo | null) || null;
}

async function requireSession(c: any): Promise<SessionInfo | Response> {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Authentication required" }, 401);
  return session;
}

async function createSession(c: any, userId: string) {
  const token = randomToken(32);
  await c.env.DB.prepare(
    "INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)",
  )
    .bind(id("ses"), userId, await sha256(token), addHours(24 * 30))
    .run();
  setCookie(c, "approveflow_session", token, {
    httpOnly: true,
    secure: !c.env.APP_ORIGIN.includes("localhost"),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function audit(
  env: Env,
  workspaceId: string,
  eventType: string,
  data: Record<string, unknown> = {},
) {
  await env.DB.prepare(
    "INSERT INTO activity_events (id,workspace_id,project_id,asset_id,approval_request_id,event_type,actor_name,metadata_json) VALUES (?,?,?,?,?,?,?,?)",
  )
    .bind(
      id("evt"),
      workspaceId,
      data.projectId || null,
      data.assetId || null,
      data.approvalRequestId || null,
      eventType,
      data.actorName || null,
      JSON.stringify(data),
    )
    .run();
}

async function sendEmail(env: Env, to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY || !to) return { skipped: true };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
  });
  if (!response.ok)
    throw new Error(
      `Email failed: ${response.status} ${await response.text()}`,
    );
  return response.json();
}

function s3Client(env: Env) {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY)
    throw new Error("R2 S3 credentials are not configured");
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

function s3Url(env: Env, key: string, query = "") {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(env.R2_BUCKET_NAME)}/${encodedKey}${query}`;
}

function safeFilename(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-140) || "upload.bin"
  );
}

async function workspaceForUpload(c: any): Promise<string | null> {
  const session = await getSession(c);
  if (session) return session.workspaceId;
  return null;
}

// ---- Review markup ---------------------------------------------------------
// Every coordinate is normalised to 0..1 of the media frame so markup lines up
// at any screen size. Shapes are validated strictly and stored as JSON on the
// annotation row; x/y/width/height hold the markup's bounding box.
const unit = z.number().min(0).max(1);
const point = z.tuple([unit, unit]);
const markStyle = {
  c: z.string().regex(/^#[0-9a-f]{6}$/i),
  s: z.number().min(1).max(40),
};
const shapeSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("pin"), p: point, ...markStyle }),
  z.object({ t: z.literal("rect"), a: point, b: point, ...markStyle }),
  z.object({ t: z.literal("ellipse"), a: point, b: point, ...markStyle }),
  z.object({ t: z.literal("arrow"), a: point, b: point, ...markStyle }),
  z.object({
    t: z.literal("pen"),
    pts: z.array(point).min(2).max(600),
    ...markStyle,
  }),
  z.object({
    t: z.literal("highlight"),
    pts: z.array(point).min(2).max(600),
    ...markStyle,
  }),
]);
const annotationSchema = z.object({
  kind: z.enum([
    "point",
    "rectangle",
    "drawing",
    "video_timestamp",
    "video_range",
    "pdf_point",
    "slide_point",
  ]),
  x: unit.optional(),
  y: unit.optional(),
  width: unit.optional(),
  height: unit.optional(),
  timestampMs: z.number().int().nonnegative().optional(),
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().nonnegative().optional(),
  slideNo: z.number().int().positive().optional(),
  pageNo: z.number().int().positive().optional(),
  shapes: z.array(shapeSchema).min(1).max(40).optional(),
});
type AnnotationInput = z.infer<typeof annotationSchema>;
const MAX_MARKUP_JSON_CHARS = 64_000;

function shapePoints(shape: z.infer<typeof shapeSchema>): [number, number][] {
  if (shape.t === "pin") return [shape.p];
  if (shape.t === "pen" || shape.t === "highlight") return shape.pts;
  return [shape.a, shape.b];
}

/** Returns a user-facing problem with the annotation, or null when it is fine. */
function annotationProblem(a: AnnotationInput | undefined): string | null {
  if (!a) return null;
  if (a.kind === "video_range" && (a.endMs ?? 0) <= (a.startMs ?? 0))
    return "Invalid video range";
  if (a.kind === "video_timestamp" && a.timestampMs === undefined)
    return "A video comment needs a timestamp";
  if (a.shapes && JSON.stringify(a.shapes).length > MAX_MARKUP_JSON_CHARS)
    return "That drawing is too detailed. Try fewer marks.";
  return null;
}

function annotationStatement(
  env: Env,
  commentId: string,
  a: AnnotationInput,
): D1PreparedStatement {
  // Always keep a bounding box, even if a client only sent shapes.
  let { x, y, width, height } = a;
  if (a.shapes && (x === undefined || y === undefined)) {
    const pts = a.shapes.flatMap(shapePoints);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    x = Math.min(...xs);
    y = Math.min(...ys);
    width = Math.max(...xs) - x;
    height = Math.max(...ys) - y;
  }
  return env.DB.prepare(
    "INSERT INTO annotations (id,comment_id,kind,page_no,slide_no,x,y,width,height,timestamp_ms,start_ms,end_ms,shape_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).bind(
    id("ann"),
    commentId,
    a.kind,
    a.pageNo || null,
    a.slideNo || null,
    x ?? null,
    y ?? null,
    width ?? null,
    height ?? null,
    a.timestampMs ?? null,
    a.startMs ?? null,
    a.endMs ?? null,
    a.shapes ? JSON.stringify({ v: 1, shapes: a.shapes }) : null,
  );
}

const COMMENT_COLUMNS =
  "c.*,an.kind,an.x,an.y,an.width,an.height,an.timestamp_ms,an.start_ms,an.end_ms,an.shape_json";

async function checkQuota(env: Env, workspaceId: string, size: number) {
  const row = (await env.DB.prepare(
    "SELECT storage_used_bytes AS used, storage_quota_bytes AS quota FROM workspaces WHERE id=?",
  )
    .bind(workspaceId)
    .first()) as { used: number; quota: number } | null;
  if (!row) throw new Error("Workspace not found");
  if (row.used + size > row.quota) throw new Error("Storage quota exceeded");
}

app.get("/health", async (c) => {
  await c.env.DB.prepare("SELECT id FROM workspaces LIMIT 1").first();
  return c.json({ service: "approveflow-worker", ok: true, time: now() });
});
app.use("/api/*", async (c, next) => {
  const origin = c.req.header("origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
    origin &&
    origin !== new URL(c.req.url).origin &&
    origin !== c.env.APP_ORIGIN &&
    !(
      new URL(c.req.url).hostname === "localhost" &&
      origin === "http://localhost:5173"
    )
  )
    return c.json({ error: "Origin not allowed" }, 403);
  await next();
  c.header("Cache-Control", "no-store");
});

// ---- Authentication -------------------------------------------------------
const authBody = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

app.post("/api/auth/signup", async (c) => {
  const body = authBody.parse(await c.req.json());
  const existing = await c.env.DB.prepare(
    "SELECT id FROM users WHERE lower(email)=lower(?)",
  )
    .bind(body.email)
    .first();
  if (existing) return c.json({ error: "Email already registered" }, 409);
  const userId = id("usr");
  const workspaceId = id("ws");
  const pwd = await passwordHash(body.password);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO users (id,name,email,password_hash,password_salt,email_verified_at) VALUES (?,?,?,?,?,?)",
    ).bind(
      userId,
      body.name || body.email.split("@")[0],
      body.email.toLowerCase(),
      pwd.hash,
      pwd.salt,
      null,
    ),
    c.env.DB.prepare(
      "INSERT INTO workspaces (id,owner_user_id,name,reply_to_email,storage_quota_bytes,brand_color) VALUES (?,?,?,?,?,?)",
    ).bind(
      workspaceId,
      userId,
      `${body.name || "My"} Workspace`,
      body.email.toLowerCase(),
      Number(c.env.DEFAULT_STORAGE_QUOTA_BYTES || 1073741824),
      "#5b5bd6",
    ),
  ]);
  await createSession(c, userId);
  return c.json({ userId, workspaceId }, 201);
});

app.post("/api/auth/login", async (c) => {
  const body = authBody
    .pick({ email: true, password: true })
    .parse(await c.req.json());
  const user = (await c.env.DB.prepare(
    "SELECT id,password_hash,password_salt,name,email FROM users WHERE lower(email)=lower(?)",
  )
    .bind(body.email)
    .first()) as {
    id: string;
    password_hash: string;
    password_salt: string;
    name: string;
    email: string;
  } | null;
  if (!user) return c.json({ error: "Invalid email or password" }, 401);
  const pwd = await passwordHash(body.password, user.password_salt);
  if (pwd.hash !== user.password_hash)
    return c.json({ error: "Invalid email or password" }, 401);
  await createSession(c, user.id);
  return c.json({ id: user.id, name: user.name, email: user.email });
});

app.post("/api/auth/logout", async (c) => {
  const token = getCookie(c, "approveflow_session");
  if (token)
    await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
      .bind(await sha256(token))
      .run();
  deleteCookie(c, "approveflow_session", { path: "/" });
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const row = await c.env.DB.prepare(
    `SELECT u.id,u.name,u.email,w.id AS workspace_id,w.name AS workspace_name,w.plan_key,w.storage_used_bytes,w.storage_quota_bytes FROM users u JOIN workspaces w ON w.owner_user_id=u.id WHERE u.id=?`,
  )
    .bind(session.userId)
    .first();
  return c.json(row);
});

// ---- Core CRUD ------------------------------------------------------------
app.get("/api/clients", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const rows = await c.env.DB.prepare(
    "SELECT * FROM clients WHERE workspace_id=? AND archived_at IS NULL ORDER BY created_at DESC",
  )
    .bind(session.workspaceId)
    .all();
  return c.json(rows.results);
});

app.post("/api/clients", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z
    .object({
      companyName: z.string().min(1),
      contactName: z.string().optional(),
      email: z.string().email().optional(),
      notes: z.string().optional(),
    })
    .parse(await c.req.json());
  const clientId = id("cl");
  await c.env.DB.prepare(
    "INSERT INTO clients (id,workspace_id,company_name,contact_name,email,notes) VALUES (?,?,?,?,?,?)",
  )
    .bind(
      clientId,
      session.workspaceId,
      body.companyName,
      body.contactName || null,
      body.email || null,
      body.notes || null,
    )
    .run();
  await audit(c.env, session.workspaceId, "client.created", {
    clientId,
    actorName: "Owner",
  });
  return c.json({ id: clientId }, 201);
});

app.get("/api/projects", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const rows = await c.env.DB.prepare(
    `SELECT p.*,c.company_name FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.workspace_id=? AND p.archived_at IS NULL ORDER BY p.created_at DESC`,
  )
    .bind(session.workspaceId)
    .all();
  return c.json(rows.results);
});

app.post("/api/projects", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z
    .object({
      clientId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      dueAt: z.string().optional(),
    })
    .parse(await c.req.json());
  if (
    !(await c.env.DB.prepare(
      "SELECT id FROM clients WHERE id=? AND workspace_id=? AND archived_at IS NULL",
    )
      .bind(body.clientId, session.workspaceId)
      .first())
  )
    return c.json({ error: "Client not found" }, 404);
  const projectId = id("prj");
  await c.env.DB.prepare(
    "INSERT INTO projects (id,workspace_id,client_id,name,description,due_at,status) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      projectId,
      session.workspaceId,
      body.clientId,
      body.name,
      body.description || null,
      body.dueAt || null,
      "draft",
    )
    .run();
  await audit(c.env, session.workspaceId, "project.created", {
    projectId,
    actorName: "Owner",
  });
  return c.json({ id: projectId }, 201);
});

app.post("/api/assets/finalize-upload", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z
    .object({
      projectId: z.string(),
      assetId: z.string().optional(),
      name: z.string().min(1),
      kind: z.enum(["image", "video", "carousel", "pdf"]),
      r2Key: z.string(),
      mimeType: z.string(),
      size: z.number().int().nonnegative(),
      durationMs: z.number().int().optional(),
      caption: z.string().optional(),
    })
    .parse(await c.req.json());
  if (
    !(await c.env.DB.prepare(
      "SELECT id FROM projects WHERE id=? AND workspace_id=?",
    )
      .bind(body.projectId, session.workspaceId)
      .first())
  )
    return c.json({ error: "Project not found" }, 404);
  if (!body.r2Key.startsWith(`workspaces/${session.workspaceId}/`))
    return c.json({ error: "Invalid upload key" }, 403);
  const object = await c.env.MEDIA.head(body.r2Key);
  if (!object || object.size !== body.size)
    return c.json({ error: "Upload is missing or incomplete" }, 400);
  if (
    await c.env.DB.prepare("SELECT id FROM asset_versions WHERE r2_key=?")
      .bind(body.r2Key)
      .first()
  )
    return c.json({ error: "Upload already finalized" }, 409);
  if (
    body.assetId &&
    !(await c.env.DB.prepare(
      "SELECT id FROM assets WHERE id=? AND project_id=? AND workspace_id=?",
    )
      .bind(body.assetId, body.projectId, session.workspaceId)
      .first())
  )
    return c.json({ error: "Asset not found" }, 404);
  await checkQuota(c.env, session.workspaceId, body.size);
  const assetId = body.assetId || id("ast");
  const existing = (await c.env.DB.prepare(
    "SELECT latest_version_no FROM assets WHERE id=? AND workspace_id=?",
  )
    .bind(assetId, session.workspaceId)
    .first()) as { latest_version_no: number } | null;
  const version = (existing?.latest_version_no || 0) + 1;
  const versionId = id("ver");
  const statements = [] as D1PreparedStatement[];
  if (!existing)
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO assets (id,workspace_id,project_id,name,kind,caption,status,latest_version_no) VALUES (?,?,?,?,?,?,?,?)",
      ).bind(
        assetId,
        session.workspaceId,
        body.projectId,
        body.name,
        body.kind,
        body.caption || null,
        "draft",
        version,
      ),
    );
  else
    statements.push(
      c.env.DB.prepare(
        "UPDATE assets SET latest_version_no=?,status=?,kind=?,caption=? WHERE id=? AND workspace_id=?",
      ).bind(
        version,
        "revised",
        body.kind,
        body.caption || null,
        assetId,
        session.workspaceId,
      ),
    );
  statements.push(
    c.env.DB.prepare(
      "INSERT INTO asset_versions (id,asset_id,version_no,r2_key,mime_type,size_bytes,duration_ms) VALUES (?,?,?,?,?,?,?)",
    ).bind(
      versionId,
      assetId,
      version,
      body.r2Key,
      body.mimeType,
      body.size,
      body.durationMs || null,
    ),
  );

  if (existing)
    statements.push(
      c.env.DB.prepare(
        "UPDATE approval_requests SET status='waiting',completed_at=NULL WHERE id IN (SELECT approval_request_id FROM approval_request_assets WHERE asset_id=?)",
      ).bind(assetId),
    );
  await c.env.DB.batch(statements);
  await audit(c.env, session.workspaceId, "asset.version_uploaded", {
    projectId: body.projectId,
    assetId,
    version,
    bytes: body.size,
    actorName: "Owner",
  });
  return c.json({ assetId, versionId, version }, 201);
});

// ---- Approval requests / secure client links -----------------------------
app.post("/api/approvals", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z
    .object({
      projectId: z.string(),
      assetIds: z.array(z.string()).min(1),
      reviewerName: z.string().optional(),
      reviewerEmail: z.string().email(),
      message: z.string().optional(),
      dueAt: z.string().optional(),
      reminders: z.boolean().default(false),
      sendEmail: z.boolean().default(false),
    })
    .parse(await c.req.json());
  if (
    !(await c.env.DB.prepare(
      "SELECT id FROM projects WHERE id=? AND workspace_id=?",
    )
      .bind(body.projectId, session.workspaceId)
      .first())
  )
    return c.json({ error: "Project not found" }, 404);
  body.assetIds = [...new Set(body.assetIds)];
  for (const assetId of body.assetIds) {
    if (
      !(await c.env.DB.prepare(
        "SELECT id FROM assets WHERE id=? AND project_id=? AND workspace_id=? AND latest_version_no>0",
      )
        .bind(assetId, body.projectId, session.workspaceId)
        .first())
    )
      return c.json({ error: "Asset does not belong to this project" }, 400);
  }
  const requestId = id("apr");
  const linkId = id("lnk");
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const nextReminder = body.reminders ? addHours(24) : null;
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      "INSERT INTO approval_requests (id,workspace_id,project_id,reviewer_name,reviewer_email,message,requested_by,reminder_enabled,next_reminder_at,due_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      requestId,
      session.workspaceId,
      body.projectId,
      body.reviewerName || null,
      body.reviewerEmail,
      body.message || null,
      session.userId,
      body.reminders ? 1 : 0,
      nextReminder,
      body.dueAt || null,
      "waiting",
    ),
    c.env.DB.prepare(
      "INSERT INTO review_links (id,approval_request_id,token_hash) VALUES (?,?,?)",
    ).bind(linkId, requestId, tokenHash),
  ];
  for (const assetId of body.assetIds)
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO approval_request_assets (approval_request_id,asset_id) VALUES (?,?)",
      ).bind(requestId, assetId),
    );
  for (const assetId of body.assetIds)
    statements.push(
      c.env.DB.prepare("UPDATE assets SET status='waiting' WHERE id=?").bind(
        assetId,
      ),
    );
  await c.env.DB.batch(statements);
  const reviewUrl = `${c.env.APP_ORIGIN.replace(/\/$/, "")}/review/${token}`;
  let emailStatus = "not_requested";
  if (body.sendEmail) {
    try {
      const result = (await sendEmail(
        c.env,
        body.reviewerEmail,
        "Content ready for your review",
        `<p>${escapeHtml(body.message || "Your content is ready for review.")}</p><p><a href="${reviewUrl}">Review content</a></p>`,
      )) as any;
      emailStatus = result.skipped ? "not_configured" : "sent";
    } catch {
      emailStatus = "failed";
    }
  }
  await audit(c.env, session.workspaceId, "approval.sent", {
    projectId: body.projectId,
    approvalRequestId: requestId,
    reviewerEmail: body.reviewerEmail,
    actorName: "Owner",
  });
  return c.json({ id: requestId, reviewUrl, emailStatus }, 201);
});

async function resolveReview(env: Env, token: string) {
  const tokenHash = await sha256(token);
  return env.DB.prepare(
    `SELECT rl.id AS link_id,rl.approval_request_id,ar.workspace_id,ar.project_id,ar.reviewer_name,ar.reviewer_email,ar.status,ar.message,ar.due_at,p.name AS project_name,c.company_name,w.name AS workspace_name,w.brand_color FROM review_links rl JOIN approval_requests ar ON ar.id=rl.approval_request_id JOIN projects p ON p.id=ar.project_id JOIN clients c ON c.id=p.client_id JOIN workspaces w ON w.id=ar.workspace_id WHERE rl.token_hash=? AND rl.revoked_at IS NULL AND (rl.expires_at IS NULL OR datetime(rl.expires_at)>datetime('now')) LIMIT 1`,
  )
    .bind(tokenHash)
    .first<ReviewInfo>();
}

app.get("/api/review/:token", async (c) => {
  const review = await resolveReview(c.env, c.req.param("token"));
  if (!review)
    return c.json({ error: "Review link is invalid or expired" }, 404);
  const assets = await c.env.DB.prepare(
    `SELECT a.*,v.id AS version_id,v.version_no,v.r2_key,v.mime_type,v.size_bytes,v.duration_ms FROM approval_request_assets ara JOIN assets a ON a.id=ara.asset_id LEFT JOIN asset_versions v ON v.asset_id=a.id AND v.version_no=a.latest_version_no WHERE ara.approval_request_id=? ORDER BY a.created_at,a.rowid`,
  )
    .bind(review.approval_request_id)
    .all();
  const comments = await c.env.DB.prepare(
    `SELECT ${COMMENT_COLUMNS} FROM comments c LEFT JOIN annotations an ON an.comment_id=c.id WHERE c.approval_request_id=? ORDER BY c.created_at,c.rowid`,
  )
    .bind(review.approval_request_id)
    .all();
  return c.json({
    ...review,
    assets: assets.results,
    comments: comments.results,
  });
});

app.post("/api/review/:token/comments", async (c) => {
  const review = await resolveReview(c.env, c.req.param("token"));
  if (!review) return c.json({ error: "Invalid review link" }, 404);
  const body = z
    .object({
      assetId: z.string(),
      assetVersionId: z.string().optional(),
      body: z.string().trim().min(1).max(10000),
      annotation: annotationSchema.optional(),
    })
    .parse(await c.req.json());
  const asset = await c.env.DB.prepare(
    `SELECT v.id AS version_id FROM approval_request_assets ara JOIN assets a ON a.id=ara.asset_id JOIN asset_versions v ON v.asset_id=a.id AND v.version_no=a.latest_version_no WHERE ara.approval_request_id=? AND a.id=?`,
  )
    .bind(review.approval_request_id, body.assetId)
    .first<{ version_id: string }>();
  if (!asset)
    return c.json({ error: "Asset not included in this review" }, 403);
  if (body.assetVersionId !== asset.version_id)
    return c.json(
      { error: "This creative has a new version. Reload before submitting." },
      409,
    );
  const problem = annotationProblem(body.annotation);
  if (problem) return c.json({ error: problem }, 400);
  const commentId = id("com");
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      "INSERT INTO comments (id,approval_request_id,asset_id,asset_version_id,author_type,author_name,body) VALUES (?,?,?,?,?,?,?)",
    ).bind(
      commentId,
      review.approval_request_id,
      body.assetId,
      body.assetVersionId || null,
      "reviewer",
      review.reviewer_name || review.reviewer_email,
      body.body,
    ),
  ];
  if (body.annotation)
    statements.push(annotationStatement(c.env, commentId, body.annotation));
  await c.env.DB.batch(statements);
  await audit(c.env, review.workspace_id, "review.comment", {
    projectId: review.project_id,
    assetId: body.assetId,
    approvalRequestId: review.approval_request_id,
    actorName: review.reviewer_name || review.reviewer_email,
  });
  return c.json({ id: commentId }, 201);
});

app.post("/api/review/:token/decision", async (c) => {
  const review = await resolveReview(c.env, c.req.param("token"));
  if (!review) return c.json({ error: "Invalid review link" }, 404);
  const body = z
    .object({
      assetId: z.string(),
      assetVersionId: z.string().optional(),
      decision: z.enum(["approved", "changes_requested"]),
    })
    .parse(await c.req.json());
  const asset = await c.env.DB.prepare(
    `SELECT v.id AS version_id FROM approval_request_assets ara JOIN assets a ON a.id=ara.asset_id JOIN asset_versions v ON v.asset_id=a.id AND v.version_no=a.latest_version_no WHERE ara.approval_request_id=? AND a.id=?`,
  )
    .bind(review.approval_request_id, body.assetId)
    .first<{ version_id: string }>();
  if (!asset)
    return c.json({ error: "Asset not included in this review" }, 403);
  if (body.assetVersionId !== asset.version_id)
    return c.json(
      { error: "This creative has a new version. Reload before submitting." },
      409,
    );
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO approval_decisions (id,approval_request_id,asset_id,asset_version_id,decision,reviewer_name,reviewer_email,user_agent) VALUES (?,?,?,?,?,?,?,?)",
    ).bind(
      id("dec"),
      review.approval_request_id,
      body.assetId,
      body.assetVersionId || null,
      body.decision,
      review.reviewer_name || null,
      review.reviewer_email || null,
      c.req.header("user-agent") || null,
    ),
    c.env.DB.prepare("UPDATE assets SET status=? WHERE id=?").bind(
      body.decision === "approved" ? "approved" : "changes_requested",
      body.assetId,
    ),
  ]);
  await c.env.DB.prepare(
    `UPDATE approval_requests SET status=CASE WHEN NOT EXISTS (SELECT 1 FROM approval_request_assets ara JOIN assets a ON a.id=ara.asset_id WHERE ara.approval_request_id=? AND a.status!='approved') THEN 'approved' ELSE 'waiting' END WHERE id=?`,
  )
    .bind(review.approval_request_id, review.approval_request_id)
    .run();
  await audit(c.env, review.workspace_id, `asset.${body.decision}`, {
    projectId: review.project_id,
    assetId: body.assetId,
    approvalRequestId: review.approval_request_id,
    actorName: review.reviewer_name || review.reviewer_email,
  });
  return c.json({ ok: true });
});

// ---- Private R2 uploads: direct browser -> R2 ----------------------------
app.post("/api/uploads/single/presign", async (c) => {
  const workspaceId = await workspaceForUpload(c);
  if (!workspaceId) return c.json({ error: "Authentication required" }, 401);
  const body = z
    .object({
      filename: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().int().positive(),
    })
    .parse(await c.req.json());
  if (body.size > Number(c.env.MAX_SINGLE_UPLOAD_BYTES || 104857600))
    return c.json({ error: "Use multipart upload for this file size" }, 413);
  await checkQuota(c.env, workspaceId, body.size);
  const key = `workspaces/${workspaceId}/uploads/${Date.now()}-${crypto.randomUUID()}-${safeFilename(body.filename)}`;
  if (new URL(c.req.url).hostname === "localhost" && !c.env.R2_ACCESS_KEY_ID)
    return c.json({
      key,
      url: `/api/uploads/local?key=${encodeURIComponent(key)}`,
    });
  const aws = s3Client(c.env);
  const signed = (await aws.sign(s3Url(c.env, key, "?X-Amz-Expires=3600"), {
    method: "PUT",
    headers: { "content-type": body.contentType },
    aws: { signQuery: true },
  } as any)) as Request;
  return c.json({ key, url: signed.url });
});

app.post("/api/uploads/multipart/create", async (c) => {
  const workspaceId = await workspaceForUpload(c);
  if (!workspaceId) return c.json({ error: "Authentication required" }, 401);
  const body = z
    .object({
      filename: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().int().positive(),
    })
    .parse(await c.req.json());
  if (
    body.contentType.startsWith("video/") &&
    body.size > Number(c.env.MAX_VIDEO_BYTES || 5368709120)
  )
    return c.json({ error: "Video exceeds the current per-file limit" }, 413);
  await checkQuota(c.env, workspaceId, body.size);
  const key = `workspaces/${workspaceId}/uploads/${Date.now()}-${crypto.randomUUID()}-${safeFilename(body.filename)}`;
  const aws = s3Client(c.env);
  const response = await aws.fetch(s3Url(c.env, key, "?uploads"), {
    method: "POST",
    headers: { "content-type": body.contentType },
  } as any);
  if (!response.ok)
    return c.json(
      {
        error: `R2 multipart create failed: ${response.status}`,
        detail: await response.text(),
      },
      502,
    );
  const xml = await response.text();
  const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!uploadId)
    return c.json({ error: "R2 did not return an upload ID" }, 502);
  return c.json({ key, uploadId, partSize: 64 * 1024 * 1024 });
});

app.post("/api/uploads/multipart/part-url", async (c) => {
  const workspaceId = await workspaceForUpload(c);
  if (!workspaceId) return c.json({ error: "Authentication required" }, 401);
  const body = z
    .object({
      key: z.string(),
      uploadId: z.string(),
      partNumber: z.number().int().min(1).max(10000),
    })
    .parse(await c.req.json());
  if (!body.key.startsWith(`workspaces/${workspaceId}/`))
    return c.json({ error: "Invalid upload key" }, 403);
  const query = `?X-Amz-Expires=3600&partNumber=${body.partNumber}&uploadId=${encodeURIComponent(body.uploadId)}`;
  const signed = (await s3Client(c.env).sign(s3Url(c.env, body.key, query), {
    method: "PUT",
    aws: { signQuery: true },
  } as any)) as Request;
  return c.json({ url: signed.url });
});

app.post("/api/uploads/multipart/complete", async (c) => {
  const workspaceId = await workspaceForUpload(c);
  if (!workspaceId) return c.json({ error: "Authentication required" }, 401);
  const body = z
    .object({
      key: z.string(),
      uploadId: z.string(),
      parts: z
        .array(z.object({ partNumber: z.number().int(), etag: z.string() }))
        .min(1),
    })
    .parse(await c.req.json());
  if (!body.key.startsWith(`workspaces/${workspaceId}/`))
    return c.json({ error: "Invalid upload key" }, 403);
  const xml = `<CompleteMultipartUpload>${body.parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(
      (p) =>
        `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</ETag></Part>`,
    )
    .join("")}</CompleteMultipartUpload>`;
  const response = await s3Client(c.env).fetch(
    s3Url(c.env, body.key, `?uploadId=${encodeURIComponent(body.uploadId)}`),
    {
      method: "POST",
      headers: { "content-type": "application/xml" },
      body: xml,
    } as any,
  );
  if (!response.ok)
    return c.json(
      {
        error: `R2 multipart completion failed: ${response.status}`,
        detail: await response.text(),
      },
      502,
    );
  return c.json({ ok: true, key: body.key });
});

app.post("/api/media/presign-get", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z.object({ key: z.string() }).parse(await c.req.json());
  if (!body.key.startsWith(`workspaces/${session.workspaceId}/`))
    return c.json({ error: "Forbidden" }, 403);
  const signed = (await s3Client(c.env).sign(
    s3Url(c.env, body.key, "?X-Amz-Expires=3600"),
    { method: "GET", aws: { signQuery: true } } as any,
  )) as Request;
  return c.json({ url: signed.url });
});

// ---- Razorpay subscriptions ---------------------------------------------
app.post("/api/billing/subscription", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z
    .object({ plan: z.enum(["solo", "freelancer", "agency"]) })
    .parse(await c.req.json());
  if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET)
    return c.json({ error: "Razorpay is not configured" }, 503);
  const planId = {
    solo: c.env.RAZORPAY_PLAN_SOLO,
    freelancer: c.env.RAZORPAY_PLAN_FREELANCER,
    agency: c.env.RAZORPAY_PLAN_AGENCY,
  }[body.plan];
  if (!planId) return c.json({ error: "Razorpay plan ID is missing" }, 503);
  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: { workspace_id: session.workspaceId, plan_key: body.plan },
    }),
  });
  const data: any = await response.json();
  if (!response.ok)
    return c.json(
      { error: "Razorpay subscription creation failed", detail: data },
      502,
    );
  await c.env.DB.prepare(
    `INSERT INTO subscriptions (id,workspace_id,razorpay_subscription_id,plan_key,status) VALUES (?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET razorpay_subscription_id=excluded.razorpay_subscription_id,plan_key=excluded.plan_key,status=excluded.status,updated_at=datetime('now')`,
  )
    .bind(
      id("sub"),
      session.workspaceId,
      data.id,
      body.plan,
      data.status || "created",
    )
    .run();
  return c.json({ id: data.id, shortUrl: data.short_url, status: data.status });
});

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

app.post("/api/webhooks/razorpay", async (c) => {
  if (!c.env.RAZORPAY_WEBHOOK_SECRET)
    return c.json({ error: "Webhook secret is not configured" }, 503);
  const raw = await c.req.text();
  const supplied = c.req.header("x-razorpay-signature") || "";
  const expected = await hmacHex(c.env.RAZORPAY_WEBHOOK_SECRET, raw);
  if (!timingSafeEqualHex(supplied, expected))
    return c.json({ error: "Invalid signature" }, 401);
  const payload: any = JSON.parse(raw);
  const subscription = payload?.payload?.subscription?.entity;
  const eventId =
    c.req.header("x-razorpay-event-id") ||
    `${payload.event}:${subscription?.id || (await sha256(raw).then((x) => x.slice(0, 24)))}`;
  const payloadHash = await sha256(raw);
  const exists = await c.env.DB.prepare(
    "SELECT id FROM payment_events WHERE event_id=?",
  )
    .bind(eventId)
    .first();
  if (exists) return c.json({ ok: true, duplicate: true });
  await c.env.DB.prepare(
    "INSERT INTO payment_events (id,event_id,event_type,payload_hash) VALUES (?,?,?,?)",
  )
    .bind(id("payevt"), eventId, payload.event || "unknown", payloadHash)
    .run();
  if (subscription?.id) {
    const workspaceId = subscription.notes?.workspace_id;
    const planKey = subscription.notes?.plan_key;
    if (workspaceId) {
      await c.env.DB.prepare(
        `INSERT INTO subscriptions (id,workspace_id,razorpay_subscription_id,plan_key,status,current_period_start,current_period_end) VALUES (?,?,?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET razorpay_subscription_id=excluded.razorpay_subscription_id,plan_key=COALESCE(excluded.plan_key,subscriptions.plan_key),status=excluded.status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=datetime('now')`,
      )
        .bind(
          id("sub"),
          workspaceId,
          subscription.id,
          planKey || "unknown",
          subscription.status || payload.event,
          subscription.current_start
            ? new Date(subscription.current_start * 1000).toISOString()
            : null,
          subscription.current_end
            ? new Date(subscription.current_end * 1000).toISOString()
            : null,
        )
        .run();
      const quota = { solo: 10, freelancer: 50, agency: 150 }[
        planKey as "solo" | "freelancer" | "agency"
      ];
      if (quota && ["active", "authenticated"].includes(subscription.status))
        await c.env.DB.prepare(
          "UPDATE workspaces SET plan_key=?,storage_quota_bytes=? WHERE id=?",
        )
          .bind(planKey, quota * 1024 * 1024 * 1024, workspaceId)
          .run();
    }
  }
  return c.json({ ok: true });
});

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

app.put("/api/uploads/local", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  if (new URL(c.req.url).hostname !== "localhost" || c.env.R2_ACCESS_KEY_ID)
    return c.json({ error: "Not found" }, 404);
  const key = c.req.query("key") || "";
  if (!key.startsWith(`workspaces/${session.workspaceId}/`))
    return c.json({ error: "Forbidden" }, 403);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength > Number(c.env.MAX_SINGLE_UPLOAD_BYTES))
    return c.json({ error: "File too large" }, 413);
  await checkQuota(c.env, session.workspaceId, bytes.byteLength);
  await c.env.MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: c.req.header("content-type") || "application/octet-stream",
    },
  });
  return c.json({ ok: true });
});

app.get("/api/workspace", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const workspace = await c.env.DB.prepare(
    "SELECT * FROM workspaces WHERE id=?",
  )
    .bind(session.workspaceId)
    .first();
  return c.json({
    ...workspace,
    emailEnabled: !!c.env.RESEND_API_KEY,
    billingEnabled: !!c.env.RAZORPAY_KEY_ID,
  });
});
app.patch("/api/workspace", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z
    .object({
      name: z.string().trim().min(1).max(100),
      replyToEmail: z.string().email(),
      timezone: z.string().min(1),
      brandColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    })
    .parse(await c.req.json());
  await c.env.DB.prepare(
    "UPDATE workspaces SET name=?,reply_to_email=?,timezone=?,brand_color=? WHERE id=?",
  )
    .bind(
      body.name,
      body.replyToEmail,
      body.timezone,
      body.brandColor,
      session.workspaceId,
    )
    .run();
  return c.json({ ok: true });
});
app.patch("/api/clients/:id", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z
    .object({
      companyName: z.string().trim().min(1),
      contactName: z.string(),
      email: z.string().email(),
      notes: z.string(),
    })
    .parse(await c.req.json());
  const result = await c.env.DB.prepare(
    "UPDATE clients SET company_name=?,contact_name=?,email=?,notes=? WHERE id=? AND workspace_id=?",
  )
    .bind(
      body.companyName,
      body.contactName,
      body.email,
      body.notes,
      c.req.param("id"),
      session.workspaceId,
    )
    .run();
  return result.meta.changes
    ? c.json({ ok: true })
    : c.json({ error: "Client not found" }, 404);
});
app.get("/api/assets", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const rows = await c.env.DB.prepare(
    `SELECT a.*,v.id AS version_id,v.size_bytes,v.mime_type FROM assets a JOIN asset_versions v ON v.asset_id=a.id AND v.version_no=a.latest_version_no WHERE a.workspace_id=? ORDER BY a.created_at DESC,a.rowid DESC`,
  )
    .bind(session.workspaceId)
    .all();
  return c.json(rows.results);
});
app.get("/api/assets/:id/comments", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const rows = await c.env.DB.prepare(
    `SELECT ${COMMENT_COLUMNS} FROM comments c JOIN assets a ON a.id=c.asset_id LEFT JOIN annotations an ON an.comment_id=c.id WHERE a.id=? AND a.workspace_id=? ORDER BY c.created_at,c.rowid`,
  )
    .bind(c.req.param("id"), session.workspaceId)
    .all();
  return c.json(rows.results);
});
app.post("/api/assets/:id/comments", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const body = z
    .object({
      body: z.string().trim().min(1).max(10000),
      annotation: annotationSchema.optional(),
    })
    .parse(await c.req.json());
  const problem = annotationProblem(body.annotation);
  if (problem) return c.json({ error: problem }, 400);
  const asset = await c.env.DB.prepare(
    `SELECT a.id,v.id AS version_id,ara.approval_request_id FROM assets a JOIN asset_versions v ON v.asset_id=a.id AND v.version_no=a.latest_version_no JOIN approval_request_assets ara ON ara.asset_id=a.id JOIN approval_requests ar ON ar.id=ara.approval_request_id WHERE a.id=? AND a.workspace_id=? ORDER BY ar.created_at DESC LIMIT 1`,
  )
    .bind(c.req.param("id"), session.workspaceId)
    .first<any>();
  if (!asset)
    return c.json(
      { error: "Send this asset for review before starting a discussion" },
      400,
    );
  // Sign replies with the studio's name so clients see who is talking.
  const studio = await c.env.DB.prepare(
    "SELECT name FROM workspaces WHERE id=?",
  )
    .bind(session.workspaceId)
    .first<{ name: string }>();
  const commentId = id("com");
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      "INSERT INTO comments (id,approval_request_id,asset_id,asset_version_id,author_type,author_name,body) VALUES (?,?,?,?,?,?,?)",
    ).bind(
      commentId,
      asset.approval_request_id,
      asset.id,
      asset.version_id,
      "owner",
      studio?.name || "Designer",
      body.body,
    ),
  ];
  if (body.annotation)
    statements.push(annotationStatement(c.env, commentId, body.annotation));
  await c.env.DB.batch(statements);
  return c.json({ ok: true, id: commentId });
});
app.get("/api/activity", async (c) => {
  const session = await requireSession(c);
  if (session instanceof Response) return session;
  const rows = await c.env.DB.prepare(
    "SELECT * FROM activity_events WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100",
  )
    .bind(session.workspaceId)
    .all();
  return c.json(rows.results);
});
app.get("/api/media/:versionId", async (c) => {
  const version = await c.env.DB.prepare(
    "SELECT v.*,a.workspace_id FROM asset_versions v JOIN assets a ON a.id=v.asset_id WHERE v.id=?",
  )
    .bind(c.req.param("versionId"))
    .first<any>();
  if (!version) return c.json({ error: "Media not found" }, 404);
  const token = c.req.query("token");
  if (token) {
    const review = await resolveReview(c.env, token);
    if (
      !review ||
      !(await c.env.DB.prepare(
        "SELECT asset_id FROM approval_request_assets WHERE approval_request_id=? AND asset_id=?",
      )
        .bind(review.approval_request_id, version.asset_id)
        .first())
    )
      return c.json({ error: "Forbidden" }, 403);
  } else {
    const session = await getSession(c);
    if (!session || session.workspaceId !== version.workspace_id)
      return c.json({ error: "Authentication required" }, 401);
  }
  // Redirect production media to a short-lived signed URL; keep local development self-contained.
  if (c.env.R2_ACCESS_KEY_ID) {
    const signed = (await s3Client(c.env).sign(
      s3Url(c.env, version.r2_key, "?X-Amz-Expires=3600"),
      { method: "GET", aws: { signQuery: true } } as any,
    )) as Request;
    return c.redirect(signed.url, 302);
  }
  const object = await c.env.MEDIA.get(version.r2_key, {
    range: c.req.raw.headers,
  });
  if (!object) return c.json({ error: "Media not found" }, 404);
  const headers = new Headers({
    "Content-Type": version.mime_type || "application/octet-stream",
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
  if (c.req.header("range") && object.range && "offset" in object.range) {
    const start = object.range.offset || 0;
    const length = object.range.length || object.size;
    headers.set(
      "Content-Range",
      `bytes ${start}-${start + length - 1}/${object.size}`,
    );
    headers.set("Content-Length", String(length));
  }
  return new Response(object.body, {
    headers,
    status: c.req.header("range") && object.range ? 206 : 200,
  });
});

// ---- Reminder cron --------------------------------------------------------
async function runReminders(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT ar.id,ar.workspace_id,ar.project_id,ar.reviewer_email,ar.reviewer_name,ar.reminder_count,p.name AS project_name FROM approval_requests ar JOIN projects p ON p.id=ar.project_id WHERE ar.status='waiting' AND ar.reminder_enabled=1 AND ar.next_reminder_at IS NOT NULL AND datetime(ar.next_reminder_at)<=datetime('now') ORDER BY ar.next_reminder_at LIMIT 100`,
  ).all<any>();
  for (const row of rows.results) {
    try {
      if (!env.RESEND_API_KEY) continue;
      const token = randomToken(32);
      await env.DB.prepare(
        "INSERT INTO review_links (id,approval_request_id,token_hash) VALUES (?,?,?)",
      )
        .bind(id("lnk"), row.id, await sha256(token))
        .run();
      const reviewUrl = `${env.APP_ORIGIN}/review/${token}`;
      await sendEmail(
        env,
        row.reviewer_email,
        `Reminder: ${row.project_name} is waiting for review`,
        `<p>Hi ${escapeHtml(row.reviewer_name || "there")},</p><p>${escapeHtml(row.project_name)} is still waiting for your review.</p><p><a href="${reviewUrl}">Review content</a></p>`,
      );
      const nextCount = Number(row.reminder_count || 0) + 1;
      const next =
        nextCount === 1 ? addHours(48) : nextCount === 2 ? addHours(96) : null;
      await env.DB.prepare(
        "UPDATE approval_requests SET reminder_count=?,next_reminder_at=? WHERE id=?",
      )
        .bind(nextCount, next, row.id)
        .run();
      await audit(env, row.workspace_id, "reminder.sent", {
        projectId: row.project_id,
        approvalRequestId: row.id,
        actorName: "System",
        reminderCount: nextCount,
      });
    } catch (e) {
      console.error("Reminder failed", row.id, e);
    }
  }
}

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  if (err instanceof z.ZodError)
    return c.json({ error: "Invalid request", issues: err.issues }, 400);
  if (err.message.includes("Storage quota exceeded"))
    return c.json({ error: "Storage quota exceeded" }, 413);
  if (err.message.includes("Upload already finalized"))
    return c.json({ error: "Upload already finalized" }, 409);
  return c.json(
    { error: "The request could not be completed. Please try again." },
    500,
  );
});

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(runReminders(env));
  },
};
