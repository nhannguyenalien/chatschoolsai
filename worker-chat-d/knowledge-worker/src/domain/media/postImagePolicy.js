// Chọn ảnh tự động cho bài đăng theo chính sách riêng của từng tenant (bot_configs.image_mode/image_style).
// Chỉ chứa logic thuần (không gọi mạng) để test được; việc gọi AI/PocketBase nằm ở index.js.

export const IMAGE_MODES = ["ai_only", "library_first", "library_only", "none"];
export const DEFAULT_IMAGE_MODE = "ai_only"; // giữ hành vi cũ: có image_prompt thì AI vẽ

const MAX_STYLE_LENGTH = 300;
const MAX_CANDIDATES = 60;
const RECENT_AVOID = 20;

export function normalizeImagePolicy(cfg) {
  const mode = IMAGE_MODES.includes(cfg?.image_mode) ? cfg.image_mode : DEFAULT_IMAGE_MODE;
  const style = String(cfg?.image_style || "").trim().slice(0, MAX_STYLE_LENGTH);
  return { mode, style };
}

export const usesLibrary = (mode) => mode === "library_first" || mode === "library_only";
export const allowsAi = (mode) => mode === "ai_only" || mode === "library_first";

// Gắn phong cách thương hiệu của tenant vào prompt vẽ ảnh để các ảnh AI trông đồng bộ.
export function buildImagePrompt(imagePrompt, style) {
  const base = String(imagePrompt || "").trim();
  if (!base) return "";
  return style ? `${base}. Visual style: ${style}` : base;
}

// Ứng viên chọn ảnh: ảnh sẵn sàng, bỏ logo thương hiệu, ưu tiên ảnh chưa dùng gần đây (không lặp ảnh liên tục).
export function selectLibraryCandidates(items, { logoUrl = "", recentUrls = [] } = {}) {
  const usable = (items || []).filter((item) => item?.url && (item.type || "image") === "image"
    && (item.status || "ready") === "ready" && item.url !== logoUrl);
  const recent = new Set((recentUrls || []).slice(0, RECENT_AVOID));
  const fresh = usable.filter((item) => !recent.has(item.url));
  return (fresh.length ? fresh : usable).slice(0, MAX_CANDIDATES);
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "của", "và", "các", "cho", "một", "những", "trong", "khi", "là", "được"]);

function words(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")
    .split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// Dự phòng khi không gọi được AI: chọn ảnh có nhãn/mô tả trùng nhiều từ nhất với bài; không trùng từ nào thì không chọn.
export function heuristicPick(candidates, { title = "", content = "" } = {}) {
  const postWords = new Set(words(`${title} ${String(content).slice(0, 600)}`));
  let best = null;
  let bestScore = 0;
  for (const item of candidates || []) {
    const score = words(`${item.label || ""} ${item.prompt_used || ""}`).filter((w) => postWords.has(w)).length;
    if (score > bestScore) { best = item; bestScore = score; }
  }
  return best;
}

export function buildPickMessages(candidates, { title = "", content = "" } = {}) {
  const list = candidates.map((item, index) => `${index + 1}. ${String(item.label || item.prompt_used || "(không nhãn)").slice(0, 120)}`).join("\n");
  return [
    { role: "system", content: "You pick the best illustration for a social media post from a numbered list of existing photos, judging only by their labels. Reply with ONLY the number of the best match, or 0 if none is clearly relevant. Never invent numbers." },
    { role: "user", content: `POST TITLE: ${String(title).slice(0, 200)}\nPOST TEXT: ${String(content).slice(0, 700)}\n\nPHOTOS:\n${list}\n\nBest number (0 if none fits):` }
  ];
}

export function parsePickedItem(replyText, candidates) {
  const match = String(replyText || "").match(/\d+/);
  if (!match) return null;
  const index = Number(match[0]);
  return index >= 1 && index <= (candidates || []).length ? candidates[index - 1] : null;
}
