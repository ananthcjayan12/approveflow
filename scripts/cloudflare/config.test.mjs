import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudflare, ensureResource, mergeRule, validate } from './config.mjs';

test('permission failure is not treated as a missing resource', async () => {
  const cf = cloudflare(
    { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'secret' },
    async () => new Response('{}', { status: 403 }),
  );
  await assert.rejects(
    cf('/r2/buckets/private', { allow404: true }),
    /403/,
  );
});

test('missing resource is created once and then reused', async () => {
  let value = null;
  let createCount = 0;
  const find = async () => value;
  const create = async () => {
    createCount += 1;
    return (value = { id: 'resource' });
  };

  assert.equal((await ensureResource(find, create)).created, true);
  assert.equal((await ensureResource(find, create)).created, false);
  assert.equal(createCount, 1);
});

test('concurrent resource creation is reconciled', async () => {
  let findCount = 0;
  const result = await ensureResource(
    async () => (++findCount === 1 ? null : { id: 'existing' }),
    async () => {
      throw new Error('conflict');
    },
  );
  assert.equal(result.created, false);
});

test('managed policy update preserves unrelated rules', () => {
  assert.deepEqual(
    mergeRule(
      { rules: [{ id: 'unrelated' }, { id: 'approveflow-rule' }] },
      { id: 'approveflow-rule', enabled: true },
    ),
    [{ id: 'unrelated' }, { id: 'approveflow-rule', enabled: true }],
  );
});

test('deployment validation catches partial credentials and insecure origins', () => {
  const env = {
    CLOUDFLARE_API_TOKEN: 'token',
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  };

  assert.throws(
    () => validate({ ...env, R2_ACCESS_KEY_ID: 'id-only' }),
    /both/,
  );
  assert.throws(
    () => validate({ ...env, RAZORPAY_KEY_ID: 'key', RAZORPAY_KEY_SECRET: 'secret' }),
    /WEBHOOK/,
  );
  assert.throws(
    () => validate({ ...env, APP_ORIGIN: 'http://example.com' }),
    /HTTPS/,
  );
  assert.equal(validate(env).name, 'approveflow');
});
