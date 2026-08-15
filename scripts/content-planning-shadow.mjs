import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  normalizeTopic, recommendTrendTopic, topicSimilarity, TREND_DUPLICATE_THRESHOLD,
} from "../worker-chat-d/knowledge-worker/src/domain/trends/recommendation.js";
import {
  buildCadenceSlots, SKILLGO_DAILY_BLOG_CADENCE,
} from "../worker-chat-d/knowledge-worker/src/domain/content-plans/cadence.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillgoRoot = process.env.SKILLGO_ROOT || "/Users/nhannguyen/Desktop/spacehuge/uischoolai/skillgro-v1.4";
const fixturePath = path.join(projectRoot, "scripts/content-planning-shadow-fixtures.json");
const runnerPath = path.join(projectRoot, "scripts/skillgo-shadow-runner.ts");
const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));

const skillgoProcess = spawnSync(process.execPath, [path.join(skillgoRoot, "node_modules/tsx/dist/cli.mjs"), runnerPath, fixturePath], {
  encoding: "utf8",
  env: {
    ...process.env,
    SKILLGO_RECOMMENDATION_MODULE: path.join(skillgoRoot, "src/lib/trendRecommendation.ts"),
  },
});
if (skillgoProcess.status !== 0) {
  throw new Error(`Skillgo shadow runner failed: ${skillgoProcess.stderr.trim() || `exit ${skillgoProcess.status}`}`);
}
const skillgo = JSON.parse(skillgoProcess.stdout);

const dashpoc = {
  threshold: TREND_DUPLICATE_THRESHOLD,
  similarities: fixtures.similarityCases.map(({ left, right }) => ({
    normalizedLeft: normalizeTopic(left),
    normalizedRight: normalizeTopic(right),
    similarity: topicSimilarity(left, right),
  })),
  recommendations: fixtures.recommendationCases.map(({ candidates, history }) => {
    const recommendation = recommendTrendTopic(candidates, history);
    return {
      recommendationId: recommendation.recommendation?.candidate.id ?? null,
      duplicateIds: recommendation.duplicateChecks.map((item) => item.candidate.id),
    };
  }),
};

assert.deepEqual(dashpoc, skillgo, "Dashpoc recommendation behaviour diverged from Skillgo.");
fixtures.similarityCases.forEach((fixture, index) => assert.equal(dashpoc.similarities[index].similarity, fixture.expected));
fixtures.recommendationCases.forEach((fixture, index) => {
  assert.equal(dashpoc.recommendations[index].recommendationId, fixture.expectedRecommendationId, fixture.name);
  assert.deepEqual(dashpoc.recommendations[index].duplicateIds, fixture.expectedDuplicateIds, fixture.name);
});
assert.deepEqual(buildCadenceSlots({
  cadence: SKILLGO_DAILY_BLOG_CADENCE,
  timeZone: "UTC",
  from: fixtures.cadence.from,
  until: fixtures.cadence.until,
}), fixtures.cadence.expectedSkillgoSlots);

process.stdout.write(`PASS: Skillgo/Dashpoc parity (${fixtures.similarityCases.length} similarity, ${fixtures.recommendationCases.length} recommendation, 1 cadence scenario).\n`);
