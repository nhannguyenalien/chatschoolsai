// One Durable Object per paying account, shared by all its workspaces.
export function messageLimit(record) {
  const value = record.message_limit;
  if (value === undefined || value === null || value === '') return record.plan_id === 'pro' ? 1000 : 100;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid message limit');
  return limit;
}

const MB = 1024 * 1024;
export const STORAGE_LIMITS = Object.freeze({ free: 100 * MB, pro: 2048 * MB });

// Dung lượng media (byte) theo gói; storage_limit_bytes trên record "tenants" cho admin override.
// Field Number của PocketBase mặc định là 0, nên 0/trống nghĩa là "dùng mặc định theo gói".
export function storageLimit(record) {
  const value = record.storage_limit_bytes;
  if (value === undefined || value === null || value === '' || Number(value) === 0) return record.plan_id === 'pro' ? STORAGE_LIMITS.pro : STORAGE_LIMITS.free;
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
    const allowed = units ? used + units <= limit : used < limit;
    const next = used + (allowed ? units : 0);
    // Persist first. An ambiguous PB failure must never permit a free provider call
    // or forget a reservation after an eviction/restart. No automatic refunds.
    if (units && allowed) await this.storage.put('usage', { accountId, month, used: next });
    if (record.last_reset_month !== month || pbUsed !== next) {
      await this.backend.write(accountId, { message_used: next, last_reset_month: month });
    }
    return { ok: allowed, record: { ...record, message_used: next, last_reset_month: month } };
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
