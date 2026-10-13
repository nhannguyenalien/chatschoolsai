// Messenger/Instagram/WhatsApp/Telegram không hiển thị markdown. Bot trả lời bằng markdown (dùng cho web chat),
// nên trước khi gửi ra các kênh này phải đổi sang chữ thuần để khách không thấy "![..](..)", "**" hay "[chữ](url)".
// Ảnh ![mô tả](url) được gửi riêng dưới dạng ảnh đính kèm, nên mặc định bỏ khỏi chữ; kênh không đính kèm được
// (vd Telegram) đặt keepImageLinks để giữ lại URL ảnh dạng chữ.
export function markdownToChannelText(text, { platform = "", keepImageLinks = false } = {}) {
  let out = String(text ?? "");
  out = out.replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1");
  out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, alt, url) => (keepImageLinks ? (alt ? `${alt}: ${url}` : url) : ""));
  out = out.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    const clean = label.trim();
    return !clean || clean === url ? url : `${clean}: ${url}`;
  });
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  out = out.replace(/^(\s*)[*+]\s+/gm, "$1- ");
  out = platform === "whatsapp"
    ? out.replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_, a, b) => `*${a ?? b}*`)
    : out.replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_, a, b) => a ?? b);
  out = out.replace(/`([^`\n]+)`/g, "$1");
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
