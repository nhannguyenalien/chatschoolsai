import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeteredAiFetch, recordAiUsage } from '../src/index.js';
import { AccountQuotaStore } from '../src/domain/billing/accountQuota.js';

const month = new Date().toISOString().slice(0, 7);
function fixture(overrides = {}) {
  let record = { id: 'account-1', tenant: 'shop-a', message_limit: 3, message_used: 0, last_reset_month: month, ...overrides };
  const values = new Map();
  const storage = { get: async key => structuredClone(values.get(key)), put: async (key, value) => values.set(key, structuredClone(value)) };
  const backend = { read: async () => ({ ...record }), write: async (_, patch) => { record = { ...record, ...patch }; } };
  let object = new AccountQuotaStore({ storage }, backend);
  const env = { PB_URL: 'https://pb.test', OPENAI_BASE_URL: 'https://openai.test/v1', ACCOUNT_QUOTA: {
    idFromName: id => id,
    get: id => { assert.equal(id, record.id); return { fetch: (url, options) => object.fetch(new Request(url, options)) }; }
  } };
  return { env, backend, record: () => record, restart: () => { object = new AccountQuotaStore({ storage }, backend); },
    reserve: units => object.fetch(new Request('https://quota/reserve', { method: 'POST', body: JSON.stringify({ accountId: record.id, units }) })) };
}

test('100 concurrent requests share a hard account limit, including after restart', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 100 }, async () => (await f.reserve(1)).json()));
  assert.equal(results.filter(r => r.ok).length, 3);
  assert.equal(f.record().message_used, 3);
  f.restart();
  assert.equal((await (await f.reserve(1)).json()).ok, false);
});

test('monthly reset is serialized and multi-unit reservations cannot overrun remaining quota', async () => {
  const f = fixture({ message_used: 99, last_reset_month: '2000-01' });
  const results = await Promise.all([f.reserve(2), f.reserve(2)]);
  assert.deepEqual(await Promise.all(results.map(r => r.json().then(v => v.ok))), [true, false]);
  assert.equal(f.record().message_used, 2);
  assert.equal(f.record().last_reset_month, month);
});

test('zero is a real zero limit', async () => {
  const f = fixture({ message_limit: 0 });
  assert.equal((await (await f.reserve(1)).json()).ok, false);
  assert.equal(f.record().message_used, 0);
});

test('failed PB write blocks calls and preserves reservation across object restart', async () => {
  const f = fixture();
  const write = f.backend.write;
  f.backend.write = async () => { throw new Error('offline'); };
  assert.equal((await f.reserve(1)).status, 503);
  f.restart();
  f.backend.write = write;
  assert.equal((await (await f.reserve(1)).json()).record.message_used, 2);
});

test('provider is reserved before first call, once per turn even with parallel tool rounds', async () => {
  const f = fixture();
  let providerCalls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).startsWith('https://pb.test/')) return Response.json({ items: [f.record()] });
    assert.equal(f.record().message_used, 1);
    providerCalls++;
    return new Response('provider error', { status: 500 });
  };
  try {
    const metered = createMeteredAiFetch(f.env, 'shop-a', 'token');
    await Promise.all([metered('https://openai.test/v1/chat/completions'), metered('https://openai.test/v1/chat/completions')]);
    assert.equal(providerCalls, 2);
    assert.equal(f.record().message_used, 1);
  } finally { globalThis.fetch = original; }
});

test('missing quota binding, missing owner and exhausted quota fail closed before provider', async () => {
  const original = globalThis.fetch;
  try {
    for (const scenario of ['binding', 'owner', 'exhausted']) {
      const f = fixture({ message_limit: 0 });
      if (scenario === 'binding') delete f.env.ACCOUNT_QUOTA;
      globalThis.fetch = async url => {
        assert.ok(String(url).startsWith('https://pb.test/'), 'no paid provider call allowed');
        return Response.json({ items: scenario === 'owner' ? [] : [f.record()] });
      };
      await assert.rejects(createMeteredAiFetch(f.env, 'shop-a', 'token')('https://openai.test/v1/chat/completions'));
    }
  } finally { globalThis.fetch = original; }
});

test('different workspaces resolve to the same owner budget', async () => {
  const f = fixture();
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    const target = new URL(url);
    if (target.pathname.endsWith('/tenants/records')) return Response.json({ items: [] });
    if (target.pathname.endsWith('/tenant_memberships/records')) {
      assert.match(target.searchParams.get('filter'), /role='owner'/);
      return Response.json({ items: [{ account: 'account-1' }] });
    }
    return Response.json(f.record());
  };
  try {
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => recordAiUsage(f.env, `shop-${i}`, 1, 'token')));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
    assert.equal(f.record().message_used, 3);
  } finally { globalThis.fetch = original; }
});

test('add-on credits are spent only after the monthly limit, never expire, and survive restart', async () => {
  const f = fixture({ message_limit: 2, message_bonus_granted: 3, message_bonus_used: 0 });
  const results = await Promise.all(Array.from({ length: 10 }, async () => (await f.reserve(1)).json()));
  assert.equal(results.filter(r => r.ok).length, 5);
  assert.equal(f.record().message_used, 2);
  assert.equal(f.record().message_bonus_used, 3);
  f.restart();
  assert.equal((await (await f.reserve(1)).json()).ok, false);
  // A new grant raises granted only; the used counter is untouched and spending resumes.
  await f.backend.write('account-1', { message_bonus_granted: 4 });
  assert.equal((await (await f.reserve(1)).json()).ok, true);
  assert.equal(f.record().message_bonus_used, 4);
});

test('failed PB write for a bonus spend blocks the call', async () => {
  const f = fixture({ message_limit: 0, message_bonus_granted: 1 });
  f.backend.write = async () => { throw new Error('pb down'); };
  assert.equal((await f.reserve(1)).status, 503);
});
