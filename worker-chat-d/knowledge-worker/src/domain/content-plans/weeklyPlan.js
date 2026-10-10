// Kế hoạch tuần cho bài social: logic thuần (không gọi mạng) — cấu hình, chia bài theo nhóm nội dung,
// chọn khung giờ, dựng prompt cho AI và đọc kết quả. Việc gọi AI/PocketBase nằm ở index.js.
import { COST_TABLE } from "../billing/costs.js";
import { buildCadenceSlots } from "./cadence.js";

export const WEEKLY_PLATFORMS = ["facebook", "instagram", "linkedin"];
export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
export const DEFAULT_TIMES = ["09:00", "19:00"];
const DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_PILLARS = 8;
const MAX_POSTS = 21;
const INSTAGRAM_MAX_CHARS = 2000;

export class WeeklyPlanError extends Error {}

const clampText = (value, max) => String(value ?? "").trim().slice(0, max);

function parseJson(value, fallback) {
  if (typeof value !== "string") return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function validTimezone(tz) {
  if (typeof tz !== "string" || !tz) return false;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); return true; } catch { return false; }
}

export function normalizePillars(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const pillars = [];
  for (const item of list) {
    const name = clampText(item?.name, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const weight = Number(item?.weight);
    pillars.push({ name, weight: Number.isFinite(weight) && weight > 0 ? Math.min(100, weight) : 1, description: clampText(item?.description, 200) });
    if (pillars.length >= MAX_PILLARS) break;
  }
  return pillars;
}

export function normalizePlanConfig(raw) {
  const cfg = parseJson(raw, {}) || {};
  const posts = Math.round(Number(cfg.posts_per_week));
  const platforms = [...new Set((Array.isArray(cfg.platforms) ? cfg.platforms : []).filter((p) => WEEKLY_PLATFORMS.includes(p)))];
  const days = Array.isArray(cfg.days) ? [...new Set(cfg.days.filter((d) => d === "all" || DAY_NAMES.includes(d)))] : [];
  const times = Array.isArray(cfg.times) ? [...new Set(cfg.times.filter((t) => TIME_RE.test(String(t))))].sort().slice(0, 6) : [];
  return {
    postsPerWeek: Number.isFinite(posts) && posts >= 1 ? Math.min(MAX_POSTS, posts) : 7,
    platforms: platforms.length ? platforms : ["facebook"],
    pillars: normalizePillars(cfg.pillars),
    notes: clampText(cfg.notes, 600),
    timezone: validTimezone(cfg.timezone) ? cfg.timezone : DEFAULT_TIMEZONE,
    days: days.length ? days : ["all"],
    times: times.length ? times : [...DEFAULT_TIMES]
  };
}

export function assertReadyForGeneration(config) {
  if (!config.pillars.length) throw new WeeklyPlanError("Chưa có nhóm nội dung nào — hãy bấm \"AI đề xuất nhóm nội dung\" hoặc tự thêm.");
  return config;
}

// Chia n bài cho các nhóm theo trọng số (phương pháp phần dư lớn nhất), tổng luôn đúng n.
export function allocatePillarCounts(pillars, n) {
  const total = pillars.reduce((sum, p) => sum + p.weight, 0);
  const exact = pillars.map((p) => (p.weight / total) * n);
  const counts = exact.map(Math.floor);
  let left = n - counts.reduce((a, b) => a + b, 0);
  const order = exact.map((value, index) => ({ index, rem: value - Math.floor(value) })).sort((a, b) => b.rem - a.rem || a.index - b.index);
  for (let i = 0; left > 0; i = (i + 1) % order.length, left -= 1) counts[order[i].index] += 1;
  return counts;
}

// Sắp bài xen kẽ nhóm để các bài cùng nhóm không đăng liền nhau.
export function interleaveByPillar(posts) {
  const groups = new Map();
  for (const post of posts) {
    if (!groups.has(post.pillar)) groups.set(post.pillar, []);
    groups.get(post.pillar).push(post);
  }
  const result = [];
  let last = null;
  while (result.length < posts.length) {
    const candidates = [...groups.entries()].filter(([, items]) => items.length);
    candidates.sort((a, b) => (b[1].length - a[1].length));
    const pick = candidates.find(([name]) => name !== last) || candidates[0];
    result.push(pick[1].shift());
    last = pick[0];
  }
  return result;
}

// Các khung giờ trong 7 ngày kể từ `from`, rải đều nếu nhiều hơn số bài; ít hơn thì trả hết (bài còn lại chưa có giờ).
export function pickWeekSlots({ config, from, count }) {
  const start = new Date(from);
  const until = new Date(start.valueOf() + 7 * 86400000);
  const slots = buildCadenceSlots({ cadence: { days: config.days, times: config.times }, timeZone: config.timezone, from: start, until, limit: 200 });
  if (slots.length <= count) return slots;
  return Array.from({ length: count }, (_, i) => slots[Math.floor((i * slots.length) / count)]);
}

// Ước lượng lượt trả lời (đơn vị quota) cho cả kế hoạch: viết bài + xử lý ảnh theo chế độ ảnh của tenant.
export function estimateWeeklyUnits(count, imageMode) {
  const write = count * COST_TABLE.post_text;
  const perImage = {
    ai_only: { min: COST_TABLE.image, max: COST_TABLE.image },
    library_first: { min: COST_TABLE.chat, max: COST_TABLE.chat + COST_TABLE.image },
    library_only: { min: COST_TABLE.chat, max: COST_TABLE.chat },
    none: { min: 0, max: 0 }
  }[imageMode] || { min: 0, max: 0 };
  return { write, min: write + count * perImage.min, max: write + count * perImage.max };
}

function stripCodeFence(text) {
  return String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function extractJson(text) {
  const raw = stripCodeFence(text);
  const start = raw.search(/[{[]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (start === -1 || end <= start) throw new WeeklyPlanError("AI không trả về JSON hợp lệ.");
  const body = raw.slice(start, end + 1);
  try { return JSON.parse(body); } catch { /* thử sửa xuống dòng thô trong chuỗi */ }
  try { return JSON.parse(body.replace(/[\r\n]+/g, "\\n")); } catch { throw new WeeklyPlanError("AI không trả về JSON hợp lệ."); }
}

const LANGUAGE_NAMES = { vi: "Vietnamese", en: "English", ja: "Japanese", es: "Spanish", fr: "French", ko: "Korean", zh: "Chinese" };
export const languageNameFor = (code) => LANGUAGE_NAMES[String(code || "").toLowerCase()] || "Vietnamese";

const list = (items) => (items.length ? items.map((t) => `- ${String(t).slice(0, 120)}`).join("\n") : "(none)");

export function buildPillarSuggestMessages({ businessContext = "", kbTitles = [], recentTitles = [], languageName = "Vietnamese" }) {
  return [
    { role: "system", content: `You are a social media strategist. Propose 4-5 content pillars (recurring post categories) for this business's weekly social posts. Reply with ONLY JSON: {"pillars":[{"name":"...","weight":<integer percent>,"description":"one sentence on what these posts cover"}]}. Weights sum to 100. Names are short (2-5 words), in ${languageName}. Base everything on the business info; do not invent products or services.` },
    { role: "user", content: `BUSINESS INFO:\n${String(businessContext).slice(0, 1500) || "(not provided)"}\n\nKNOWLEDGE BASE TOPICS:\n${list(kbTitles.slice(0, 40))}\n\nRECENT POST TITLES:\n${list(recentTitles.slice(0, 20))}` }
  ];
}

export function parsePillars(text) {
  const data = extractJson(text);
  const pillars = normalizePillars(Array.isArray(data) ? data : data?.pillars);
  if (!pillars.length) throw new WeeklyPlanError("AI chưa đề xuất được nhóm nội dung.");
  const total = pillars.reduce((s, p) => s + p.weight, 0);
  let acc = 0;
  pillars.forEach((p, i) => {
    const w = i === pillars.length - 1 ? 100 - acc : Math.max(1, Math.round((p.weight / total) * 100));
    p.weight = w; acc += w;
  });
  return pillars;
}

export function buildWeeklyMessages({ config, counts, businessContext = "", kbTitles = [], recentTitles = [], languageName = "Vietnamese" }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const pillarLines = config.pillars.map((p, i) => `- "${p.name}" x ${counts[i]}${p.description ? ` — ${p.description}` : ""}`).join("\n");
  const instagram = config.platforms.includes("instagram");
  return [
    { role: "system", content: `You write a week of social media posts for a business. Write exactly ${total} posts in ${languageName}, following the pillar counts. Each post: a strong first-line hook, useful content, a clear call to action; vary openings and angles; no two posts on the same topic. Use only facts found in the business info/knowledge topics — never invent prices, discounts, statistics, product names or testimonials. Posts are public: write directly to customers and never mention the knowledge base, documents, sources, prompts or these instructions; if a detail is missing, simply leave it out instead of telling readers to look it up. ${instagram ? `Keep every post under ${INSTAGRAM_MAX_CHARS} characters and end with 3-6 relevant hashtags. ` : ""}Reply with ONLY JSON: {"posts":[{"pillar":"<exact pillar name>","title":"short internal title","content":"full post text","image_prompt":"one-sentence English description of a fitting photo"}]}` },
    { role: "user", content: `BUSINESS INFO:\n${String(businessContext).slice(0, 1500) || "(not provided)"}\n\nTONE / RULES FROM THE OWNER:\n${config.notes || "(none)"}\n\nKNOWLEDGE BASE TOPICS (source material):\n${list(kbTitles.slice(0, 40))}\n\nALREADY POSTED RECENTLY (do not repeat):\n${list(recentTitles.slice(0, 30))}\n\nPILLARS AND COUNTS:\n${pillarLines}\n\nPlatforms: ${config.platforms.join(", ")}. Write the ${total} posts now.` }
  ];
}

export function parseWeeklyPosts(text, { pillars, platforms = [] }) {
  const data = extractJson(text);
  const rows = Array.isArray(data) ? data : data?.posts;
  if (!Array.isArray(rows)) throw new WeeklyPlanError("AI không trả về danh sách bài.");
  const maxChars = platforms.includes("instagram") ? INSTAGRAM_MAX_CHARS : 5000;
  const byName = new Map(pillars.map((p) => [p.name.toLowerCase(), p.name]));
  const posts = [];
  for (const row of rows) {
    const title = clampText(row?.title, 200);
    const content = clampText(row?.content, maxChars);
    if (!title || !content) continue;
    posts.push({
      pillar: byName.get(String(row?.pillar || "").trim().toLowerCase()) || clampText(row?.pillar, 60),
      title, content, image_prompt: clampText(row?.image_prompt, 400)
    });
  }
  if (!posts.length) throw new WeeklyPlanError("AI không viết được bài nào.");
  return posts;
}
