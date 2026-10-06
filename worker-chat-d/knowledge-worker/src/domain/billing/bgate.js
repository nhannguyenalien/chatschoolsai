// BGate credentials and catalog are server-only. Never accept prices or account IDs
// from the browser. USDT and Whop both accept application-defined product codes.
const BASE_URL = 'https://billing.schoolsai.work';

export function billingCatalog(env) {
  const catalog = JSON.parse(env.BGATE_CATALOG_JSON || '{}');
  return Object.entries(catalog).flatMap(([id, plan]) => {
    if (!/^[a-z0-9_-]+$/.test(id) || typeof plan?.product !== 'string' || !plan.product ||
        !['usdt', 'whop'].includes(plan.provider) ||
        !['USD', 'USDT'].includes(plan.currency) || !Number.isFinite(plan.amount) || plan.amount <= 0 || !plan.label) return [];
    return [{ ...plan, id }];
  });
}

export async function handleBGate(request, env, account, cors, fetchImpl = fetch) {
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
      return reply({ order_id: order.id, status: order.status,
        payment_verified: order.status === 'paid' && Boolean(plan), service_activated: false });
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
        provider: plan.provider, amount: plan.amount, currency: plan.currency }),
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
    return reply({ checkout_url: checkoutUrl.href, order_id: data.id, status: data.status,
      expected_amount: plan.provider === 'usdt' ? data.metadata?.expected_amount : undefined,
      network: plan.provider === 'usdt' ? data.metadata?.network : undefined });
  } catch {
    return reply({ error: 'Không kết nối được cổng thanh toán. Vui lòng thử lại cùng giao dịch.' }, 502);
  }
}
