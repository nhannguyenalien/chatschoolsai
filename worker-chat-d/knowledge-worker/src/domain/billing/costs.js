// Trọng số quota: 1 đơn vị = 1 tin nhắn trả lời chat (text). Mọi tác vụ trả phí khác quy đổi
// theo chi phí nhà cung cấp tương đối so với 1 tin chat. Chỉnh giá ở đây, không rải số trong index.js.
// Video dùng API ngoài do khách tự thêm nên không tính quota.
// Trả lời có tra cứu knowledge/RAG (embedding + rerank) vẫn tính như chat thường: 1.
export const COST_TABLE = Object.freeze({
  chat: 1,
  post_text: 2,
  image: 8, // bài post + 1 ảnh AI = post_text (2) + image (8) = 10
  image_describe: 1, // AI nhìn 1 ảnh để đặt nhãn (vision, ảnh độ phân giải thấp) ~ 1 lượt trả lời
  voice_greeting: 1,
  voice_per_minute: 4
});

const DOC_TOKENS_PER_UNIT = 5000;
const DOC_MAX_UNITS = 20;
const CHARS_PER_TOKEN = 4;

// Nạp tài liệu: ceil(token / 5000), tối thiểu 1, tối đa 20 mỗi tài liệu.
export function docEmbedUnits(charCount) {
  const chars = Number.isFinite(charCount) && charCount > 0 ? charCount : 0;
  const tokens = Math.ceil(chars / CHARS_PER_TOKEN);
  return Math.min(DOC_MAX_UNITS, Math.max(1, Math.ceil(tokens / DOC_TOKENS_PER_UNIT)));
}

// Voice: 4 đơn vị/phút, tính theo từng 15 giây, tối thiểu 1.
export function voiceUnits(durationSec) {
  const seconds = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  return Math.max(1, Math.ceil(seconds * COST_TABLE.voice_per_minute / 60));
}

// Phân loại 1 lần gọi provider để biết đơn vị phải trừ; mặc định là loại do caller khai báo.
export function costKindForPath(pathname, defaultKind = 'chat') {
  return /\/images\/generations\/?$/.test(pathname) ? 'image' : defaultKind;
}
