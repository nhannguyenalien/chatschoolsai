// Ảnh/video sản phẩm nằm ngay trong Knowledge Base dưới dạng link trực tiếp (vd "Ảnh: https://.../a.jpg").
// Khi khách xin xem hình/video, Worker lấy link trong chính các đoạn tài liệu AI vừa dùng để trả lời và gửi kèm,
// không phụ thuộc AI có nhớ viết link vào câu trả lời hay không.

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp)$/i;
const URL_PATTERN = /https:\/\/[^\s<>()"'\]]+/gi;
export const MAX_AUTO_IMAGES = 4;
export const MAX_AUTO_VIDEOS = 2;

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
}

// Khách có đang xin xem ảnh/video không? (so khớp không dấu để "hình", "hinh", "ảnh", "anh"... đều nhận)
export function detectMediaRequest(question) {
  // "hình thức", "hình dáng"... không phải xin xem ảnh
  const text = ` ${normalize(question).replace(/\bhinh (thuc|dang|nhu|phat|su)\b/g, " ")} `;
  const image = /\b(hinh|anh|hinh anh|picture|photo|image|pic|pics)\b/.test(text);
  const video = /\b(video|clip|phim|vid)\b/.test(text);
  return { image, video, any: image || video };
}

function mediaTypeOf(url) {
  let path = "";
  try { path = new URL(url).pathname; } catch { return null; }
  if (IMAGE_EXT.test(path)) return "image";
  if (VIDEO_EXT.test(path)) return "video";
  return null;
}

// sources: mảng đoạn tài liệu AnythingLLM trả về (có field text). Trả {type,url}[] theo thứ tự nguồn, bỏ trùng.
export function extractMediaFromSources(sources, request, { exclude = [], isSafeUrl = () => true } = {}) {
  if (!request?.any || !Array.isArray(sources)) return [];
  const seen = new Set(exclude);
  const images = [];
  const videos = [];
  for (const source of sources) {
    for (const match of String(source?.text || "").matchAll(URL_PATTERN)) {
      const url = match[0].replace(/[.,;:!?]+$/, "");
      if (seen.has(url)) continue;
      const type = mediaTypeOf(url);
      if (!type || !isSafeUrl(url)) continue;
      if (type === "image" && request.image && images.length < MAX_AUTO_IMAGES) { seen.add(url); images.push({ type, url }); }
      if (type === "video" && request.video && videos.length < MAX_AUTO_VIDEOS) { seen.add(url); videos.push({ type, url }); }
    }
  }
  return [...images, ...videos];
}

export const MEDIA_INSTRUCTION = `

HÌNH ẢNH/VIDEO: Khi khách muốn xem hình ảnh hoặc video sản phẩm, hãy mô tả ngắn gọn sản phẩm và nói bạn gửi kèm hình/video ngay bên dưới (hệ thống sẽ tự đính kèm từ tài liệu). Tuyệt đối không tự bịa đường link ảnh/video; chỉ dùng link có sẵn trong tài liệu.`;
