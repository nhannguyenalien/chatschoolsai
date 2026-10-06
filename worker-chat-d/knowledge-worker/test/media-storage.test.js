import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountQuotaStore, storageLimit, STORAGE_LIMITS } from '../src/domain/billing/accountQuota.js';
import { createMediaStore, MediaError } from '../src/domain/media/mediaStore.js';

const MB = 1024 * 1024;
function quotaFixture(overrides = {}) {
  let record = { id: 'acc', plan_id: 'free', storage_used: 0, ...overrides };
  const values = new Map();
  const storage = { get: async k => structuredClone(values.get(k)), put: async (k, v) => values.set(k, structuredClone(v)) };
  const backend = { read: async () => ({ ...record }), write: async (_, patch) => { record = { ...record, ...patch }; } };
  const object = new AccountQuotaStore({ storage }, backend);
  const call = bytes => object.fetch(new Request('https://q/storage', { method: 'POST', body: JSON.stringify({ kind: 'storage', accountId: 'acc', bytes }) })).then(r => r.json());
  return { call, record: () => record };
}

function storeFixture(quota, { bucket = true, failRecord = false } = {}) {
  const objects = new Map(); const created = [];
  const b = bucket ? { put: async (k, v) => objects.set(k, v), delete: async k => objects.delete(k) } : undefined;
  const records = {
    create: async (fields, file) => { if (failRecord) throw new Error('pb down'); created.push({ fields, file }); return { id: `r${created.length}`, url: fields.url, fileUrl: 'https://pb/f.png' }; },
    remove: async () => {}
  };
  const store = createMediaStore({ bucket: b, publicBaseUrl: 'https://media.test/', records, randomId: () => 'abc', now: () => new Date('2026-10-06T00:00:00Z'),
    quota: { reserve: bytes => quota.call(bytes), release: bytes => quota.call(-bytes) } });
  return { store, objects, created };
}

test('plan limits: free 100MB, pro 2GB, admin override', () => {
  assert.equal(storageLimit({ plan_id: 'free' }), 100 * MB);
  assert.equal(storageLimit({ plan_id: 'pro' }), 2048 * MB);
  assert.equal(STORAGE_LIMITS.pro, 2 * 1024 * MB);
  assert.equal(storageLimit({ plan_id: 'free', storage_limit_bytes: 5 }), 5);
});

test('concurrent reservations never exceed the free limit; release refunds', async () => {
  const q = quotaFixture();
  const results = await Promise.all(Array.from({ length: 20 }, () => q.call(10 * MB)));
  assert.equal(results.filter(r => r.ok).length, 10);
  assert.equal(q.record().storage_used, 100 * MB);
  assert.equal((await q.call(-30 * MB)).used, 70 * MB);
  assert.equal((await q.call(30 * MB)).ok, true);
});

test('pro plan allows a larger total', async () => {
  const q = quotaFixture({ plan_id: 'pro' });
  assert.equal((await q.call(1500 * MB)).ok, true);
  assert.equal((await q.call(600 * MB)).ok, false);
});

test('store writes R2 object + record and counts bytes', async () => {
  const q = quotaFixture(); const f = storeFixture(q);
  const out = await f.store.store({ tenant: 't1', bytes: new Uint8Array(1000), contentType: 'image/png', label: 'x' });
  assert.equal(out.url, 'https://media.test/t1/2026-10/abc.png');
  assert.ok(f.objects.has('t1/2026-10/abc.png'));
  assert.equal(q.record().storage_used, 1000);
  assert.equal(f.created[0].fields.size_bytes, 1000);
});

test('over-quota upload is rejected before anything is written', async () => {
  const q = quotaFixture({ storage_used: 100 * MB - 10 }); const f = storeFixture(q);
  await assert.rejects(f.store.store({ tenant: 't1', bytes: new Uint8Array(11), contentType: 'image/png' }), e => e instanceof MediaError && e.code === 'STORAGE_QUOTA_EXCEEDED' && e.status === 413);
  assert.equal(f.objects.size, 0);
});

test('record failure rolls back object and quota', async () => {
  const q = quotaFixture(); const f = storeFixture(q, { failRecord: true });
  await assert.rejects(f.store.store({ tenant: 't1', bytes: new Uint8Array(500), contentType: 'video/mp4' }), /pb down/);
  assert.equal(f.objects.size, 0);
  assert.equal(q.record().storage_used, 0);
});

test('rejects unsupported types and empty files; PocketBase fallback without bucket', async () => {
  const q = quotaFixture(); const f = storeFixture(q, { bucket: false });
  await assert.rejects(f.store.store({ tenant: 't1', bytes: new Uint8Array(5), contentType: 'application/x-msdownload' }), e => e.code === 'UNSUPPORTED_MEDIA_TYPE');
  await assert.rejects(f.store.store({ tenant: 't1', bytes: new Uint8Array(0), contentType: 'image/png' }), e => e.code === 'EMPTY_FILE');
  const out = await f.store.store({ tenant: 't1', bytes: new Uint8Array(7), contentType: 'image/png' });
  assert.equal(out.url, 'https://pb/f.png');
  assert.ok(f.created[0].file);
});

test('remove deletes object and refunds size', async () => {
  const q = quotaFixture(); const f = storeFixture(q);
  await f.store.store({ tenant: 't1', bytes: new Uint8Array(400), contentType: 'image/png' });
  await f.store.remove({ id: 'r1', r2_key: 't1/2026-10/abc.png', size_bytes: 400 });
  assert.equal(f.objects.size, 0);
  assert.equal(q.record().storage_used, 0);
});
