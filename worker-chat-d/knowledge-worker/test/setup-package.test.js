import test from 'node:test';
import assert from 'node:assert/strict';
import { createSetupStore } from '../src/domain/billing/setupOrders.js';
import { billingCatalog, fetchPaidSetupOrder, handleBGate } from '../src/domain/billing/bgate.js';

const ORDER = '3e3250c1-bcab-4cc2-aae1-c367df89a584';
const OTHER = '11111111-1111-1111-1111-111111111111';

// Minimal in-memory PocketBase: just the three collections the store touches.
function fakePb({ configs, memberships = [], tenants = {} }) {
  const patches = [];
  const match = (record, filter) => {
    const eq = filter.match(/^tenant='([^']*)'$/); if (eq) return record.tenant === eq[1];
    const like = filter.match(/^setup_orders ~ '([^']*)'$/); if (like) return String(record.setup_orders).includes(like[1]);
    if (filter === "setup_status='pending'") return record.setup_status === 'pending';
    const mem = filter.match(/^account='([^']*)' && tenant='([^']*)'/);
    if (mem) return record.account === mem[1] && record.tenant === mem[2] && record.status === 'active' && record.role === 'owner';
    throw new Error('unexpected filter ' + filter);
  };
  return {
    patches, configs,
    list: async (collection, filter, perPage) => (collection === 'bot_configs' ? configs : memberships).filter((r) => match(r, filter)).slice(0, perPage),
    get: async (collection, id) => tenants[id],
    patch: async (collection, id, body) => { patches.push(body); Object.assign(configs.find((c) => c.id === id), body); }
  };
}
const config = (extra = {}) => ({ id: 'cfg1', tenant: 'shop-a', setup_status: '', setup_orders: '', setup_paid_at: '', ...extra });
const NOW = new Date('2026-10-27T03:00:00Z');

test('only the owner of a configured workspace can buy; other tenants and missing schema are refused', async () => {
  const pb = fakePb({ configs: [config()], memberships: [{ account: 'acct', tenant: 'shop-a', status: 'active', role: 'owner' }], tenants: { acct: { tenant: 'home' } } });
  const store = createSetupStore({ pb });
  assert.equal(await store.ownsTenant({ id: 'acct', tenant: 'home' }, 'shop-a'), true); // via owner membership
  assert.equal(await store.ownsTenant({ id: 'stranger', tenant: 'x' }, 'shop-a'), false);
  assert.equal(await store.ownsTenant({ id: 'acct', tenant: 'home' }, 'no-config'), false);
  const bare = createSetupStore({ pb: fakePb({ configs: [{ id: 'c', tenant: 'shop-a' }] }) });
  await assert.rejects(bare.ownsTenant({ id: 'acct', tenant: 'shop-a' }, 'shop-a'), /fields missing/);
});

test('binding an order marks pending; payment confirms once, alerts once, and never regresses a later status', async () => {
  const alerts = [];
  const pb = fakePb({ configs: [config()], tenants: { acct: { tenant: 'shop-a' } } });
  const store = createSetupStore({ pb, notify: async (info) => alerts.push(info), now: () => NOW });
  await store.bindSetupOrder('shop-a', ORDER);
  await store.bindSetupOrder('shop-a', ORDER); // idempotent
  assert.equal(pb.configs[0].setup_status, 'pending');
  assert.deepEqual(JSON.parse(pb.configs[0].setup_orders), [ORDER]);
  assert.equal(await store.confirmSetupPaid(OTHER, 'acct'), null); // unbound order
  assert.equal(await store.confirmSetupPaid(ORDER, 'stranger'), null); // not the owner
  assert.deepEqual(await store.confirmSetupPaid(ORDER, 'acct'), { tenant: 'shop-a', status: 'paid' });
  assert.equal(pb.configs[0].setup_paid_at, NOW.toISOString());
  pb.configs[0].setup_status = 'in_progress'; // staff started working
  assert.deepEqual(await store.confirmSetupPaid(ORDER, 'acct'), { tenant: 'shop-a', status: 'in_progress' });
  assert.deepEqual(alerts, [{ tenant: 'shop-a', orderId: ORDER }]);
});

test('a failing alert does not undo the recorded payment', async () => {
  const pb = fakePb({ configs: [config({ setup_status: 'pending', setup_orders: JSON.stringify([ORDER]) })], tenants: { acct: { tenant: 'shop-a' } } });
  const store = createSetupStore({ pb, notify: async () => { throw new Error('telegram down'); } });
  assert.equal((await store.confirmSetupPaid(ORDER, 'acct')).status, 'paid');
  assert.equal(pb.configs[0].setup_status, 'paid');
});

test('reconcile confirms pending workspaces whose order is paid and ignores unpaid ones', async () => {
  const pb = fakePb({ configs: [
    config({ id: 'a', tenant: 'shop-a', setup_status: 'pending', setup_orders: JSON.stringify([ORDER]) }),
    config({ id: 'b', tenant: 'shop-b', setup_status: 'pending', setup_orders: JSON.stringify([OTHER]) })
  ], tenants: { acct: { tenant: 'shop-a' }, acct2: { tenant: 'shop-b' } } });
  const store = createSetupStore({ pb });
  const confirmed = await store.reconcilePending(async (id) => (id === ORDER ? { user_id: 'acct' } : null));
  assert.equal(confirmed, 1);
  assert.deepEqual(pb.configs.map((c) => c.setup_status), ['paid', 'pending']);
});

