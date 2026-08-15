import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTopic, topicSimilarity, recommendTrendTopic, TREND_DUPLICATE_THRESHOLD } from "../src/domain/trends/recommendation.js";

test("normalizes Vietnamese text identically to Skillgo", () => {
  assert.equal(normalizeTopic("  Tự động hóa & AI! "), "tu dong hoa ai");
});

test("uses the same Dice token similarity", () => {
  assert.equal(topicSimilarity("AI agents for retail", "Retail AI Agents"), 1);
  assert.equal(topicSimilarity("Docker networking", "Email marketing"), 0);
});

test("skips duplicate candidates and recommends the next ranked topic", () => {
  const result = recommendTrendTopic([
    { id: "one", title: "AI Agents for Retail", primaryKeyword: "retail ai agents" },
    { id: "two", title: "Warehouse Robotics", primaryKeyword: "warehouse robots" },
  ], [{ title: "Retail AI Agents", source: "blog" }]);
  assert.equal(result.recommendation.candidate.id, "two");
  assert.equal(result.duplicateChecks[0].candidate.id, "one");
  assert.equal(TREND_DUPLICATE_THRESHOLD, 0.68);
});
