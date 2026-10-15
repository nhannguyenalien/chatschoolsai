// pro_expires_at (epoch ms) is written by the BGate/Whop sync only. 0/empty means a
// plan that never expires (admin-granted), so existing accounts are unaffected.
export function proExpiresAt(record) {
  const value = Number(record?.pro_expires_at);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function effectivePlan(record, now = Date.now()) {
  if (record?.plan_id !== 'pro') return 'free';
  const expiresAt = proExpiresAt(record);
  return expiresAt && expiresAt <= now ? 'free' : 'pro';
}

export const MESSAGE_LIMITS = Object.freeze({ free: 100, pro: 1000 });

export function messageLimit(record, now = Date.now()) {
  const plan = effectivePlan(record, now);
  // Billing-managed accounts always follow their plan; stale overrides must not outlive expiry.
  if (proExpiresAt(record)) return MESSAGE_LIMITS[plan];
  const value = record.message_limit;
  if (value === undefined || value === null || value === '') return MESSAGE_LIMITS[plan];
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid message limit');
  return limit;
}

// Add-on credits expire 12 months after purchase and are spent only after the monthly limit,
// oldest grant first. bonus_orders is the ledger [{ id, at, n }] (also the replay guard for an
// order id). Two single-writer counters avoid lost updates: the worker only appends grants, the
// quota object only raises message_bonus_used.
export const BONUS_TTL_MS = 365 * 24 * 3600 * 1000;

export function bonusGrants(record) {
  let list;
  try { list = JSON.parse(record?.bonus_orders || '[]'); } catch { throw new Error('Invalid bonus_orders'); }
  if (!Array.isArray(list)) throw new Error('Invalid bonus_orders');
  return list.map(item => typeof item === 'string' ? { id: item, at: 0, n: 1000 } : item);
}

export function bonusRemaining(record, now = Date.now(), usedOverride) {
  const used = usedOverride ?? (Number(record?.message_bonus_used) || 0);
  let active = 0;
  let expired = 0;
  for (const grant of bonusGrants(record)) {
    const n = Number(grant.n) || 0;
    // at === 0 marks a legacy entry without a date: never expires.
    if (grant.at && grant.at + BONUS_TTL_MS <= now) expired += n; else active += n;
  }
  // Spending is FIFO, so expired grants absorb usage first.
  return Math.max(0, active - Math.max(0, used - expired));
}

const MB = 1024 * 1024;
export const STORAGE_LIMITS = Object.freeze({ free: 100 * MB, pro: 2048 * MB });

// Dung lượng media (byte) theo gói; storage_limit_bytes trên record "tenants" cho admin override.
// Field Number của PocketBase mặc định là 0, nên 0/trống nghĩa là "dùng mặc định theo gói".
export function storageLimit(record, now = Date.now()) {
  const value = record.storage_limit_bytes;
  if (value === undefined || value === null || value === '' || Number(value) === 0) return STORAGE_LIMITS[effectivePlan(record, now)];
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid storage limit');
  return limit;
}

export class AccountQuotaStore {
  constructor(state, backend) {
    this.storage = state.storage;
    this.backend = backend;
    this.queue = Promise.resolve();
  }
  async fetch(request) {
    const input = await request.json();
    // Serialize also across network awaits, not only storage operations.
    const operation = this.queue.then(() => input.kind === 'storage' ? this.reserveStorage(input) : this.reserve(input));
    this.queue = operation.catch(() => {});
    try { return Response.json(await operation); }
    catch { return Response.json({ error: 'Quota storage unavailable' }, { status: 503 }); }
  }
  async reserve({ accountId, units = 0 }) {
    if (!accountId || !Number.isSafeInteger(units) || units < 0) throw new Error('Invalid quota request');
    const record = await this.backend.read(accountId);
    if (record.id !== accountId) throw new Error('Account mismatch');
    const month = new Date().toISOString().slice(0, 7);
    const stored = await this.storage.get('usage');
    if (stored && stored.accountId !== accountId) throw new Error('Quota object mismatch');
    const pbUsed = record.last_reset_month === month ? Number(record.message_used || 0) : 0;
    if (!Number.isSafeInteger(pbUsed) || pbUsed < 0) throw new Error('Invalid usage');
    const used = Math.max(pbUsed, stored?.month === month ? stored.used : 0);
    const limit = messageLimit(record);
    const withinMonthly = units ? used + units <= limit : used < limit;
    const storedBonus = await this.storage.get('bonus');
    if (storedBonus && storedBonus.accountId !== accountId) throw new Error('Quota object mismatch');
    const pbBonusUsed = Number(record.message_bonus_used) || 0;
    const bonusUsed = Math.max(pbBonusUsed, storedBonus?.used || 0);
    const bonusLeft = bonusRemaining(record, Date.now(), bonusUsed);
    const useBonus = !withinMonthly && (units ? bonusLeft >= units : bonusLeft > 0);
    const allowed = withinMonthly || useBonus;
    const next = used + (withinMonthly ? units : 0);
    const nextBonusUsed = bonusUsed + (useBonus ? units : 0);
    // Persist first. An ambiguous PB failure must never permit a free provider call
    // or forget a reservation after an eviction/restart. No automatic refunds.
    if (units && withinMonthly) await this.storage.put('usage', { accountId, month, used: next });
    if (units && useBonus) await this.storage.put('bonus', { accountId, used: nextBonusUsed });
    const patch = {};
    if (record.last_reset_month !== month || pbUsed !== next) Object.assign(patch, { message_used: next, last_reset_month: month });
    if (pbBonusUsed !== nextBonusUsed) patch.message_bonus_used = nextBonusUsed;
    if (Object.keys(patch).length) await this.backend.write(accountId, patch);
    return { ok: allowed, record: { ...record, message_used: next, last_reset_month: month, message_bonus_used: nextBonusUsed } };
  }
  // Dung lượng không reset theo tháng. bytes > 0: giữ chỗ; bytes < 0: hoàn trả khi xoá/lỗi.
  async reserveStorage({ accountId, bytes = 0 }) {
    if (!accountId || !Number.isSafeInteger(bytes)) throw new Error('Invalid storage request');
    const record = await this.backend.read(accountId);
    if (record.id !== accountId) throw new Error('Account mismatch');
    const stored = await this.storage.get('storage');
    if (stored && stored.accountId !== accountId) throw new Error('Quota object mismatch');
    const pbUsed = Number(record.storage_used || 0);
    if (!Number.isSafeInteger(pbUsed) || pbUsed < 0) throw new Error('Invalid storage usage');
    const used = Math.max(pbUsed, stored?.used || 0);
    const limit = storageLimit(record);
    const allowed = bytes <= 0 || used + bytes <= limit;
    const next = allowed ? Math.max(0, used + bytes) : used;
    if (allowed && bytes !== 0) await this.storage.put('storage', { accountId, used: next });
    // Release phải ghi đè cả bộ đếm PB (max() sẽ giữ giá trị cũ cao hơn nếu không ghi).
    if (pbUsed !== next) await this.backend.write(accountId, { storage_used: next });
    return { ok: allowed, used: next, limit, record: { ...record, storage_used: next } };
  }
}
