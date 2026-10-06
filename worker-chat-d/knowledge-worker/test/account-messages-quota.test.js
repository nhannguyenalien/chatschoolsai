import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccountMessages, handleApiMarketplaceChat } from '../src/index.js';
import { AccountQuotaStore } from '../src/domain/billing/accountQuota.js';

test('account messages requires login and active membership, fixes tenant filter server-side', async () => {
  const original = globalThis.fetch;
  let messageReads = 0;
  let mode = 'active';
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/auth-refresh')) return Response.json({ record: { id: 'owner1', tenant: 'primary' } });
    if (u.pathname.endsWith('/auth-with-password')) return Response.json({ token: 'admin-test' });
    if (u.pathname.includes('/tenant_memberships/')) {
      assert.equal(u.searchParams.get('filter'), "account='owner1' && tenant='child' && status='active'");
      return mode === 'offline' ? new Response('', { status: 503 }) : Response.json({ items: mode === 'active' ? [{ id: 'member1' }] : [] });
    }
    assert.equal(u.pathname, '/api/collections/messages/records');
    assert.equal(u.searchParams.get('filter'), "tenant='child'");
    assert.equal(u.searchParams.get('page'), '2');
    messageReads++;
    return Response.json({ items: [{ id: 'm1', tenant: 'child' }], totalPages: 2 });
  };
  const env = { PB_URL: 'https://pb.test' };
  const request = (query, auth = true) => new Request(`https://worker.test/api/account/messages?${query}`, { headers: auth ? { Authorization: 'user-token' } : {} });
  try {
    assert.equal((await handleAccountMessages(request('tenant=child', false), env, {})).status, 401);
    const response = await handleAccountMessages(request('tenant=child&page=2&filter=ignored'), env, {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    mode = 'foreign';
    assert.equal((await handleAccountMessages(request('tenant=child'), env, {})).status, 403);
    mode = 'offline';
    assert.equal((await handleAccountMessages(request('tenant=child'), env, {})).status, 503);
    assert.equal((await handleAccountMessages(request('tenant=%27'), env, {})).status, 400);
    assert.equal(messageReads, 1);
  } finally { globalThis.fetch = original; }
});

test('marketplace persists both messages and reserves before provider; exhausted and storage errors block AI', async () => {
  const original = globalThis.fetch;
  let record = { id: 'account1', tenant: 'estate', message_limit: 2, message_used: 0, last_reset_month: new Date().toISOString().slice(0, 7) };
  const values = new Map();
  const quota = new AccountQuotaStore({ storage: { get: async k => values.get(k), put: async (k,v) => values.set(k,v) } }, {
    read: async () => ({ ...record }), write: async (_, patch) => { record = { ...record, ...patch }; }
  });
  const env = { PB_URL: 'https://pb.test', OPENAI_BASE_URL: 'https://ai.test/v1', ACCOUNT_QUOTA: { idFromName: id => id, get: () => ({ fetch: (url, opts) => quota.fetch(new Request(url, opts)) }) } };
  const saved = [];
  let calls = 0;
  let storageFailure = false;
  globalThis.fetch = async (url, opts = {}) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/auth-with-password')) return Response.json({ token: 'admin-test' });
    if (path.endsWith('/tenants/records')) return Response.json({ items: [record] });
    if (path.endsWith('/agent_tools/records')) return Response.json({ items: [] });
    if (path.endsWith('/messages/records')) {
      if (storageFailure) return new Response('offline', { status: 503 });
      saved.push(JSON.parse(opts.body));
      return Response.json({ id: `m${saved.length}` });
    }
    assert.equal(path, '/v1/chat/completions');
    assert.equal(record.message_used, 1);
    assert.equal(saved.length, 1);
    calls++;
    return Response.json({ choices: [{ message: { content: 'Nhà giá 2 tỷ.' } }] });
  };
  const request = () => new Request('https://worker.test/api/v1/marketplace-chat', { method: 'POST', body: JSON.stringify({ session: 'test-session', item_context: 'Nhà giá 2 tỷ', messages: [{ role: 'user', content: 'Giá bao nhiêu?' }] }) });
  try {
    assert.equal((await handleApiMarketplaceChat(request(), env, {}, { tenant: 'estate' })).status, 200);
    assert.equal(record.message_used, 1);
    assert.deepEqual(saved.map(m => [m.tenant, m.session, m.is_bot]), [['estate', 'test-session', false], ['estate', 'test-session', true]]);
    storageFailure = true;
    assert.equal((await handleApiMarketplaceChat(request(), env, {}, { tenant: 'estate' })).status, 500);
    assert.equal((await handleApiMarketplaceChat(request(), env, {}, { tenant: 'estate' })).status, 429);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
