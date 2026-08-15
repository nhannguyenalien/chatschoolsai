export const TREND_CATEGORIES = ["ai-agent", "automation", "online-business", "manufacturing", "trading", "education", "healthcare", "logistics", "finance", "retail"];
export const TREND_FORMATS = ["pillar", "how-to", "case-study", "comparison", "news-analysis", "tool-review"];
const LEVELS = ["low", "medium", "high"];

function fail(path, message) { throw new Error(`${path}: ${message}`); }
function record(value, path) { if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "phải là object."); return value; }
function string(value, path) { if (typeof value !== "string" || !value.trim()) fail(path, "không được để trống."); return value.trim(); }
function integer(value, path, min, max = Infinity) { if (!Number.isInteger(value) || value < min || value > max) fail(path, `phải là số nguyên từ ${min} đến ${max}.`); return value; }
function score(value, path) { if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) fail(path, "phải từ 0 đến 100."); return value; }
function strings(value, path) { if (!Array.isArray(value) || !value.length) fail(path, "phải có ít nhất một giá trị."); return value.map((item, index) => string(item, `${path}.${index}`)); }
function choice(value, choices, path) { if (!choices.includes(value)) fail(path, `giá trị không hợp lệ: ${value}.`); return value; }

function level(value, fallback) { return value === "very-high" ? "high" : LEVELS.includes(value) ? value : fallback; }
function finite(value, fallback) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }

function normalizeTopic(value) {
  const topic = record(value, "topic");
  const overallScore = finite(topic.overallScore, 0);
  const competition = level(topic.competition, "medium");
  const wordCount = typeof topic.recommendedWordCount === "number" ? topic.recommendedWordCount : topic.wordCount;
  return {
    ...topic,
    searchIntent: typeof topic.searchIntent === "string" ? [topic.searchIntent] : topic.searchIntent,
    suggestedAngle: topic.suggestedAngle ?? topic.contentAngle,
    targetAudience: topic.targetAudience ?? ["Người quan tâm đến chủ đề"],
    competition,
    conversionPotential: level(topic.conversionPotential ?? topic.conversion, "medium"),
    contentDepthPotential: level(topic.contentDepthPotential, typeof wordCount === "number" && wordCount >= 2400 ? "high" : "medium"),
    noveltyScore: finite(topic.noveltyScore, overallScore), trendScore: finite(topic.trendScore, overallScore),
    relevanceScore: finite(topic.relevanceScore, overallScore), conversionScore: finite(topic.conversionScore, overallScore),
    competitionScore: finite(topic.competitionScore, competition === "low" ? 90 : competition === "medium" ? 70 : 45),
    duplicateRisk: level(topic.duplicateRisk, "low"),
    duplicateNote: topic.duplicateNote ?? "Chưa kiểm tra; hệ thống sẽ đối chiếu lịch sử trước khi đề xuất.",
    recommendedFormat: topic.recommendedFormat === "listicle" ? "how-to" : topic.recommendedFormat,
    recommendedWordCount: wordCount,
    recommendedAssets: topic.recommendedAssets ?? ["1 ảnh hero"],
  };
}

function normalizeReport(input) {
  const report = record(input, "payload");
  return { ...report, sourceSummary: report.sourceSummary ?? { googleTrends: false, technologyNews: false, youtube: false, searchConsole: false, sanityExistingPosts: false }, totalCandidates: report.totalCandidates ?? report.candidateCount, topics: Array.isArray(report.topics) ? report.topics.map(normalizeTopic) : report.topics };
}

