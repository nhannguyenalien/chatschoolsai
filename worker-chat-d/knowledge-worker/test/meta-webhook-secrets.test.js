import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handleMetaWebhookEvent, assignScheduledSlots } from '../src/index.js';

const sign = (body, secret) => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
const post = (body, secret) => {
  const raw = JSON.stringify(body);
  return new Request('https://worker.test/meta-webhook', { method: 'POST', headers: { 'X-Hub-Signature-256': sign(raw, secret) }, body: raw });
};
const env = { PB_URL: 'https://pb.test', PB_ADMIN_EMAIL: 'a', PB_ADMIN_PASS: 'b' };
const event = (pageId) => ({ object: 'page', entry: [{ id: pageId, messaging: [] }] });

function mockPb(pages) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/auth-with-password')) return Response.json({ token: 'admin-test' });
    assert.equal(u.pathname, '/api/collections/pages_config/records');
    const filter = u.searchParams.get('filter');
    const ids = [...filter.matchAll(/page_id='([^']+)'/g)].map((m) => m[1]);
    const tenants = [...filter.matchAll(/tenant='([^']+)'/g)].map((m) => m[1]);
    const items = pages.filter((p) => (ids.length ? ids.includes(p.page_id) : tenants.includes(p.tenant)));
    return Response.json({ items });
  };
  return () => { globalThis.fetch = original; };
}

test('webhook accepts a signature made with a sibling page secret of the same tenant', async () => {
  const restore = mockPb([
    { tenant: 'acme', page_id: 'P1', platform: 'facebook', extra_config: JSON.stringify({ app_secret: 'shared-secret' }) },
    { tenant: 'acme', page_id: 'P2', platform: 'facebook', extra_config: '{}' },
    { tenant: 'other', page_id: 'P3', platform: 'facebook', extra_config: JSON.stringify({ app_secret: 'other-secret' }) }
  ]);
  try {
    assert.equal((await handleMetaWebhookEvent(post(event('P2'), 'shared-secret'), env, null)).status, 200);
    assert.equal((await handleMetaWebhookEvent(post(event('P2'), 'other-secret'), env, null)).status, 401);
    assert.equal((await handleMetaWebhookEvent(post(event('P2'), 'wrong'), env, null)).status, 401);
  } finally { restore(); }
});

test('webhook with no tenant app_secret answers 503 even if META_APP_SECRET is set', async () => {
  const restore = mockPb([{ tenant: 'acme', page_id: 'P2', platform: 'facebook', extra_config: '{}' }]);
  try {
    assert.equal((await handleMetaWebhookEvent(post(event('P2'), 'x'), env, null)).status, 503);
    assert.equal((await handleMetaWebhookEvent(post(event('P2'), 'global'), { ...env, META_APP_SECRET: 'global' }, null)).status, 503);
  } finally { restore(); }
});

test('assignScheduledSlots gives each page its own timezone-aware slot', async () => {
  const original = globalThis.fetch;
  const patches = [];
  const rules = [
    { id: 'r1', tenant: 'acme', content_type: 'social', page_id: 'VN', days: '[]', times: '["08:00"]', timezone: 'Asia/Ho_Chi_Minh' },
    { id: 'r2', tenant: 'acme', content_type: 'social', page_id: 'JP', days: '[]', times: '["08:00"]', timezone: '' }
  ];
  const pages = { VN: { extra_config: '{}' }, JP: { extra_config: JSON.stringify({ timezone: 'Asia/Tokyo' }) } };
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const f = u.searchParams.get('filter') || '';
    if (u.pathname.endsWith('/auth-with-password')) return Response.json({ token: 'admin-test' });
    if (u.pathname.endsWith('/publish_schedules/records')) return Response.json({ items: rules });
    if (u.pathname.endsWith('/pages_config/records')) return Response.json({ items: [pages[/page_id='(\w+)'/.exec(f)[1]]] });
    if (opts.method === 'PATCH') { patches.push(JSON.parse(opts.body).scheduled_at); return Response.json({}); }
    if (f.includes("scheduled_at='20")) return Response.json({ totalItems: 0, items: [] });
    return Response.json({ items: [{ id: 't' + patches.length }] });
  };
  try {
    await assignScheduledSlots(env, 'acme');
    assert.equal(patches.length, 2);
    const hours = patches.map((iso) => new Date(iso).getUTCHours()).sort((a, b) => a - b);
    assert.deepEqual(hours, [23, 1].sort((a, b) => a - b)); // Tokyo 08:00 = 23:00 UTC (prev day), HCM 08:00 = 01:00 UTC
  } finally { globalThis.fetch = original; }
});
