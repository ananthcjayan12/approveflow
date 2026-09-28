import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { provision } from './provision.mjs';

test('bootstrap creates missing D1/R2, configures policies, and is idempotent', async () => {
  const cwd = process.cwd();
  const base = await readFile(join(cwd, 'wrangler.jsonc'), 'utf8');
  const directory = await mkdtemp(join(tmpdir(), 'approveflow-provision-test-'));
  const originalFetch = globalThis.fetch;

  let database = null;
  let bucket = null;
  let creations = 0;
  const policies = {};

  try {
    await writeFile(join(directory, 'wrangler.jsonc'), base);
    process.chdir(directory);

    globalThis.fetch = async (url, init) => {
      const parsed = new URL(url);
      const path = parsed.pathname.replace(
        /^\/client\/v4\/accounts\/[^/]+/,
        '',
      );

      let result = null;

      if (path === '/d1/database' && init.method === 'GET') {
        result = database ? [database] : [];
      } else if (path === '/d1/database' && init.method === 'POST') {
        result = database = {
          name: 'approveflow-db',
          uuid: 'test-database-id',
        };
        creations += 1;
      } else if (path === '/r2/buckets/approveflow-media') {
        if (!bucket) return Response.json({ success: false }, { status: 404 });
        result = bucket;
      } else if (path === '/r2/buckets' && init.method === 'POST') {
        result = bucket = { name: 'approveflow-media' };
        creations += 1;
      } else if (path.endsWith('/domains/managed')) {
        result = { enabled: false };
      } else if (path.endsWith('/domains/custom')) {
        result = { domains: [] };
      } else if (path === '/workers/subdomain') {
        result = { subdomain: 'test-account' };
      } else if (path.endsWith('/cors') || path.endsWith('/lifecycle')) {
        if (init.method === 'PUT') policies[path] = JSON.parse(init.body);
        result = policies[path] || { rules: [{ id: 'unrelated-rule' }] };
      } else {
        throw new Error(`Unexpected provisioning call: ${init.method} ${path}`);
      }

      return Response.json({ success: true, result });
    };

    const env = {
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    };

    const first = await provision(env);
    assert.equal(first.databaseCreated, true);
    assert.equal(first.bucketCreated, true);

    const config = JSON.parse(
      await readFile('wrangler.generated.json', 'utf8'),
    );
    assert.equal(config.d1_databases[0].database_id, 'test-database-id');
    assert.equal(config.vars.APP_ORIGIN, 'https://approveflow.test-account.workers.dev');
    assert.equal(config.vars.R2_ACCOUNT_ID, 'a'.repeat(32));
    assert.equal(config.vars.R2_BUCKET_NAME, 'approveflow-media');
    assert.equal(config.vars.CLOUDFLARE_API_TOKEN, undefined);
    assert.equal(config.vars.RAZORPAY_KEY_SECRET, undefined);

    const cors = policies['/r2/buckets/approveflow-media/cors'];
    assert.deepEqual(
      cors.rules.find((rule) => rule.id === 'approveflow-direct-media').allowed.methods,
      ['GET', 'HEAD', 'PUT'],
    );

    const second = await provision(env);
    assert.equal(second.databaseCreated, false);
    assert.equal(second.bucketCreated, false);
    assert.equal(creations, 2);

    for (const policy of Object.values(policies)) {
      assert.equal(policy.rules.length, 2);
    }
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    await rm(directory, { recursive: true, force: true });
  }
});
