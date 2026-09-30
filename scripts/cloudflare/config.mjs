export const secretNames = [
  'RESEND_API_KEY',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
];

const positiveIntegerVars = [
  'MAX_SINGLE_UPLOAD_BYTES',
  'MAX_VIDEO_BYTES',
  'DEFAULT_STORAGE_QUOTA_BYTES',
];

export function validate(env) {
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
    if (!env[key]) throw new Error(`Missing ${key}. Configure it in GitHub Actions secrets.`);
  }

  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID)) {
    throw new Error('Invalid Cloudflare account ID.');
  }

  for (const [a, b] of [
    ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
    ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  ]) {
    if (!!env[a] !== !!env[b]) throw new Error(`Supply both ${a} and ${b}, or neither.`);
  }

  if (env.RAZORPAY_KEY_ID) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET is required when Razorpay billing is enabled.');
    }
    for (const key of ['RAZORPAY_PLAN_SOLO', 'RAZORPAY_PLAN_FREELANCER', 'RAZORPAY_PLAN_AGENCY']) {
      if (!env[key]) throw new Error(`${key} is required when Razorpay billing is enabled.`);
    }
  }

  for (const key of ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
    if (!env[key]) throw new Error(`Missing ${key}. Media uploads require R2 credentials in GitHub Actions secrets.`);
  }
  if (env.RESEND_API_KEY && (!env.EMAIL_FROM || env.EMAIL_FROM.includes('example.com'))) {
    throw new Error('EMAIL_FROM must use your verified sender when RESEND_API_KEY is supplied.');
  }

  for (const key of positiveIntegerVars) {
    if (env[key] && (!/^\d+$/.test(env[key]) || Number(env[key]) <= 0)) {
      throw new Error(`${key} must be a positive integer.`);
    }
  }

  const name = env.WORKER_NAME || 'approveflow';
  const database = env.D1_DATABASE_NAME || `${name}-db`;
  const bucket = env.R2_BUCKET_NAME || `${name}-media`;

  for (const [kind, value] of [
    ['Worker', name],
    ['D1 database', database],
    ['R2 bucket', bucket],
  ]) {
    if (!/^[a-z][a-z0-9-]{2,62}$/.test(value)) {
      throw new Error(`${kind} name must be 3-63 lowercase letters, digits, or hyphens and start with a letter.`);
    }
  }

  if (env.APP_ORIGIN) {
    const url = new URL(env.APP_ORIGIN);
    if (url.protocol !== 'https:' || url.origin !== env.APP_ORIGIN) {
      throw new Error('APP_ORIGIN must be an HTTPS origin without a path or trailing slash.');
    }
  }

  return { name, database, bucket };
}

export function cloudflare(env, fetcher = fetch) {
  return async (path, { method = 'GET', body, allow404 = false } = {}) => {
    let response;

    for (let attempt = 0; attempt < 4; attempt++) {
      response = await fetcher(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );

      if (
        method !== 'GET' ||
        ![429, 500, 502, 503, 504].includes(response.status) ||
        attempt === 3
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }

    if (response.status === 404 && allow404) return null;

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const codes = (data.errors || []).map((error) => error.code).join(',');
      throw new Error(
        `Cloudflare ${method} ${path.split('?')[0]} failed (${response.status}; codes ${codes}). Check API-token permissions and service activation.`,
      );
    }

    return data.result;
  };
}

export async function ensureResource(find, create) {
  const found = await find();
  if (found) return { resource: found, created: false };

  try {
    return { resource: await create(), created: true };
  } catch (error) {
    const concurrent = await find();
    if (concurrent) return { resource: concurrent, created: false };
    throw error;
  }
}

export function mergeRule(existing, rule) {
  return [...(existing?.rules || []).filter((item) => item.id !== rule.id), rule];
}
