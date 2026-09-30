import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { parse } from 'jsonc-parser';
import { cloudflare, ensureResource, mergeRule, validate } from './config.mjs';

export async function provision(env = process.env) {
  const names = validate(env);
  const cf = cloudflare(env);

  const db = await ensureResource(
    async () => {
      const matches = [];
      for (let page = 1; ; page++) {
        const rows = await cf(
          `/d1/database?name=${encodeURIComponent(names.database)}&per_page=100&page=${page}`,
        );
        matches.push(...rows.filter((row) => row.name === names.database));
        if (rows.length < 100) break;
      }
      if (matches.length > 1) throw new Error('Ambiguous D1 database name.');
      return matches[0];
    },
    () => cf('/d1/database', { method: 'POST', body: { name: names.database } }),
  );

  const bucket = await ensureResource(
    () => cf(`/r2/buckets/${names.bucket}`, { allow404: true }),
    () =>
      cf('/r2/buckets', {
        method: 'POST',
        body: { name: names.bucket, storageClass: 'Standard' },
      }),
  );

  // ApproveFlow signs short-lived R2 URLs itself, so a public bucket is a deployment error.
  const managedDomain = await cf(`/r2/buckets/${names.bucket}/domains/managed`);
  const customDomains = await cf(`/r2/buckets/${names.bucket}/domains/custom`);
  if (
    managedDomain?.enabled ||
    customDomains?.domains?.some((domain) => domain.enabled !== false)
  ) {
    throw new Error(
      'The ApproveFlow R2 bucket is public. Disable public access or choose a dedicated private bucket before deploying.',
    );
  }

  let origin = env.APP_ORIGIN;
  if (!origin) {
    const subdomain = await cf('/workers/subdomain');
    if (!subdomain?.subdomain) {
      throw new Error(
        'Cloudflare Workers subdomain is not configured. Set APP_ORIGIN or enable your Workers subdomain.',
      );
    }
    origin = `https://${names.name}.${subdomain.subdomain}.workers.dev`;
  }

  const cors = await cf(`/r2/buckets/${names.bucket}/cors`, { allow404: true });
  await cf(`/r2/buckets/${names.bucket}/cors`, {
    method: 'PUT',
    body: {
      rules: mergeRule(cors, {
        id: 'approveflow-direct-media',
        allowed: {
          origins: [origin],
          methods: ['GET', 'HEAD', 'PUT'],
          headers: ['content-type'],
        },
        exposeHeaders: ['ETag'],
        maxAgeSeconds: 3600,
      }),
    },
  });

  const lifecycle = await cf(`/r2/buckets/${names.bucket}/lifecycle`);
  await cf(`/r2/buckets/${names.bucket}/lifecycle`, {
    method: 'PUT',
    body: {
      rules: mergeRule(lifecycle, {
        id: 'approveflow-abort-incomplete-multipart',
        enabled: true,
        conditions: { prefix: '' },
        abortMultipartUploadsTransition: {
          condition: { type: 'Age', maxAge: 172800 },
        },
      }),
    },
  });

  const errors = [];
  const config = parse(await readFile('wrangler.jsonc', 'utf8'), errors, {
    allowTrailingComma: true,
  });
  if (errors.length) throw new Error('Invalid base wrangler.jsonc configuration.');

  Object.assign(config, {
    name: names.name,
    account_id: env.CLOUDFLARE_ACCOUNT_ID,
  });

  config.d1_databases[0].database_name = names.database;
  config.d1_databases[0].database_id = db.resource.uuid || db.resource.id;
  if (!config.d1_databases[0].database_id) {
    throw new Error('Cloudflare did not return a D1 database ID.');
  }

  config.r2_buckets[0].bucket_name = names.bucket;

  config.vars = {
    APP_ORIGIN: origin,
    R2_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
    R2_BUCKET_NAME: names.bucket,
    MAX_SINGLE_UPLOAD_BYTES: env.MAX_SINGLE_UPLOAD_BYTES || '104857600',
    MAX_VIDEO_BYTES: env.MAX_VIDEO_BYTES || '5368709120',
    DEFAULT_STORAGE_QUOTA_BYTES: env.DEFAULT_STORAGE_QUOTA_BYTES || '10737418240',
    EMAIL_FROM: env.EMAIL_FROM || 'ApproveFlow <approvals@example.com>',
    ...(env.RAZORPAY_PLAN_SOLO ? { RAZORPAY_PLAN_SOLO: env.RAZORPAY_PLAN_SOLO } : {}),
    ...(env.RAZORPAY_PLAN_FREELANCER
      ? { RAZORPAY_PLAN_FREELANCER: env.RAZORPAY_PLAN_FREELANCER }
      : {}),
    ...(env.RAZORPAY_PLAN_AGENCY ? { RAZORPAY_PLAN_AGENCY: env.RAZORPAY_PLAN_AGENCY } : {}),
  };

  if (!new URL(origin).hostname.endsWith('.workers.dev')) {
    config.routes = [{ pattern: new URL(origin).hostname, custom_domain: true }];
  } else {
    delete config.routes;
  }

  await writeFile('wrangler.generated.json', JSON.stringify(config, null, 2) + '\n');

  const state = {
    ...names,
    origin,
    databaseId: config.d1_databases[0].database_id,
    databaseCreated: db.created,
    bucketCreated: bucket.created,
  };
  await writeFile('.cloudflare-state.json', JSON.stringify(state, null, 2) + '\n');

  const summary =
    `\n### ApproveFlow Cloudflare resources\n\n` +
    `- Worker: ${names.name}\n` +
    `- D1: ${names.database} (${db.created ? 'created' : 'reused'})\n` +
    `- Private R2: ${names.bucket} (${bucket.created ? 'created' : 'reused'})\n` +
    `- Application: ${origin}\n` +
    `- Razorpay webhook: ${origin}/api/webhooks/razorpay\n`;

  if (env.GITHUB_STEP_SUMMARY) {
    await appendFile(env.GITHUB_STEP_SUMMARY, summary);
  }
  console.log(summary);

  return state;
}

if (process.argv[1]?.endsWith('/provision.mjs')) {
  provision().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
