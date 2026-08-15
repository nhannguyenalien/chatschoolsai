import test from "node:test";
import assert from "node:assert/strict";
import { parseTrendReport, parseTrendReportText, trendReportIdentity } from "../src/domain/trends/import.js";

function validReport() {
  return { generatedAt: "2026-08-05T08:00:00+07:00", sourceSummary: { googleTrends: true, technologyNews: true, youtube: true, searchConsole: false, sanityExistingPosts: false }, totalCandidates: 42, selectedCount: 10,
    topics: Array.from({ length: 10 }, (_, index) => ({ rank: index + 1, title: `Topic ${index + 1}`, category: "education", primaryKeyword: `keyword ${index + 1}`, secondaryKeywords: ["secondary"], longTailKeywords: ["long tail"], searchIntent: ["informational"], trendReason: "Đang tăng trưởng.", suggestedAngle: "Góc thực tế.", targetAudience: ["Chủ doanh nghiệp"], competition: "medium", conversionPotential: "high", contentDepthPotential: "high", noveltyScore: 90-index, trendScore: 90-index, relevanceScore: 90-index, conversionScore: 90-index, competitionScore: 70-index, overallScore: 100-index, duplicateRisk: "low", duplicateNote: "Chưa trùng.", recommendedFormat: "pillar", recommendedWordCount: 2500, recommendedAssets: ["hero"] })) };
}

test("accepts exactly ten ranked topics and has stable identity", async () => {
  const first = parseTrendReport(validReport()); const second = parseTrendReport(validReport());
  assert.equal(first.topics.length, 10); assert.deepEqual(await trendReportIdentity(first), await trendReportIdentity(second));
});

test("normalizes compact collector aliases", () => {
  const report = validReport();
  const compact = { generatedAt: report.generatedAt, candidateCount: 42, selectedCount: 10, topics: report.topics.map((t, i) => ({ ...t, searchIntent: t.searchIntent[0], contentAngle: t.suggestedAngle, suggestedAngle: undefined, conversion: i ? t.conversionPotential : "very-high", conversionPotential: undefined, recommendedFormat: i === 9 ? "listicle" : t.recommendedFormat, wordCount: t.recommendedWordCount, recommendedWordCount: undefined })) };
  const parsed = parseTrendReportText(`\`\`\`json\n${JSON.stringify(compact)}\n\`\`\``);
  assert.deepEqual(parsed.topics[0].searchIntent, ["informational"]); assert.equal(parsed.topics[0].conversionPotential, "high"); assert.equal(parsed.topics[9].recommendedFormat, "how-to");
});

test("recovers complete topics from Telegram-truncated JSON", () => {
  const report = validReport(); const json = JSON.stringify(report); const cut = json.indexOf(JSON.stringify(report.topics[3])) + 25;
  const recovered = parseTrendReportText(json.slice(0, cut));
  assert.equal(recovered.selectedCount, 3); assert.deepEqual(recovered.topics.map((t) => t.rank), [1, 2, 3]);
});

test("rejects malformed, incomplete, wrongly-ranked and ascending reports", () => {
  assert.throws(() => parseTrendReportText("{bad"), /JSON không hợp lệ/); assert.throws(() => parseTrendReportText('{"topics": ['), /Telegram cắt/);
  const short = validReport(); short.topics.pop(); assert.throws(() => parseTrendReport(short));
  const wrong = validReport(); wrong.topics[0].rank = 2; wrong.topics[1].overallScore = 101; assert.throws(() => parseTrendReport(wrong));
});
