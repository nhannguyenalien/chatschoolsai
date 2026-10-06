// Lưu ảnh/video của tenant. Backend: R2 (binding MEDIA_BUCKET) nếu đã cấu hình, nếu chưa thì
// tạm lưu file trong PocketBase. Dung lượng luôn bị chặn theo gói của tài khoản (xem
// AccountQuotaStore.reserveStorage) — giữ chỗ TRƯỚC khi ghi, hoàn trả nếu ghi lỗi.
const MB = 1024 * 1024;
const MAX_FILE_BYTES = { image: 15 * MB, video: 200 * MB };
const EXT_BY_TYPE = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov'
};

export class MediaError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function mediaKindFor(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!EXT_BY_TYPE[type]) return null;
  return { contentType: type, kind: type.startsWith('video/') ? 'video' : 'image', ext: EXT_BY_TYPE[type] };
}

// deps: { bucket?, publicBaseUrl?, quota: { reserve(bytes), release(bytes) },
//         records: { create(fields, file?) -> record, remove(id) }, randomId? }
export function createMediaStore({ bucket, publicBaseUrl, quota, records, randomId = () => crypto.randomUUID(), now = () => new Date() }) {
  const base = String(publicBaseUrl || '').replace(/\/$/, '');

  async function store({ tenant, bytes, contentType, label = '', source = 'upload', promptUsed = '' }) {
    const info = mediaKindFor(contentType);
    if (!info) throw new MediaError('UNSUPPORTED_MEDIA_TYPE', 'Định dạng file không được hỗ trợ.', 415);
    const size = bytes?.byteLength ?? bytes?.size ?? 0;
    if (!size) throw new MediaError('EMPTY_FILE', 'File rỗng.');
    if (size > MAX_FILE_BYTES[info.kind]) {
      throw new MediaError('FILE_TOO_LARGE', `File ${info.kind} tối đa ${MAX_FILE_BYTES[info.kind] / MB} MB.`, 413);
    }
    const reservation = await quota.reserve(size);
    if (!reservation.ok) {
      throw new MediaError('STORAGE_QUOTA_EXCEEDED', 'Đã hết dung lượng lưu trữ của gói hiện tại.', 413, { used: reservation.used, limit: reservation.limit });
    }
    let key = '';
    try {
      const fields = { tenant, label: String(label).slice(0, 100), source, type: info.kind, status: 'ready', prompt_used: String(promptUsed).slice(0, 500), size_bytes: size };
      let record;
      if (bucket) {
        key = `${tenant}/${now().toISOString().slice(0, 7)}/${randomId()}.${info.ext}`;
        await bucket.put(key, bytes, { httpMetadata: { contentType: info.contentType } });
        record = await records.create({ ...fields, r2_key: key, url: `${base}/${key}` });
      } else {
        const file = new Blob([bytes], { type: info.contentType });
        record = await records.create(fields, { file, name: `${source}_${randomId().slice(0, 8)}.${info.ext}` });
      }
      return { id: record.id, url: record.url || record.fileUrl, key, size, type: info.kind, contentType: info.contentType };
    } catch (err) {
      if (key) await bucket.delete(key).catch(() => {});
      await quota.release(size).catch(() => {});
      throw err;
    }
  }

  // record: bản ghi media_library đã được kiểm tra thuộc tài khoản này.
  async function remove(record) {
    if (record.r2_key && bucket) await bucket.delete(record.r2_key);
    await records.remove(record.id);
    const size = Number(record.size_bytes) || 0;
    if (size > 0) await quota.release(size);
  }

  return { store, remove };
}
