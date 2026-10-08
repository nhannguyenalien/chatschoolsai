import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBGate, handleBGateWebhook, billingCatalog, syncEntitlement } from '../src/domain/billing/bgate.js';
import { effectivePlan, messageLimit, storageLimit, STORAGE_LIMITS } from '../src/domain/billing/accountQuota.js';

const env = { BGATE_API_KEY: 'server-secret', BGATE_CATALOG_JSON: JSON.stringify({
  monthly: { product: 'configured-product', provider: 'whop', amount: 19, currency: 'USD', billing_interval: 'monthly', label: 'Pro tháng' }
}) };
const order = { id: '3e3250c1-bcab-4cc2-aae1-c367df89a584', user_id: 'owner', product: 'configured-product', provider: 'whop', amount: '19.00000000', currency: 'USD', status: 'pending', checkout_url: 'https://pay.test/order' };
const request = (body = {}) => new Request('https://app.test/api/account/billing/checkout', {
  method: 'POST', body: JSON.stringify({ plan: 'monthly', request_id: 'unique-request-12345', ...body })
});

test('checkout binds price and identity to server configuration; retries share idempotency key', async () => {
  const calls = [];
  const provider = async (url, options) => {
    assert.equal(url, 'https://billing.schoolsai.work/api/v1/checkout');
    calls.push(options);
    return Response.json({ ...order, internal_secret: 'hidden' });
  };
  for (let i = 0; i < 2; i++) {
    const response = await handleBGate(request({ amount: 1, user_id: 'victim', provider: 'evil' }), env, { id: 'owner' }, {}, provider);
    assert.deepEqual(await response.json(), { checkout_url: 'https://pay.test/order', order_id: order.id, status: 'pending' });
  }
  assert.deepEqual(JSON.parse(calls[0].body), { product: 'configured-product', user_id: 'owner', provider: 'whop', amount: 19, currency: 'USD', billing_interval: 'monthly', renewal_mode: 'automatic' });
  assert.equal(calls[0].headers['x-api-key'], 'server-secret');
  assert.equal(calls[0].headers['idempotency-key'], calls[1].headers['idempotency-key']);
});

test('missing identity, configuration and malformed requests never reach provider', async () => {
  const provider = async () => { throw new Error('must not call'); };
  for (const [req, settings, account, status] of [
    [request(), env, null, 401], [request(), {}, { id: 'owner' }, 503],
    [request({ plan: 'unknown' }), env, { id: 'owner' }, 400],
    [request({ request_id: '../bad' }), env, { id: 'owner' }, 400]
  ]) assert.equal((await handleBGate(req, settings, account, {}, provider)).status, status);
});

test('provider errors and unsafe or missing redirect URLs fail closed without leaking secrets', async () => {
  for (const response of [Response.json({ secret: 'hidden' }, { status: 500 }),
    Response.json({ checkout_url: 'javascript:alert(1)' }), Response.json({})]) {
    const result = await handleBGate(request(), env, { id: 'owner' }, {}, async () => response);
    assert.equal(result.status, 502);
    assert.doesNotMatch(await result.text(), /hidden|server-secret|javascript/);
  }
});

