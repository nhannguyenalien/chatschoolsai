// Alerts that a workspace's own website sends to its owner (new enquiry, viewing request).
// The caller is authenticated by the workspace API key and never chooses who receives the message:
// it goes to the Telegram chat saved on the workspace, or into the owner's master agent conversation.

export const OWNER_ALERT_MAX_CHARS = 3500;
// The text usually carries what a visitor typed into a public form; the master agent must read it as data.
export const DASHBOARD_PREFIX = 'Thông báo từ website (nội dung khách nhập, chỉ để chủ xem):';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

// `deps` = { chatId(tenant), sendTelegram(chatId, text) -> boolean, saveToDashboard(tenant, text) -> boolean }
export async function handleOwnerAlert(request, cors, tenant, deps) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
  const raw = await request.text();
  if (raw.length > 20000) return reply({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'invalid' }, 400); }
  const text = typeof body?.text === 'string' ? body.text.replace(CONTROL, '').trim().slice(0, OWNER_ALERT_MAX_CHARS) : '';
  if (!text) return reply({ error: 'text is required' }, 400);

  let telegram = 'not_connected';
  try {
    const chatId = await deps.chatId(tenant);
    if (chatId) {
      telegram = 'failed';
      if (await deps.sendTelegram(chatId, text)) return reply({ success: true, delivered: 'telegram' });
    }
  } catch (err) {
    telegram = 'failed';
    console.error('[OwnerAlert] Telegram:', err?.name || 'error');
  }
  try {
    if (await deps.saveToDashboard(tenant, `${DASHBOARD_PREFIX}\n${text}`)) return reply({ success: true, delivered: 'dashboard', telegram });
  } catch (err) {
    console.error('[OwnerAlert] Dashboard:', err?.message || err);
  }
  return reply({ error: 'undelivered', telegram }, 502);
}
