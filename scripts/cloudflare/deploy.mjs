import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { secretNames, validate } from './config.mjs';

validate(process.env);
const state = JSON.parse(await readFile('.cloudflare-state.json', 'utf8'));
const directory = await mkdtemp(join(tmpdir(), 'approveflow-secrets-'));

try {
  const secretsPath = join(directory, 'secrets.json');
  const secrets = Object.fromEntries(
    secretNames
      .filter((name) => process.env[name])
      .map((name) => [name, process.env[name]]),
  );

  await writeFile(secretsPath, JSON.stringify(secrets), { mode: 0o600 });

  const result = spawnSync(
    'npx',
    [
      '--no-install',
      'wrangler',
      'deploy',
      '--config',
      'wrangler.generated.json',
      '--secrets-file',
      secretsPath,
    ],
    { stdio: 'inherit', env: process.env },
  );

  if (result.error || result.status !== 0) {
    throw new Error('Worker deployment failed. Review Wrangler diagnostics.');
  }

  const missing = [
    !process.env.R2_ACCESS_KEY_ID &&
      'R2 S3 credentials are not supplied; direct browser uploads will be unavailable',
    !process.env.RESEND_API_KEY &&
      'RESEND_API_KEY is not supplied; email notifications will be skipped',
    !process.env.RAZORPAY_KEY_ID &&
      'Razorpay credentials are not supplied; paid subscription checkout will be unavailable',
  ].filter(Boolean);

  const summary =
    `\nDeployment completed: ${state.origin}\n\n` +
    (missing.length ? missing.map((message) => `- ${message}.\n`).join('') : '- All optional integrations supplied.\n');

  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
