import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanServiceLead, handleServiceLead, leadAlertTarget, leadAlertText } from '../src/domain/leads/serviceLeads.js';
import { handleBGate, billingCatalog } from '../src/domain/billing/bgate.js';

const valid = {
  market: 'vn', name: 'Lan Nguyen', email: 'Lan@Example.com', phone: '+84 912 345 678', business_name: 'Lan Nails',
  business_type: 'Tiệm nail', city: 'Cần Thơ', plan_interest: 'setup_managed', message: 'Cần gấp', lang: 'vi',
  source: 'fb_ads', consent: true, website: ''
};
const post = (body) => new Request('https://app.test/api/public/service-leads', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const memory = () => {
  const rows = [];
  return { rows, pb: {
    list: async () => rows.filter((row) => Date.now() - row.at < 10 * 60 * 1000 && row.email === memory.lastEmail),
    create: async (collection, record) => { assert.equal(collection, 'service_leads'); const row = { id: `rec${rows.length + 1}`, at: Date.now(), ...record }; rows.push(row); return row; }
  } };
};

test('a valid lead is normalised and stored as new', async () => {
  const cleaned = cleanServiceLead(valid);
  assert.equal(cleaned.ok, true);
  assert.equal(cleaned.lead.email, 'lan@example.com');
  const store = memory(); memory.lastEmail = 'lan@example.com';
  const alerts = [];
  const response = await handleServiceLead(post(valid), {}, { pb: store.pb, notify: async (lead) => alerts.push(lead) });
  assert.equal(response.status, 201);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].status, 'new');
  assert.equal(store.rows[0].market, 'vn');
  assert.equal(alerts.length, 1);
});

test('invalid input names the failing fields and stores nothing', async () => {
  const store = memory();
  for (const [patch, field] of [
    [{ email: 'nope' }, 'email'], [{ name: 'x' }, 'name'], [{ market: 'us' }, 'market'], [{ consent: false }, 'consent'],
    [{ consent: 'true' }, 'consent'], [{ phone: 'abc' }, 'phone'], [{ city: '' }, 'city'], [{ business_type: '' }, 'business_type'],
    [{ plan_interest: 'free-forever' }, 'plan_interest'], [{ tenant: '../x' }, 'tenant']
  ]) {
    const response = await handleServiceLead(post({ ...valid, ...patch }), {}, { pb: store.pb });
    assert.equal(response.status, 400, field);
    assert.ok((await response.json()).fields.includes(field), field);
  }
  assert.equal((await handleServiceLead(post('not json'), {}, { pb: store.pb })).status, 400);
  assert.equal(store.rows.length, 0);
});

