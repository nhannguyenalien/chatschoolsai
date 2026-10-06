// Nội dung theo từng kênh (page) của social: mỗi page có thể có ngôn ngữ riêng và 1 trong 3 chế độ
// (lưu trong pages_config.extra_config.content_mode, không cần đổi schema):
//   "same"        — đăng nguyên bản bài gốc (mặc định, giữ hành vi cũ)
//   "translate"   — dịch bài gốc sang ngôn ngữ của page ngay lúc đăng
//   "independent" — AI viết bài RIÊNG cho page này (khác góc nhìn, ngôn ngữ của page)
export const SOCIAL_PLATFORMS = ["facebook", "instagram", "linkedin"];
export const CONTENT_MODES = ["same", "translate", "independent"];

function parseExtra(page) {
  try { return JSON.parse(page?.extra_config || "{}") || {}; } catch { return {}; }
}

export function getPageContentMode(page) {
  if (!SOCIAL_PLATFORMS.includes(page?.platform)) return "same";
  const mode = String(parseExtra(page).content_mode || "same").toLowerCase();
  return CONTENT_MODES.includes(mode) ? mode : "same";
}

export function getPageLanguage(page) {
  return String(page?.default_language || "").trim().toLowerCase();
}

// Chỉ dịch khi page ở chế độ translate, có ngôn ngữ đích, khác ngôn ngữ bài gốc và bài không thuộc
// Content Planning (blog có pipeline dịch riêng — translateBlog).
export function shouldTranslateForPage(page, post) {
  if (getPageContentMode(page) !== "translate") return false;
  if (post?.content_plan_item_id) return false;
  const target = getPageLanguage(page);
  if (!target) return false;
  const source = String(post?.language || "").trim().toLowerCase();
  return source !== target;
}

export async function translatePostForPage({ post, page, translator }) {
  if (!translator) throw new Error("Chưa cấu hình AI để dịch bài cho page này.");
  const target = getPageLanguage(page);
  const [title, content] = await translator.translate([String(post.title || ""), String(post.content || "")], target);
  return { ...post, title, content, language: target };
}

// Tách page đang active thành nhóm dùng chung 1 bài (same/translate) và nhóm cần bài riêng.
export function splitPagesByContentMode(pages) {
  const shared = [];
  const independent = [];
  for (const page of pages || []) (getPageContentMode(page) === "independent" ? independent : shared).push(page);
  return { shared, independent };
}

// Luật lịch có page_id chỉ áp cho page đó; luật chung (page_id rỗng) chỉ lấy bài của các page
// KHÔNG có luật riêng, để không giành bài của nhau.
export function buildScheduleCandidateFilter({ tenant, platformExpr, rule, rules, esc = (v) => String(v) }) {
  let filter = `tenant='${esc(tenant)}' && (${platformExpr}) && status='scheduled' && scheduled_at=''`;
  if (rule.page_id) return `${filter} && page_id='${esc(rule.page_id)}'`;
  const claimed = new Set((rules || []).filter((r) => r.page_id && r.content_type === rule.content_type).map((r) => r.page_id));
  for (const id of claimed) filter += ` && page_id!='${esc(id)}'`;
  return filter;
}