test('plan listing exposes only display fields, never credentials or internal product configuration', async () => {
  const response = await handleBGate(new Request('https://app.test/api/account/billing/plans'), env, { id: 'owner' }, {});
  assert.deepEqual(await response.json(), { plans: [{ id: 'monthly', label: 'Pro tháng', amount: 19, currency: 'USD' }] });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

const paymentRequest = () => new Request(`https://app.test/api/account/billing/payments/${order.id}`);
test('payment verification requires paid and matching server catalog, without activating service', async () => {
  for (const [changes, verified] of [[{}, false], [{ status: 'paid' }, true],
    [{ status: 'paid', amount: 1 }, false], [{ status: 'paid', product: 'other' }, false]]) {
    const response = await handleBGate(paymentRequest(), env, { id: 'owner' }, {}, async () => Response.json({ ...order, ...changes }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.payment_verified, verified);
    assert.equal(data.service_activated, false); // no store/entitlement: order alone never grants access
  }
});
test('payment lookup rejects another account or substituted order', async () => {
  for (const changes of [{ user_id: 'victim' }, { id: '00000000-0000-0000-0000-000000000000' }]) {
    const response = await handleBGate(paymentRequest(), env, { id: 'owner' }, {}, async () => Response.json({ ...order, ...changes }));
    assert.equal(response.status, 404);
  }
});
test('checkout rejects mismatched identity or price in upstream response', async () => {
  for (const changes of [{ user_id: 'victim' }, { amount: 1 }, { product: 'other' }]) {
    const response = await handleBGate(request(), env, { id: 'owner' }, {}, async () => Response.json({ ...order, ...changes }));
    assert.equal(response.status, 502);
  }
});
test('catalog is Whop-only, recurring and USD; USDT, one-off and unknown providers are dropped', () => {
  const plan = JSON.parse(env.BGATE_CATALOG_JSON).monthly;
  for (const [changes, count] of [[{}, 1], [{ product: 'plan_abc123' }, 1], [{ provider: 'usdt', currency: 'USDT' }, 0],
    [{ provider: 'stripe' }, 0], [{ billing_interval: undefined }, 0], [{ billing_interval: 'weekly' }, 0]]) {
    assert.equal(billingCatalog({ BGATE_CATALOG_JSON: JSON.stringify({ monthly: { ...plan, ...changes } }) }).length, count);
  }
});

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 9, 7);
const memoryStore = (record) => ({
  record: { pro_expires_at: 0, ...record }, writes: [],
  async read() { return { ...this.record }; },
  async write(id, patch) { this.writes.push(patch); Object.assign(this.record, patch); }
});
const entitlement = (body, status = 200) => async (url, options) => {
  assert.match(url, /\/api\/v1\/entitlements\/owner\/configured-product$/);
  assert.equal(options.headers['x-api-key'], 'server-secret');
  return Response.json(body, { status });
};

test('active entitlement grants pro with expiry; repeated sync is idempotent', async () => {
  const store = memoryStore({ id: 'owner', plan_id: 'free' });
  const expires = new Date(NOW + 30 * DAY).toISOString();
  const fetchImpl = entitlement({ active: true, expires_at: expires });
  assert.deepEqual(await syncEntitlement(env, 'owner', store, fetchImpl, NOW), { active: true, expires_at: expires });
  await syncEntitlement(env, 'owner', store, fetchImpl, NOW);
  assert.deepEqual(store.writes, [{ plan_id: 'pro', pro_expires_at: NOW + 30 * DAY }]);
});

test('inactive or already expired entitlement never grants pro; lapsed billing-managed pro is downgraded', async () => {
  for (const body of [{ active: false, expires_at: null }, { active: true, expires_at: new Date(NOW - DAY).toISOString() }]) {
    const store = memoryStore({ id: 'owner', plan_id: 'free' });
    assert.equal((await syncEntitlement(env, 'owner', store, entitlement(body), NOW)).active, false);
    assert.deepEqual(store.writes, []);
  }
  const lapsed = memoryStore({ id: 'owner', plan_id: 'pro', pro_expires_at: NOW - DAY });
  await syncEntitlement(env, 'owner', lapsed, entitlement({ active: false }, 200), NOW);
  assert.deepEqual(lapsed.writes, [{ plan_id: 'free', pro_expires_at: 0 }]);
  const manual = memoryStore({ id: 'owner', plan_id: 'pro' }); // admin-granted, no expiry: untouched
  await syncEntitlement(env, 'owner', manual, entitlement({}, 404), NOW);
  assert.deepEqual(manual.writes, []);
});

test('refuses to grant pro while the pro_expires_at schema field is missing', async () => {
  const store = { writes: [], async read() { return { id: 'owner', plan_id: 'free' }; }, async write(id, patch) { this.writes.push(patch); } };
  await assert.rejects(syncEntitlement(env, 'owner', store, entitlement({ active: true, expires_at: NOW + DAY }), NOW), /field missing/);
  assert.deepEqual(store.writes, []);
});

test('entitlement lookup failure or foreign record fails closed without writing', async () => {
  const store = memoryStore({ id: 'owner', plan_id: 'free' });
  await assert.rejects(syncEntitlement(env, 'owner', store, entitlement({}, 500), NOW));
  await assert.rejects(syncEntitlement(env, 'owner', memoryStore({ id: 'other' }), entitlement({ active: true, expires_at: NOW + DAY }), NOW));
  assert.deepEqual(store.writes, []);
});

test('verified payment activates pro through the entitlement and reports the expiry', async () => {
  const store = memoryStore({ id: 'owner', plan_id: 'free' });
  const expires = NOW + 30 * DAY;
  const fetchImpl = async (url, options) => url.includes('/payments/')
    ? Response.json({ ...order, status: 'paid' }) : entitlement({ active: true, expires_at: expires })(url, options);
  const data = await (await handleBGate(paymentRequest(), env, { id: 'owner' }, {}, fetchImpl, store)).json();
  assert.equal(data.service_activated, true);
  assert.equal(store.record.plan_id, 'pro');
  // Paid order but no entitlement yet: not activated.
  const pending = memoryStore({ id: 'owner', plan_id: 'free' });
  const lagging = async (url, options) => url.includes('/payments/')
    ? Response.json({ ...order, status: 'paid' }) : entitlement({ active: false })(url, options);
  const result = await (await handleBGate(paymentRequest(), env, { id: 'owner' }, {}, lagging, pending)).json();
  assert.equal(result.service_activated, false);
  assert.deepEqual(pending.writes, []);
});

const SECRET = 'whsec-test';
async function signed(body, { timestamp = String(NOW), secret = SECRET } = {}) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  return new Request('https://app.test/api/billing/bgate-webhook', { method: 'POST', body, headers: {
    'x-bgate-timestamp': timestamp, 'x-bgate-signature': [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('') } });
}
const hookEnv = { ...env, BGATE_WEBHOOK_SECRET: SECRET };

test('webhook requires a valid signature and fresh timestamp, then re-reads the entitlement', async () => {
  const body = JSON.stringify({ type: 'subscription.renewed', user_id: 'owner' });
  const store = memoryStore({ id: 'owner', plan_id: 'free' });
  const fetchImpl = entitlement({ active: true, expires_at: NOW + 30 * DAY });
  assert.equal((await handleBGateWebhook(await signed(body), hookEnv, store, fetchImpl, NOW)).status, 200);
  assert.equal(store.record.plan_id, 'pro');
  const bad = [await signed(body, { secret: 'wrong' }), await signed(body, { timestamp: String(NOW - 6 * 60 * 1000) }),
    new Request('https://app.test/x', { method: 'POST', body })];
  for (const req of bad) assert.equal((await handleBGateWebhook(req, hookEnv, memoryStore({ id: 'owner' }), fetchImpl, NOW)).status, 401);
  assert.equal((await handleBGateWebhook(await signed(body), env, store, fetchImpl, NOW)).status, 503);
});

test('webhook payload cannot grant access by itself and sync errors trigger a retry', async () => {
  const body = JSON.stringify({ user_id: 'owner', active: true, plan_id: 'pro' });
  const store = memoryStore({ id: 'owner', plan_id: 'free' });
  await handleBGateWebhook(await signed(body), hookEnv, store, entitlement({ active: false }), NOW);
  assert.deepEqual(store.writes, []);
  assert.equal((await handleBGateWebhook(await signed(body), hookEnv, store, entitlement({}, 500), NOW)).status, 500);
});

test('plan expiry lowers message and storage limits for billing-managed accounts only', () => {
  const pro = { plan_id: 'pro', pro_expires_at: NOW + DAY, message_limit: 100 };
  assert.equal(effectivePlan(pro, NOW), 'pro');
  assert.equal(messageLimit(pro, NOW), 1000); // stale override ignored while billing-managed
  assert.equal(storageLimit(pro, NOW), STORAGE_LIMITS.pro);
  const expired = { ...pro, pro_expires_at: NOW - 1 };
  assert.equal(effectivePlan(expired, NOW), 'free');
  assert.equal(messageLimit(expired, NOW), 100);
  assert.equal(effectivePlan({ plan_id: 'pro' }, NOW), 'pro'); // admin-granted, no expiry
  assert.equal(messageLimit({ plan_id: 'pro', message_limit: 5000 }, NOW), 5000);
  assert.equal(messageLimit({ plan_id: 'free' }, NOW), 100);
});

const addonEnv = { ...env, BGATE_CATALOG_JSON: JSON.stringify({
  addon: { product: 'schoolsai-messages-1000', kind: 'addon', provider: 'whop', amount: 7, currency: 'USD', label: 'Thêm 1.000 câu' } }) };
const addonOrder = { ...order, product: 'schoolsai-messages-1000', amount: '7.00', status: 'paid' };

test('add-on is a one-off Whop product: no interval or renewal is sent and none is allowed in the catalog', async () => {
  assert.equal(billingCatalog(addonEnv).length, 1);
  assert.equal(billingCatalog({ BGATE_CATALOG_JSON: JSON.stringify({ addon: { ...JSON.parse(addonEnv.BGATE_CATALOG_JSON).addon, billing_interval: 'monthly' } }) }).length, 0);
  let sent;
  await handleBGate(request({ plan: 'addon' }), addonEnv, { id: 'owner' }, {}, async (url, options) => {
    sent = JSON.parse(options.body); return Response.json({ ...addonOrder, status: 'pending' });
  });
  assert.deepEqual(sent, { product: 'schoolsai-messages-1000', user_id: 'owner', provider: 'whop', amount: 7, currency: 'USD' });
});

test('paid add-on credits 1000 messages exactly once per order, however often it is checked', async () => {
  const store = memoryStore({ id: 'owner', plan_id: 'free', message_bonus_granted: 0, message_bonus_used: 0, bonus_orders: '' });
  const fetchImpl = async () => Response.json(addonOrder);
  for (let i = 0; i < 3; i++) {
    const data = await (await handleBGate(paymentRequest(), addonEnv, { id: 'owner' }, {}, fetchImpl, store)).json();
    assert.equal(data.credited_messages, 1000);
  }
  assert.equal(store.record.message_bonus_granted, 1000);
  const second = { ...addonOrder, id: '11111111-1111-1111-1111-111111111111' };
  await handleBGate(new Request(`https://app.test/api/account/billing/payments/${second.id}`), addonEnv, { id: 'owner' }, {}, async () => Response.json(second), store);
  assert.equal(store.record.message_bonus_granted, 2000);
});

test('unpaid, wrong-price or foreign add-on orders never credit; missing schema fields fail closed', async () => {
  for (const changes of [{ status: 'pending' }, { amount: '1.00' }, { user_id: 'victim' }]) {
    const store = memoryStore({ id: 'owner', message_bonus_granted: 0, bonus_orders: '' });
    await handleBGate(paymentRequest(), addonEnv, { id: 'owner' }, {}, async () => Response.json({ ...addonOrder, ...changes }), store);
    assert.deepEqual(store.writes, []);
  }
  const bare = { writes: [], async read() { return { id: 'owner' }; }, async write(id, patch) { this.writes.push(patch); } };
  const res = await handleBGate(paymentRequest(), addonEnv, { id: 'owner' }, {}, async () => Response.json(addonOrder), bare);
  assert.equal(res.status, 502);
  assert.deepEqual(bare.writes, []);
});