test('honeypot hits look successful but are never stored or alerted', async () => {
  const store = memory(); const alerts = [];
  const response = await handleServiceLead(post({ ...valid, website: 'http://spam.test' }), {}, { pb: store.pb, notify: async (l) => alerts.push(l) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(store.rows.length + alerts.length, 0);
});

test('a repeated submit inside ten minutes is not stored or alerted twice', async () => {
  const store = memory(); memory.lastEmail = 'lan@example.com'; const alerts = [];
  const deps = { pb: store.pb, notify: async (l) => alerts.push(l) };
  assert.equal((await handleServiceLead(post(valid), {}, deps)).status, 201);
  const second = await handleServiceLead(post(valid), {}, deps);
  assert.equal(second.status, 200);
  assert.equal((await second.json()).duplicate, true);
  assert.equal(store.rows.length, 1);
  assert.equal(alerts.length, 1);
});

test('storage or alert failures: missing collection is a 503, a failed alert keeps the lead', async () => {
  const broken = { list: async () => { throw new Error('404'); }, create: async () => { throw new Error('404'); } };
  assert.equal((await handleServiceLead(post(valid), {}, { pb: broken })).status, 503);
  const store = memory(); memory.lastEmail = 'none';
  const response = await handleServiceLead(post(valid), {}, { pb: store.pb, notify: async () => { throw new Error('telegram down'); } });
  assert.equal(response.status, 201);
  assert.equal(store.rows.length, 1);
});

test('oversized bodies and wrong methods are refused', async () => {
  const store = memory();
  assert.equal((await handleServiceLead(post({ ...valid, message: 'x'.repeat(9000) }), {}, { pb: store.pb })).status, 413);
  assert.equal((await handleServiceLead(new Request('https://app.test/x', { method: 'GET' }), {}, { pb: store.pb })).status, 405);
});

test('control characters are stripped and text fields are length-limited', () => {
  const cleaned = cleanServiceLead({ ...valid, name: 'Lan\u0000 Nguyen', message: 'a'.repeat(5000) });
  assert.equal(cleaned.lead.name, 'Lan Nguyen');
  assert.equal(cleaned.lead.message.length, 1000);
});

test('alert text carries the contact and plan without secrets', () => {
  const body = leadAlertText({ ...cleanServiceLead(valid).lead, tenant: 'lan-nails-ab12' });
  assert.match(body, /VN/);
  assert.match(body, /Setup \+ Managed/);
  assert.match(body, /lan@example\.com/);
  assert.match(body, /lan-nails-ab12/);
});

test('the global AI Social Content page: gl market and social_* plans are accepted, unknown ones are not', async () => {
  const store = memory(); memory.lastEmail = 'none'; const alerts = [];
  for (const plan of ['social_4', 'social_12', 'social_30', 'social_90']) {
    const body = { ...valid, email: `${plan}@example.com`, market: 'gl', plan_interest: plan };
    const response = await handleServiceLead(post(body), {}, { pb: store.pb, notify: async (lead) => alerts.push(lead) });
    assert.equal(response.status, 201, plan);
  }
  assert.equal(store.rows.length, 4);
  assert.deepEqual(store.rows.map((row) => row.market), ['gl', 'gl', 'gl', 'gl']);
  assert.equal((await handleServiceLead(post({ ...valid, market: 'gl', plan_interest: 'social_5' }), {}, { pb: store.pb })).status, 400);
  const text = leadAlertText(alerts[2]);
  assert.match(text, /AI Social Content/);
  assert.match(text, /30 bài\/tháng/);
  assert.doesNotMatch(text, /landing GL/);
});

test('lead alerts: a dedicated bot needs both its token and chat; otherwise the existing setup-alert pair is used', () => {
  const old = { TELEGRAM_BOT_TOKEN: 'old-token', SETUP_ALERT_CHAT_ID: '111' };
  assert.equal(leadAlertTarget({}), null);
  assert.deepEqual(leadAlertTarget(old), { token: 'old-token', chatId: '111' });
  assert.deepEqual(leadAlertTarget({ ...old, LEADS_TELEGRAM_BOT_TOKEN: 'new-token', LEADS_TELEGRAM_CHAT_ID: '222' }), { token: 'new-token', chatId: '222' });
  // Only half of the dedicated pair: never mix the new token with the old chat (or the other way round).
  assert.deepEqual(leadAlertTarget({ ...old, LEADS_TELEGRAM_BOT_TOKEN: 'new-token' }), { token: 'old-token', chatId: '111' });
  assert.deepEqual(leadAlertTarget({ ...old, LEADS_TELEGRAM_CHAT_ID: '222' }), { token: 'old-token', chatId: '111' });
  assert.deepEqual(leadAlertTarget({ LEADS_TELEGRAM_BOT_TOKEN: 'new-token', LEADS_TELEGRAM_CHAT_ID: '222' }), { token: 'new-token', chatId: '222' });
  assert.equal(leadAlertTarget({ LEADS_TELEGRAM_BOT_TOKEN: 'new-token' }), null);
});

// ---- payment catalog: landing-page offers are tagged with a market ----
const env = { BGATE_API_KEY: 'server-secret', BGATE_CATALOG_JSON: JSON.stringify({
  monthly: { product: 'pro-m', provider: 'whop', amount: 19, currency: 'USD', billing_interval: 'monthly', label: 'Pro tháng' },
  setup: { product: 'setup-global', provider: 'whop', amount: 300, currency: 'USD', kind: 'setup', label: 'Setup' },
  setup_vn: { product: 'setup-vn', provider: 'whop', amount: 100, currency: 'USD', kind: 'setup', market: 'vn', label: 'Setup VN' },
  setup_id: { product: 'setup-id', provider: 'whop', amount: 100, currency: 'USD', kind: 'setup', market: 'id', label: 'Setup ID' },
  bad_market: { product: 'setup-xx', provider: 'whop', amount: 100, currency: 'USD', kind: 'setup', market: 'xx', label: 'Bad' }
}) };
const plansFor = async (query) => (await (await handleBGate(
  new Request(`https://app.test/api/account/billing/plans${query}`), env, { id: 'owner' }, {}, async () => { throw new Error('no network'); })).json()).plans.map((p) => p.id);

test('market plans are hidden from the dashboard list and only shown for their own market', async () => {
  assert.deepEqual(await plansFor(''), ['monthly', 'setup']);
  assert.deepEqual(await plansFor('?market=vn'), ['monthly', 'setup', 'setup_vn']);
  assert.deepEqual(await plansFor('?market=id'), ['monthly', 'setup', 'setup_id']);
  assert.deepEqual(await plansFor('?market=ph'), ['monthly', 'setup']);
  assert.ok(!billingCatalog(env).some((plan) => plan.id === 'bad_market'), 'unknown market is rejected');
});

test('a market setup plan binds price, product and workspace like the global one', async () => {
  const calls = [];
  const provider = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: '3e3250c1-bcab-4cc2-aae1-c367df89a584', user_id: 'owner', product: 'setup-vn', provider: 'whop', amount: '100.0', currency: 'USD', status: 'pending', checkout_url: 'https://pay.test/o' });
  };
  const store = { ownsTenant: async () => true, setupState: async () => ({ status: '' }), bindSetupOrder: async (tenant, orderId) => calls.push({ bound: [tenant, orderId] }) };
  const request = new Request('https://app.test/api/account/billing/checkout', { method: 'POST',
    body: JSON.stringify({ plan: 'setup_vn', tenant: 'lan-nails-ab12', request_id: 'unique-request-12345', amount: 1, product: 'evil' }) });
  const response = await handleBGate(request, env, { id: 'owner' }, {}, provider, store);
  assert.equal(response.status, 200);
  const sent = JSON.parse(calls[0].options.body);
  assert.deepEqual(sent, { product: 'setup-vn', user_id: 'owner', provider: 'whop', amount: 100, currency: 'USD' });
  assert.deepEqual(calls[1].bound, ['lan-nails-ab12', '3e3250c1-bcab-4cc2-aae1-c367df89a584']);
});