const env = { BGATE_API_KEY: 'server-secret', BGATE_CATALOG_JSON: JSON.stringify({
  setup: { product: 'schoolsai-setup', kind: 'setup', provider: 'whop', amount: 300, currency: 'USD', label: 'Gói hỗ trợ cài đặt' } }) };
const order = { id: ORDER, user_id: 'acct', product: 'schoolsai-setup', provider: 'whop', amount: '300.00', currency: 'USD', status: 'pending', checkout_url: 'https://pay.test/o' };
const checkout = (body = {}) => new Request('https://app.test/api/account/billing/checkout', {
  method: 'POST', body: JSON.stringify({ plan: 'setup', request_id: 'unique-request-12345', tenant: 'shop-a', ...body }) });

function mockStore(state = '') {
  const calls = { bound: [], confirmed: [] };
  return { calls, ownsTenant: async (account, tenant) => tenant === 'shop-a', setupState: async () => ({ status: state }),
    bindSetupOrder: async (tenant, id) => calls.bound.push([tenant, id]),
    confirmSetupPaid: async (id, accountId) => { calls.confirmed.push([id, accountId]); return { tenant: 'shop-a', status: 'paid' }; } };
}

test('setup checkout is bound to an owned workspace, sends no billing interval, and binds the order', async () => {
  assert.equal(billingCatalog(env).length, 1);
  const store = mockStore();
  let sent;
  const fetchImpl = async (url, options) => { sent = JSON.parse(options.body); return Response.json(order); };
  const res = await handleBGate(checkout(), env, { id: 'acct' }, {}, fetchImpl, store);
  assert.equal(res.status, 200);
  assert.deepEqual(sent, { product: 'schoolsai-setup', user_id: 'acct', provider: 'whop', amount: 300, currency: 'USD' });
  assert.deepEqual(store.calls.bound, [['shop-a', ORDER]]);
});

test('setup checkout refuses foreign workspaces, missing tenant and workspaces that already bought', async () => {
  const provider = async () => { throw new Error('must not reach provider'); };
  assert.equal((await handleBGate(checkout({ tenant: 'victim' }), env, { id: 'acct' }, {}, provider, mockStore())).status, 403);
  assert.equal((await handleBGate(checkout({ tenant: '' }), env, { id: 'acct' }, {}, provider, mockStore())).status, 400);
  assert.equal((await handleBGate(checkout({ tenant: '../x' }), env, { id: 'acct' }, {}, provider, mockStore())).status, 400);
  for (const status of ['paid', 'in_progress', 'done']) {
    assert.equal((await handleBGate(checkout(), env, { id: 'acct' }, {}, provider, mockStore(status))).status, 409);
  }
  assert.equal((await handleBGate(checkout(), env, { id: 'acct' }, {}, provider, null)).status, 403);
});

test('paid setup order is confirmed on the workspace; unpaid or mispriced orders are not', async () => {
  const req = () => new Request(`https://app.test/api/account/billing/payments/${ORDER}`);
  const store = mockStore();
  const data = await (await handleBGate(req(), env, { id: 'acct' }, {}, async () => Response.json({ ...order, status: 'paid' }), store)).json();
  assert.deepEqual([data.service_activated, data.setup_tenant, data.setup_status], [true, 'shop-a', 'paid']);
  for (const changes of [{ status: 'pending' }, { amount: '1.00' }]) {
    const s = mockStore();
    const res = await (await handleBGate(req(), env, { id: 'acct' }, {}, async () => Response.json({ ...order, status: 'paid', ...changes }), s)).json();
    assert.equal(res.service_activated, false);
    assert.deepEqual(s.calls.confirmed, []);
  }
});

test('plans listing exposes the setup kind; status endpoint is owner-only; cron verification checks the catalog', async () => {
  const plans = await (await handleBGate(new Request('https://app.test/api/account/billing/plans'), env, { id: 'acct' }, {})).json();
  assert.deepEqual(plans.plans, [{ id: 'setup', label: 'Gói hỗ trợ cài đặt', amount: 300, currency: 'USD', kind: 'setup' }]);
  const status = (tenant, store) => handleBGate(new Request(`https://app.test/api/account/billing/setup?tenant=${tenant}`), env, { id: 'acct' }, {}, fetch, store);
  assert.deepEqual(await (await status('shop-a', mockStore('paid'))).json(), { tenant: 'shop-a', status: 'paid' });
  assert.equal((await status('victim', mockStore('paid'))).status, 404);
  assert.equal((await fetchPaidSetupOrder(env, ORDER, async () => Response.json({ ...order, status: 'paid' }))).id, ORDER);
  assert.equal(await fetchPaidSetupOrder(env, ORDER, async () => Response.json({ ...order, status: 'paid', amount: '10' })), null);
  assert.equal(await fetchPaidSetupOrder(env, 'not-an-id', fetch), null);
});

test('storage failures (e.g. schema not created yet) fail closed with 503, never 500 or a sale', async () => {
  const broken = { ownsTenant: async () => { throw new Error('bot_configs setup fields missing'); }, setupState: async () => ({ status: '' }) };
  const provider = async () => { throw new Error('must not reach provider'); };
  assert.equal((await handleBGate(checkout(), env, { id: 'acct' }, {}, provider, broken)).status, 503);
  const res = await handleBGate(new Request('https://app.test/api/account/billing/setup?tenant=shop-a'), env, { id: 'acct' }, {}, provider, broken);
  assert.equal(res.status, 503);
});
