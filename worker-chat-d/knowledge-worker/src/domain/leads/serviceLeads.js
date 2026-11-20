// Public lead form of the done-for-you setup service (landing pages VN / ID / PH).
// The browser never decides anything that matters here: it only sends contact details. Payment
// and account creation stay on the existing /api/onboarding/register and /api/account/billing/* routes.
// vn / id / ph: done-for-you chatbot setup pages. gl: the global "AI Social Content" page (social_* plans).
export const SERVICE_MARKETS = ['vn', 'id', 'ph', 'gl'];
export const SERVICE_PLANS = ['setup', 'setup_managed', 'setup_growth', 'social_4', 'social_12', 'social_30', 'social_90', 'unsure'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+0-9][0-9 ()+.-]{6,19}$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{2,39}$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const text = (value, max) => String(value ?? '').replace(CONTROL, '').trim().slice(0, max);

// Returns { ok: true, lead } or { ok: false, fields: [...] }. A filled honeypot returns { spam: true }.
export function cleanServiceLead(body) {
  if (!body || typeof body !== 'object') return { ok: false, fields: ['body'] };
  if (text(body.website, 100)) return { ok: false, spam: true, fields: [] };
  const lead = {
    market: text(body.market, 4).toLowerCase(),
    name: text(body.name, 80),
    email: text(body.email, 254).toLowerCase(),
    phone: text(body.phone, 20),
    business_name: text(body.business_name, 80),
    business_type: text(body.business_type, 80),
    city: text(body.city, 80),
    plan_interest: text(body.plan_interest, 20) || 'unsure',
    message: text(body.message, 1000),
    lang: text(body.lang, 10),
    source: text(body.source, 100),
    tenant: text(body.tenant, 40).toLowerCase(),
    consent: body.consent === true
  };
  const fields = [];
  if (!SERVICE_MARKETS.includes(lead.market)) fields.push('market');
  if (lead.name.length < 2) fields.push('name');
  if (!EMAIL.test(lead.email)) fields.push('email');
  if (lead.phone && !PHONE.test(lead.phone)) fields.push('phone');
  if (lead.business_type.length < 2) fields.push('business_type');
  if (lead.city.length < 2) fields.push('city');
  if (!SERVICE_PLANS.includes(lead.plan_interest)) fields.push('plan_interest');
  if (lead.tenant && !SLUG.test(lead.tenant)) fields.push('tenant');
  if (!lead.consent) fields.push('consent');
  return fields.length ? { ok: false, fields } : { ok: true, lead };
}

// `deps.pb` = { create(collection, record), list(collection, filter, perPage) }; `deps.notify(lead)` is optional.
export async function handleServiceLead(request, cors, deps) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply({ error: 'method' }, 405);
  const raw = await request.text();
  if (raw.length > 8000) return reply({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'invalid', fields: ['body'] }, 400); }
  const cleaned = cleanServiceLead(body);
  // Bots get a normal-looking answer and nothing is stored.
  if (cleaned.spam) return reply({ ok: true });
  if (!cleaned.ok) return reply({ error: 'invalid', fields: cleaned.fields }, 400);
  const { lead } = cleaned;
  try {
    // The same person pressing the button twice must not create two leads or two alerts.
    const esc = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace('T', ' ');
    const recent = await deps.pb.list('service_leads',
      `email='${esc(lead.email)}' && market='${lead.market}' && created>='${since}'`, 1);
    if (recent.length) return reply({ ok: true, duplicate: true, id: recent[0].id });
    const record = await deps.pb.create('service_leads', { ...lead, status: 'new', order_id: '' });
    try { await deps.notify?.(lead); } catch { /* a failed alert must not lose the lead */ }
    return reply({ ok: true, id: record.id }, 201);
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}

// Which Telegram bot and chat get the lead alerts. A dedicated bot (LEADS_TELEGRAM_BOT_TOKEN + LEADS_TELEGRAM_CHAT_ID,
// both required together) wins; otherwise the platform bot and the setup-alert chat that already exist are used, so
// adding the dedicated pair never touches the old configuration. Returns null when nothing is configured.
export function leadAlertTarget(env) {
  if (env.LEADS_TELEGRAM_BOT_TOKEN && env.LEADS_TELEGRAM_CHAT_ID) return { token: env.LEADS_TELEGRAM_BOT_TOKEN, chatId: env.LEADS_TELEGRAM_CHAT_ID };
  if (env.TELEGRAM_BOT_TOKEN && env.SETUP_ALERT_CHAT_ID) return { token: env.TELEGRAM_BOT_TOKEN, chatId: env.SETUP_ALERT_CHAT_ID };
  return null;
}

export function leadAlertText(lead) {
  const plan = { setup: 'Setup', setup_managed: 'Setup + Managed', setup_growth: 'Setup + Growth',
    social_4: 'Social Content 4 bài/tháng', social_12: 'Social Content 12 bài/tháng', social_30: 'Social Content 30 bài/tháng',
    social_90: 'Social Content 90 bài/tháng', unsure: 'chưa chọn' }[lead.plan_interest] || lead.plan_interest;
  return [
    lead.market === 'gl' ? 'Khách mới từ landing AI Social Content (toàn cầu)' : `Khách mới từ landing ${lead.market.toUpperCase()}`,
    `Tên: ${lead.name}`,
    `Email: ${lead.email}${lead.phone ? ` | SĐT: ${lead.phone}` : ''}`,
    `Doanh nghiệp: ${lead.business_name || '(chưa ghi)'} | ${lead.business_type} | ${lead.city}`,
    `Gói quan tâm: ${plan}`,
    lead.tenant ? `Đã tạo workspace: ${lead.tenant}` : 'Chưa tạo tài khoản',
    lead.message ? `Ghi chú: ${lead.message}` : ''
  ].filter(Boolean).join('\n');
}
