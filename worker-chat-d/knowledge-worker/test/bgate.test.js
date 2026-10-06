import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBGate, billingCatalog } from '../src/domain/billing/bgate.js';

const env = { BGATE_API_KEY: 'server-secret', BGATE_CATALOG_JSON: JSON.stringify({
  monthly: { product: 'configured-product', provider: 'usdt', amount: 19, currency: 'USDT', label: 'Pro tháng' }
}) };
const order = { id: '3e3250c1-bcab-4cc2-aae1-c367df89a584', user_id: 'owner', product: 'configured-product', provider: 'usdt', amount: '19.00000000', currency: 'USDT', status: 'pending', checkout_url: 'https://pay.test/order' };
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
  assert.deepEqual(JSON.parse(calls[0].body), { product: 'configured-product', user_id: 'owner', provider: 'usdt', amount: 19, currency: 'USDT' });
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
  assert.deepEqual(await response.json(), { plans: [{ id: 'monthly', label: 'Pro tháng', amount: 19, currency: 'USDT' }] });
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
    assert.equal(data.service_activated, false);
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
test('catalog accepts application product codes for USDT and Whop', () => {
  const plan = JSON.parse(env.BGATE_CATALOG_JSON).monthly;
  for (const [provider, product, count] of [['usdt', 'my-custom-product', 1], ['whop', 'custom', 1],
    ['whop', 'plan_abc123', 1], ['whop', 'prod_abc123', 1], ['stripe', 'prod_abc', 0]]) {
    assert.equal(billingCatalog({ BGATE_CATALOG_JSON: JSON.stringify({ monthly: { ...plan, provider, product } }) }).length, count);
  }
});
