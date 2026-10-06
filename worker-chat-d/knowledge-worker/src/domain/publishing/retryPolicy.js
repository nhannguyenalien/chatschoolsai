// Phân loại lỗi đăng bài và lịch thử lại. Thuần hàm, không gọi mạng.
// Nguyên tắc: chỉ thử lại khi chắc chắn bài CHƯA được đăng (nền tảng trả lỗi rõ ràng, tạm thời).
// Lỗi không rõ (timeout, đứt mạng) không thử lại tự động vì bài có thể đã lên — thử lại sẽ đăng trùng.
export const RETRY_DELAYS_MINUTES = Object.freeze([15, 60, 240]);

const META_RATE_LIMIT_CODES = new Set([4, 17, 32, 341, 613]);
const META_TRANSIENT_CODES = new Set([1, 2]);
const META_TOKEN_CODES = new Set([102, 190]);
const META_PERMISSION_CODES = new Set([10, 200, 368]);

// Gắn thông tin lỗi của Meta Graph API vào Error để phân loại sau này.
export function metaApiError(response, data, fallback) {
  const error = new Error(data?.error?.message || fallback);
  error.status = response?.status;
  error.metaCode = data?.error?.code;
  error.metaSubcode = data?.error?.error_subcode;
  error.transient = data?.error?.is_transient === true;
  return error;
}

// Trả về { kind: 'retryable' | 'permanent' | 'uncertain', reason }.
export function classifyPublishError(error) {
  const code = Number(error?.metaCode);
  const status = Number(error?.status);
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || (error instanceof TypeError && /fetch/i.test(error.message || ''))) {
    return { kind: 'uncertain', reason: 'timeout' };
  }
  if (META_TOKEN_CODES.has(code)) return { kind: 'permanent', reason: 'token' };
  if (META_PERMISSION_CODES.has(code) || (code >= 200 && code <= 299)) return { kind: 'permanent', reason: 'permission' };
  if (META_RATE_LIMIT_CODES.has(code) || status === 429) return { kind: 'retryable', reason: 'rate_limit' };
  if (META_TRANSIENT_CODES.has(code) || error?.transient === true || (status >= 500 && status <= 599)) {
    return { kind: 'retryable', reason: 'transient' };
  }
  return { kind: 'permanent', reason: 'rejected' };
}

// attempts = số lần đã thử lại. Trả về ISO thời điểm thử lại tiếp theo hoặc null nếu hết lượt.
export function nextRetryAt(attempts, now = new Date()) {
  const delay = RETRY_DELAYS_MINUTES[attempts];
  return delay === undefined ? null : new Date(now.getTime() + delay * 60 * 1000).toISOString();
}

const REASON_TEXT = {
  token: 'Token trang đã hết hạn hoặc không hợp lệ — vào sm-config.html kết nối lại trang.',
  permission: 'Trang chưa cấp đủ quyền đăng bài hoặc bị Meta hạn chế — kiểm tra quyền trong sm-config.html.',
  rejected: 'Nền tảng từ chối nội dung/tham số bài đăng — sửa bài rồi duyệt lại.',
  rate_limit: 'Nền tảng đang giới hạn tần suất đăng.',
  transient: 'Nền tảng đang lỗi tạm thời.',
  timeout: 'Không nhận được phản hồi từ nền tảng nên chưa rõ bài đã lên chưa — HÃY KIỂM TRA TRANG trước khi duyệt lại để tránh đăng trùng.'
};

export function failureNotice({ reason, title, platform, message, attempts = 0 }) {
  const lines = [
    `⚠️ Đăng bài thất bại${platform ? ` (${platform})` : ''}`,
    title ? `Bài: ${String(title).slice(0, 80)}` : null,
    REASON_TEXT[reason] || null,
    attempts ? `Đã thử lại ${attempts} lần.` : null,
    message ? `Chi tiết: ${String(message).slice(0, 200)}` : null
  ];
  return lines.filter(Boolean).join('\n');
}
