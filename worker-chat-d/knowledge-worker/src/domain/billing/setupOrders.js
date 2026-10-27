// One-time onboarding package ("gói hỗ trợ cài đặt"): bought per workspace, fulfilled by people.
// State lives on the tenant's bot_configs record: setup_status ('' | pending | paid | in_progress | done),
// setup_orders (JSON array of BGate order ids bound to this workspace), setup_paid_at (ISO).
// `pb` is injected (list/get/patch with the admin token) so the logic is testable without PocketBase.
const esc = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const ORDER_ID = /^[a-f0-9-]{36}$/i;
const MAX_ORDERS = 20;

function parseOrders(config) {
  try {
    const list = JSON.parse(config.setup_orders || '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function createSetupStore({ pb, notify = async () => {}, now = () => new Date() }) {
  const configFor = async (tenant) => {
    const [config] = await pb.list('bot_configs', `tenant='${esc(tenant)}'`, 1);
    if (!config) return null;
    // PocketBase silently drops unknown fields: refuse to sell without the schema in place.
    if (!('setup_status' in config) || !('setup_orders' in config)) throw new Error('bot_configs setup fields missing');
    return config;
  };

  // The caller must own the workspace (primary tenant or an active owner membership) and it must be configured.
  async function ownsTenant(account, tenant) {
    if (!account?.id || !(await configFor(tenant))) return false;
    const primary = account.tenant ?? (await pb.get('tenants', account.id))?.tenant;
    if (primary === tenant) return true;
    const rows = await pb.list('tenant_memberships',
      `account='${esc(account.id)}' && tenant='${esc(tenant)}' && status='active' && role='owner'`, 1);
    return rows.length > 0;
  }

  async function setupState(tenant) {
    return { status: (await configFor(tenant))?.setup_status || '' };
  }

  async function bindSetupOrder(tenant, orderId) {
    const config = await configFor(tenant);
    if (!config || !ORDER_ID.test(orderId)) throw new Error('Cannot bind setup order');
    const orders = parseOrders(config);
    if (orders.includes(orderId) && config.setup_status) return;
    const patch = { setup_orders: JSON.stringify([...new Set([...orders, orderId])].slice(-MAX_ORDERS)) };
    if (!config.setup_status) patch.setup_status = 'pending';
    await pb.patch('bot_configs', config.id, patch);
  }

  // Idempotent: only the first confirmation moves pending -> paid and notifies.
  async function confirmSetupPaid(orderId, accountId) {
    if (!ORDER_ID.test(orderId || '')) return null;
    const [config] = await pb.list('bot_configs', `setup_orders ~ '${esc(orderId)}'`, 1);
    if (!config || !parseOrders(config).includes(orderId)) return null;
    if (!(await ownsTenant({ id: accountId }, config.tenant))) return null;
    if (config.setup_status && config.setup_status !== 'pending') return { tenant: config.tenant, status: config.setup_status };
    await pb.patch('bot_configs', config.id, { setup_status: 'paid', setup_paid_at: now().toISOString() });
    try { await notify({ tenant: config.tenant, orderId }); } catch { /* a failed alert must not undo the payment record */ }
    return { tenant: config.tenant, status: 'paid' };
  }

  // Safety net for customers who pay and never come back: re-check pending workspaces' orders.
  async function reconcilePending(verifyPaidOrder) {
    const pending = await pb.list('bot_configs', "setup_status='pending'", 20);
    let confirmed = 0;
    for (const config of pending) {
      for (const orderId of parseOrders(config).slice(-5)) {
        const order = await verifyPaidOrder(orderId).catch(() => null);
        if (order && await confirmSetupPaid(orderId, order.user_id)) { confirmed++; break; }
      }
    }
    return confirmed;
  }

  return { ownsTenant, setupState, bindSetupOrder, confirmSetupPaid, reconcilePending };
}
