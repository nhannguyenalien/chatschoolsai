// BGate credentials and catalog are server-only. Never accept prices or account IDs
// from the browser. Whop only; BGate accepts application-defined product codes.
const BASE_URL = 'https://billing.schoolsai.work';

const INTERVALS = ['monthly', 'yearly'];

// Whop only. Subscriptions (billing_interval) derive access from the BGate entitlement, which
// carries the expiry. The add-on (kind: 'addon') is a one-off order credited once per order id.
export const ADDON_MESSAGES = 1000;
const MAX_ADDON_ORDERS = 200;
export function billingCatalog(env) {
  const catalog = JSON.parse(env.BGATE_CATALOG_JSON || '{}');
  return Object.entries(catalog).flatMap(([id, plan]) => {
    if (!/^[a-z0-9_-]+$/.test(id) || typeof plan?.product !== 'string' || !plan.product ||
        plan.provider !== 'whop' || plan.currency !== 'USD' ||
        (plan.kind === 'addon' ? plan.billing_interval !== undefined : !INTERVALS.includes(plan.billing_interval)) ||
        !Number.isFinite(plan.amount) || plan.amount <= 0 || !plan.label) return [];
    return [{ ...plan, id }];
  });
}

function parseExpiry(value) {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

// BGate's entitlement is the only proof of access. Mirrors it onto the account record
// (plan_id + pro_expires_at) so the hot quota path never calls BGate. Idempotent, so it is safe
// to run from polling, the webhook and the lazy refresh at the same time.
export async function syncEntitlement(env, accountId, store, fetchImpl = fetch, now = Date.now()) {
  if (!env.BGATE_API_KEY) throw new Error('BGate not configured');
  const products = [...new Set(billingCatalog(env).filter(plan => plan.kind !== 'addon').map(plan => plan.product))];
  let expiresAt = 0;
  for (const product of products) {
    const response = await fetchImpl(`${BASE_URL}/api/v1/entitlements/${encodeURIComponent(accountId)}/${encodeURIComponent(product)}`, {
      headers: { 'x-api-key': env.BGATE_API_KEY }, signal: AbortSignal.timeout(20000)
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Entitlement lookup failed (${response.status})`);
    const entitlement = await response.json();
    const expiry = parseExpiry(entitlement.expires_at);
    if (entitlement.active === true && expiry > now) expiresAt = Math.max(expiresAt, expiry);
  }
  const record = await store.read(accountId);
  if (record.id !== accountId) throw new Error('Account mismatch');
  // PocketBase silently drops unknown fields: without the schema field the grant would never expire.
  if (!('pro_expires_at' in record)) throw new Error('tenants.pro_expires_at field missing');
  const current = Number(record.pro_expires_at) || 0;
  if (expiresAt) {
    if (record.plan_id !== 'pro' || current !== expiresAt) {
      await store.write(accountId, { plan_id: 'pro', pro_expires_at: expiresAt });
    }
  } else if (record.plan_id === 'pro' && current) {
    // Only billing-managed pro (pro_expires_at set) is ever downgraded here.
    await store.write(accountId, { plan_id: 'free', pro_expires_at: 0 });
  }
  return { active: Boolean(expiresAt), expires_at: expiresAt ? new Date(expiresAt).toISOString() : null };
}

// Credits one paid add-on order exactly once per order id (replays and concurrent polls of the
// same order write identical values).
export async function grantAddon(accountId, orderId, store) {
  const record = await store.read(accountId);
  if (record.id !== accountId) throw new Error('Account mismatch');
  if (!('message_bonus_granted' in record) || !('bonus_orders' in record)) throw new Error('tenants add-on fields missing');
  let orders;
  try { orders = JSON.parse(record.bonus_orders || '[]'); } catch { throw new Error('Invalid bonus_orders'); }
  if (!Array.isArray(orders)) throw new Error('Invalid bonus_orders');
  if (!orders.includes(orderId)) {
    orders = [...orders, orderId].slice(-MAX_ADDON_ORDERS);
    // The id list is the replay guard; granted is the running total of credited orders.
    await store.write(accountId, { bonus_orders: JSON.stringify(orders),
      message_bonus_granted: (Number(record.message_bonus_granted) || 0) + ADDON_MESSAGES });
  }
  return { credited: true, messages: ADDON_MESSAGES };
}

const hex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');

// HMAC-SHA256 over `timestamp.raw_body`, five-minute window. The event only triggers an
// entitlement re-read; nothing in the payload is trusted for access.
export async function handleBGateWebhook(request, env, store, fetchImpl = fetch, now = Date.now()) {
  const reply = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (!env.BGATE_WEBHOOK_SECRET || !env.BGATE_API_KEY) return reply({ error: 'Webhook not configured' }, 503);
  const raw = await request.text();
  const timestamp = request.headers.get('x-bgate-timestamp') || '';
  const signature = (request.headers.get('x-bgate-signature') || '').replace(/^sha256=/i, '').toLowerCase();
  const sentAt = parseExpiry(/^\d+$/.test(timestamp) ? Number(timestamp) : timestamp);
  if (!sentAt || Math.abs(now - sentAt) > 5 * 60 * 1000) return reply({ error: 'Invalid timestamp' }, 401);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.BGATE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`)));
  let diff = expected.length ^ signature.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (signature.charCodeAt(i) || 0);
  if (diff !== 0) return reply({ error: 'Invalid signature' }, 401);
  let event;
  try { event = JSON.parse(raw); } catch { return reply({ error: 'Invalid body' }, 400); }
  const userId = event?.user_id ?? event?.data?.user_id ?? event?.data?.object?.user_id;
  if (typeof userId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return reply({ ok: true, ignored: true }, 200);
  try { await syncEntitlement(env, userId, store, fetchImpl, now); }
  catch { return reply({ error: 'Sync failed' }, 500); } // non-2xx makes BGate retry
  return reply({ ok: true }, 200);
}

export async function handleBGate(request, env, account, cors, fetchImpl = fetch, store = null) {
  const reply = (body, status = 200) => Response.json(body, {
    status, headers: { ...cors, 'Cache-Control': 'no-store' }
  });
  if (!account?.id) return reply({ error: 'Vui lòng đăng nhập lại.' }, 401);
  const path = new URL(request.url).pathname;
  let catalog;
  try { catalog = billingCatalog(env); }
  catch { return reply({ error: 'Cấu hình thanh toán chưa hợp lệ.' }, 503); }
  if (path === '/api/account/billing/plans' && request.method === 'GET') {
    return reply({ plans: env.BGATE_API_KEY ? catalog.map(({ id, label, amount, currency }) => ({ id, label, amount, currency })) : [] });
  }
  if (path === '/api/account/billing/status' && request.method === 'GET') {
    if (!env.BGATE_API_KEY || !store) return reply({ error: 'Thanh toán chưa được cấu hình.' }, 503);
    try { return reply(await syncEntitlement(env, account.id, store, fetchImpl)); }
    catch { return reply({ error: 'Không kiểm tra được gói dịch vụ.' }, 502); }
  }
  const paymentMatch = path.match(/^\/api\/account\/billing\/payments\/([a-f0-9-]{36})$/i);
  if (paymentMatch && request.method === 'GET') {
    if (!env.BGATE_API_KEY) return reply({ error: 'Thanh toán chưa được cấu hình.' }, 503);
    try {
      // BGate reconciles USDT on this GET. Never trust a success redirect.
      const response = await fetchImpl(`${BASE_URL}/api/v1/payments/${paymentMatch[1]}`, {
        headers: { 'x-api-key': env.BGATE_API_KEY }, signal: AbortSignal.timeout(20000)
      });
      const order = await response.json();
      if (!response.ok) return reply({ error: 'Không kiểm tra được giao dịch.' }, 502);
      if (order.user_id !== account.id || order.id !== paymentMatch[1]) {
        return reply({ error: 'Không tìm thấy giao dịch.' }, 404);
      }
      const plan = catalog.find(item => item.product === order.product && item.provider === order.provider &&
        item.currency === order.currency && item.amount === Number(order.amount));
      const verified = order.status === 'paid' && Boolean(plan);
      // Pro is granted only by the entitlement BGate recorded for this account, never by the order alone.
      if (verified && store && plan.kind === 'addon') {
        const grant = await grantAddon(account.id, order.id, store);
        return reply({ order_id: order.id, status: order.status, payment_verified: true,
          service_activated: grant.credited, credited_messages: grant.messages });
      }
      const entitlement = verified && store ? await syncEntitlement(env, account.id, store, fetchImpl) : null;
      return reply({ order_id: order.id, status: order.status, payment_verified: verified,
        service_activated: Boolean(entitlement?.active), expires_at: entitlement?.expires_at ?? null });
    } catch { return reply({ error: 'Không kết nối được cổng thanh toán.' }, 502); }
  }
  if (path !== '/api/account/billing/checkout') return reply({ error: 'Not found' }, 404);
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (!env.BGATE_API_KEY || !catalog.length) return reply({ error: 'Thanh toán đang chờ cấu hình gói dịch vụ.' }, 503);
  const body = await request.json().catch(() => null);
  const plan = catalog.find(item => item.id === body?.plan);
  if (!plan || !/^[a-zA-Z0-9_-]{16,80}$/.test(body?.request_id || '')) {
    return reply({ error: 'Gói dịch vụ hoặc mã giao dịch không hợp lệ.' }, 400);
  }
  try {
    const response = await fetchImpl(`${BASE_URL}/api/v1/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.BGATE_API_KEY,
        'idempotency-key': `${account.id}:${plan.id}:${body.request_id}` },
      body: JSON.stringify({ product: plan.product, user_id: account.id,
        provider: plan.provider, amount: plan.amount, currency: plan.currency,
        ...(plan.kind === 'addon' ? {} : { billing_interval: plan.billing_interval, renewal_mode: 'automatic' }) }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await response.json().catch(() => null);
    // Do not relay upstream errors: they can contain provider credentials or payloads.
    if (!response.ok) return reply({ error: 'Cổng thanh toán chưa tạo được giao dịch. Vui lòng thử lại.' }, 502);
    const checkoutUrl = new URL(data?.checkout_url);
    if (checkoutUrl.protocol !== 'https:' || checkoutUrl.username || checkoutUrl.password) throw new Error('Invalid checkout URL');
    if (!/^[a-f0-9-]{36}$/i.test(data?.id || '') || data.user_id !== account.id ||
        data.product !== plan.product || data.provider !== plan.provider ||
        data.currency !== plan.currency || Number(data.amount) !== plan.amount) throw new Error('Checkout mismatch');
    return reply({ checkout_url: checkoutUrl.href, order_id: data.id, status: data.status });
  } catch {
    return reply({ error: 'Không kết nối được cổng thanh toán. Vui lòng thử lại cùng giao dịch.' }, 502);
  }
}