function validateTopic(input, index) {
  const p = `topics.${index}`; const t = record(input, p);
  return { ...t,
    rank: integer(t.rank, `${p}.rank`, 1, 10), title: string(t.title, `${p}.title`),
    category: choice(t.category, TREND_CATEGORIES, `${p}.category`), primaryKeyword: string(t.primaryKeyword, `${p}.primaryKeyword`),
    secondaryKeywords: strings(t.secondaryKeywords, `${p}.secondaryKeywords`), longTailKeywords: strings(t.longTailKeywords, `${p}.longTailKeywords`),
    searchIntent: strings(t.searchIntent, `${p}.searchIntent`), trendReason: string(t.trendReason, `${p}.trendReason`),
    suggestedAngle: string(t.suggestedAngle, `${p}.suggestedAngle`), targetAudience: strings(t.targetAudience, `${p}.targetAudience`),
    competition: choice(t.competition, LEVELS, `${p}.competition`), conversionPotential: choice(t.conversionPotential, LEVELS, `${p}.conversionPotential`),
    contentDepthPotential: choice(t.contentDepthPotential, LEVELS, `${p}.contentDepthPotential`), noveltyScore: score(t.noveltyScore, `${p}.noveltyScore`),
    trendScore: score(t.trendScore, `${p}.trendScore`), relevanceScore: score(t.relevanceScore, `${p}.relevanceScore`),
    conversionScore: score(t.conversionScore, `${p}.conversionScore`), competitionScore: score(t.competitionScore, `${p}.competitionScore`),
    overallScore: score(t.overallScore, `${p}.overallScore`), duplicateRisk: choice(t.duplicateRisk, LEVELS, `${p}.duplicateRisk`),
    duplicateNote: string(t.duplicateNote, `${p}.duplicateNote`), recommendedFormat: choice(t.recommendedFormat, TREND_FORMATS, `${p}.recommendedFormat`),
    recommendedWordCount: integer(t.recommendedWordCount, `${p}.recommendedWordCount`, 1), recommendedAssets: strings(t.recommendedAssets, `${p}.recommendedAssets`),
  };
}

function validateReport(input, partial = false) {
  const report = normalizeReport(input);
  if (Number.isNaN(Date.parse(report.generatedAt)) || !/[zZ]|[+-]\d\d:\d\d$/.test(report.generatedAt || "")) fail("generatedAt", "phải là ISO datetime có timezone.");
  const selectedCount = integer(report.selectedCount, "selectedCount", 1, 10);
  if (!Array.isArray(report.topics) || report.topics.length !== selectedCount || (!partial && selectedCount !== 10)) fail("topics", partial ? "số topic phải bằng selectedCount." : "phải có đúng 10 topic.");
  const topics = report.topics.map(validateTopic);
  if (topics.some((topic, index) => topic.rank !== index + 1)) fail("topics", "rank phải duy nhất và liên tục từ 1.");
  if (topics.some((topic, index) => index > 0 && topics[index - 1].overallScore < topic.overallScore)) fail("topics", "phải được sắp xếp theo overallScore giảm dần.");
  const totalCandidates = integer(report.totalCandidates, "totalCandidates", 10);
  if (totalCandidates < selectedCount) fail("totalCandidates", "phải >= selectedCount.");
  const sources = record(report.sourceSummary, "sourceSummary");
  for (const key of ["googleTrends", "technologyNews", "youtube", "searchConsole", "sanityExistingPosts"]) if (typeof sources[key] !== "boolean") fail(`sourceSummary.${key}`, "phải là boolean.");
  return { ...report, generatedAt: report.generatedAt, sourceSummary: sources, totalCandidates, selectedCount, topics };
}

export function parseTrendReport(input) { return validateReport(input, false); }

function recoverTruncated(text) {
  const key = text.search(/"topics"\s*:/); const start = key < 0 ? -1 : text.indexOf("[", key);
  if (start < 0) return null;
  const topics = []; let objectStart = -1; let depth = 0; let inString = false; let escaped = false;
  for (let i = start + 1; i < text.length; i += 1) { const c = text[i];
    if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true; else if (c === "{") { if (!depth) objectStart = i; depth += 1; }
    else if (c === "}" && depth) { depth -= 1; if (!depth && objectStart >= 0) { try { topics.push(JSON.parse(text.slice(objectStart, i + 1))); } catch { return null; } objectStart = -1; } }
  }
  const generatedAt = text.match(/"generatedAt"\s*:\s*"([^"]+)"/)?.[1];
  const totalCandidates = Number(text.match(/"(?:totalCandidates|candidateCount)"\s*:\s*(\d+)/)?.[1]);
  return topics.length && generatedAt && Number.isFinite(totalCandidates) ? validateReport({ generatedAt, totalCandidates, selectedCount: topics.length, topics }, true) : null;
}

export function parseTrendReportText(text) {
  const json = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return parseTrendReport(JSON.parse(json)); }
  catch (error) {
    if (error instanceof SyntaxError) { const recovered = recoverTruncated(json); if (recovered) return recovered; if (/unexpected end|unterminated/i.test(error.message)) throw new Error("JSON bị Telegram cắt trước khi hoàn tất topic đầu tiên. Hãy đính kèm file .json."); throw new Error("JSON không hợp lệ."); }
    throw error;
  }
}

export async function trendReportIdentity(report) {
  const bytes = new TextEncoder().encode(JSON.stringify(report));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { checksum, reportId: `trendReport-${report.generatedAt.slice(0, 10)}` };
}
