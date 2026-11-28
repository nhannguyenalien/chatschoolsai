import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { handleOwnerAlert, OWNER_ALERT_MAX_CHARS, DASHBOARD_PREFIX } from '../src/domain/leads/ownerAlerts.js';

const post = (body) => new Request('https://api.test/api/v1/owner-alert', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const deps = ({ chatId = '123', telegramOk = true, saved = true } = {}) => {
  const calls = { telegram: [], dashboard: [] };
  return {
    calls,
    chatId: async () => chatId,
    sendTelegram: async (id, text) => { calls.telegram.push({ id, text }); return telegramOk; },
    saveToDashboard: async (tenant, text) => { calls.dashboard.push({ tenant, text }); return saved; }
  };
};

test('an alert goes to the saved Telegram chat only', async () => {
  const d = deps();
  const response = await handleOwnerAlert(post({ text: 'Khách mới', chatId: '999' }), {}, 'shop', d);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, delivered: 'telegram' });
  assert.deepEqual(d.calls.telegram, [{ id: '123', text: 'Khách mới' }]);
  assert.equal(d.calls.dashboard.length, 0);
});

test('without a working chat the alert is saved for the owner in the dashboard', async () => {
  for (const [options, telegram] of [[{ chatId: '' }, 'not_connected'], [{ telegramOk: false }, 'failed']]) {
    const d = deps(options);
    const response = await handleOwnerAlert(post({ text: 'Khách mới' }), {}, 'shop', d);
    assert.deepEqual(await response.json(), { success: true, delivered: 'dashboard', telegram });
    assert.equal(d.calls.dashboard[0].tenant, 'shop');
    assert.ok(d.calls.dashboard[0].text.startsWith(DASHBOARD_PREFIX));
  }
});

test('an alert that cannot be delivered is reported, and bad input is refused', async () => {
  assert.equal((await handleOwnerAlert(post({ text: 'x' }), {}, 'shop', deps({ chatId: '', saved: false }))).status, 502);
  for (const body of ['not json', {}, { text: '   ' }, { text: 5 }]) {
    const d = deps();
    assert.equal((await handleOwnerAlert(post(body), {}, 'shop', d)).status, 400);
    assert.equal(d.calls.telegram.length + d.calls.dashboard.length, 0);
  }
  assert.equal((await handleOwnerAlert(post({ text: 'x'.repeat(30000) }), {}, 'shop', deps())).status, 413);
  const d = deps();
  await handleOwnerAlert(post({ text: 'x'.repeat(OWNER_ALERT_MAX_CHARS + 50) }), {}, 'shop', d);
  assert.equal(d.calls.telegram[0].text.length, OWNER_ALERT_MAX_CHARS);
});

test('the route needs the workspace API key and uses that workspace\'s chat', async (t) => {
  const env = { PB_URL: 'https://pb.test', PB_ADMIN_EMAIL: 'a@example.com', PB_ADMIN_PASS: 'x', TELEGRAM_BOT_TOKEN: 'bot' };
  const sent = [];
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === 'api.telegram.org') { sent.push(JSON.parse(init.body)); return Response.json({ ok: true }); }
    if (url.pathname.includes('auth-with-password')) return Response.json({ token: 'pb' });
    const filter = url.searchParams.get('filter') || '';
    if (url.pathname.includes('/bot_configs/records')) return Response.json({ items: filter.includes("api_key='good'") ? [{ tenant: 'shop', owner_telegram_chat_id: '555' }] : [] });
    return Response.json({ items: [] });
  };
  const call = (key) => worker.fetch(new Request('https://api.test/api/v1/owner-alert', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: JSON.stringify({ text: 'Khách mới' }) }), env, { waitUntil() {} });
  assert.equal((await call('wrong')).status, 401);
  assert.equal(sent.length, 0);
  const response = await call('good');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, delivered: 'telegram' });
  assert.deepEqual(sent, [{ chat_id: '555', text: 'Khách mới', disable_web_page_preview: true }]);
});
