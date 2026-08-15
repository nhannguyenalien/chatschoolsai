import test from "node:test";
import assert from "node:assert/strict";
import { importTrend, TrendImportCompensationError } from "../src/workflows/importTrend.js";
import { recommendTopic } from "../src/workflows/recommendTopic.js";
import { reviewTopic } from "../src/workflows/reviewTopic.js";
import { addApprovedTopicToPlan, PlanItemCompensationError } from "../src/workflows/addApprovedTopicToPlan.js";
import { approveTopicToPlan, TopicApprovalCompensationError } from "../src/workflows/approveTopicToPlan.js";
import { scheduleContentPlan, ScheduleClaimCompensationError } from "../src/workflows/scheduleContentPlan.js";

function validReportText() {
  return JSON.stringify({ generatedAt: "2026-08-05T08:00:00+07:00", sourceSummary: { googleTrends: true, technologyNews: true, youtube: true, searchConsole: false, sanityExistingPosts: false }, totalCandidates: 20, selectedCount: 10,
    topics: Array.from({ length: 10 }, (_, i) => ({ rank: i+1, title: `Topic ${i+1}`, category: "education", primaryKeyword: `keyword ${i+1}`, secondaryKeywords: ["secondary"], longTailKeywords: ["long tail"], searchIntent: ["informational"], trendReason: "Growing", suggestedAngle: "Practical", targetAudience: ["Owner"], competition: "medium", conversionPotential: "high", contentDepthPotential: "high", noveltyScore: 90-i, trendScore: 90-i, relevanceScore: 90-i, conversionScore: 90-i, competitionScore: 70-i, overallScore: 100-i, duplicateRisk: "low", duplicateNote: "None", recommendedFormat: "pillar", recommendedWordCount: 2500, recommendedAssets: ["hero"] })) });
}

test("imports one report and all topics", async () => {
  const created = [];
  const repository = { async assertSiteOwned() {}, async findTrendImport() { return null; }, async createTrendReport(value) { created.push(["report", value]); return { id: "report-1", ...value }; }, async createTrendTopic(value) { created.push(["topic", value]); return { id: `topic-${value.rank}`, ...value }; } };
  const result = await importTrend({ repository, tenant: "tenant-a", siteId: "site-a", text: validReportText() });
  assert.equal(result.topics.length, 10); assert.equal(created.length, 11); assert.equal(result.report.site_id, "site-a"); assert.equal(result.recovered, false);
});

test("compensates report and created topics when a child write fails", async () => {
  const deleted = [];
  const repository = { async findTrendImport() { return null; }, async createTrendReport() { return { id: "report-1" }; }, async createTrendTopic(value) { if (value.rank === 3) throw new Error("write failed"); return { id: `topic-${value.rank}` }; }, async deleteTrendTopic(id) { deleted.push(id); }, async deleteTrendReport(id) { deleted.push(id); } };
  await assert.rejects(() => importTrend({ repository, tenant: "tenant-a", text: validReportText() }), /write failed/);
  assert.deepEqual(deleted, ["topic-2", "topic-1", "report-1"]);
});

test("reports an incomplete compensation separately", async () => {
  const repository = { async findTrendImport() { return null; }, async createTrendReport() { return { id: "report-1" }; }, async createTrendTopic(value) { if (value.rank === 2) throw new Error("write failed"); return { id: "topic-1" }; }, async deleteTrendTopic() { throw new Error("cleanup failed"); }, async deleteTrendReport() {} };
  await assert.rejects(() => importTrend({ repository, tenant: "tenant-a", text: validReportText() }), (error) => error instanceof TrendImportCompensationError && error.cleanupErrors.length === 1);
});

test("returns an existing import without writing duplicate records", async () => {
  const repository = { async findTrendImport() { return { report: { id: "report-1" }, topics: [{ id: "topic-1" }] }; }, async createTrendReport() { throw new Error("should not write"); } };
  const result = await importTrend({ repository, tenant: "tenant-a", text: validReportText() });
  assert.equal(result.duplicate, true);
  assert.equal(result.report.id, "report-1");
});

test("recovers an idempotent import race after the unique write loses", async () => {
  let checks = 0;
  const repository = {
    async findTrendImport() { checks += 1; return checks === 1 ? null : { report: { id: "winner" }, topics: [] }; },
    async createTrendReport() { throw new Error("unique constraint"); },
  };
  const result = await importTrend({ repository, tenant: "tenant-a", text: validReportText() });
  assert.equal(result.duplicate, true);
  assert.equal(result.report.id, "winner");
});

test("recommends the first non-duplicate candidate and persists its state", async () => {
  const updates = [];
  const repository = { async assertSiteOwned() {}, async listRecommendationCandidates() { return { items: [{ id: "one", title: "Retail AI", primary_keyword: "retail ai", rank: 1, overall_score: 99 }, { id: "two", title: "Warehouse Robotics", primary_keyword: "warehouse robots", rank: 2, overall_score: 98 }] }; }, async listHistoricalTopics() { return [{ title: "AI for Retail", source: "blog" }]; }, async tryClaimRecommendation(value) { return { id: "claim-1", reservation_id: value.reservationId, claimed_at: value.claimedAt }; }, async updateTrendTopic(id, patch) { updates.push({ id, patch }); } };
  const result = await recommendTopic({ repository, tenant: "tenant-a", siteId: "site-a" });
  assert.equal(result.recommendation.candidate.id, "two"); assert.equal(updates[0].patch.status, "recommended");
  assert.equal(JSON.parse(updates[0].patch.duplicate_check_json).threshold, 0.68);
});

test("includes legacy Sanity history when checking duplicates", async () => {
  const repository = {
    async assertSiteOwned() { return { platform: "sanity", page_id: "project:production" }; },
    async listRecommendationCandidates() { return { items: [{ id: "one", title: "Legacy article", primary_keyword: "legacy", rank: 1 }] }; },
    async listHistoricalTopics() { return [{ title: "PocketBase article", source: "blog" }]; },
  };
  const legacyHistoryAdapter = {
    supports() { return true; },
    async listHistoricalTopics() { return [{ title: "Legacy article", source: "legacy-sanity" }]; },
  };
  const result = await recommendTopic({ repository, legacyHistoryAdapter, tenant: "tenant-a", siteId: "site-a" });
  assert.equal(result.recommendation, null);
  assert.equal(result.historyCount, 2);
  assert.deepEqual(result.historySources, { pocketbase: 1, legacySanity: 1 });
});

test("fails closed when required legacy history cannot be read", async () => {
  const repository = {
    async assertSiteOwned() { return { platform: "sanity", page_id: "project:production" }; },
    async listRecommendationCandidates() { return { items: [] }; },
    async listHistoricalTopics() { return []; },
  };
  const legacyHistoryAdapter = { supports() { return true; }, async listHistoricalTopics() { throw new Error("history unavailable"); } };
  await assert.rejects(
    () => recommendTopic({ repository, legacyHistoryAdapter, tenant: "tenant-a", siteId: "site-a" }),
    /history unavailable/,
  );
});

test("skips a recommendation claimed by a concurrent request", async () => {
  const claimed = [];
  const repository = {
    async listRecommendationCandidates() { return { items: [
      { id: "one", title: "First topic", primary_keyword: "first", rank: 1, overall_score: 99 },
      { id: "two", title: "Second topic", primary_keyword: "second", rank: 2, overall_score: 98 },
    ] }; },
    async listHistoricalTopics() { return []; },
    async tryClaimRecommendation(value) {
      claimed.push(value.topicId);
      return value.topicId === "one" ? null : { id: "claim-2", reservation_id: value.reservationId, claimed_at: value.claimedAt };
    },
    async updateTrendTopic() {},
  };
  const result = await recommendTopic({ repository, tenant: "tenant-a" });
  assert.equal(result.recommendation.candidate.id, "two");
  assert.deepEqual(claimed, ["one", "two"]);
  assert.equal(result.contentionCount, 1);
});

test("releases the atomic claim when the topic update fails", async () => {
  const released = [];
  const repository = {
    async listRecommendationCandidates() { return { items: [{ id: "one", title: "First topic", primary_keyword: "first", rank: 1 }] }; },
    async listHistoricalTopics() { return []; },
    async tryClaimRecommendation(value) { return { id: "claim-1", reservation_id: value.reservationId, claimed_at: value.claimedAt }; },
    async updateTrendTopic() { throw new Error("update failed"); },
    async releaseRecommendationClaim(id) { released.push(id); },
  };
  await assert.rejects(() => recommendTopic({ repository, tenant: "tenant-a" }), /update failed/);
  assert.deepEqual(released, ["claim-1"]);
});

test("enforces topic ownership and review transitions", async () => {
  const repository = { async getTrendTopic() { return { id: "topic-1", tenant: "tenant-a", site_id: "site-a", status: "recommended" }; }, async updateTrendTopic(id, patch) { return { id, ...patch }; } };
  assert.equal((await reviewTopic({ repository, tenant: "tenant-a", siteId: "site-a", topicId: "topic-1", action: "approve" })).status, "approved");
  await assert.rejects(() => reviewTopic({ repository, tenant: "tenant-b", topicId: "topic-1", action: "approve" }), /does not belong/);
});

test("adds an approved topic to a tenant-owned plan and consumes it", async () => {
  const writes = [];
  const repository = {
    async getPlan() { return { id: "plan-1", tenant: "tenant-a", site_id: "site-a", status: "active" }; },
    async getTrendTopic() { return { id: "topic-1", tenant: "tenant-a", site_id: "site-a", status: "approved", title: "Robotics" }; },
    async findPlanItemByTopic() { return null; }, async nextPlanItemOrder() { return 4; },
    async createPlanItem(value) { writes.push(value); return { id: "item-1", ...value }; },
    async updateTrendTopic(id, patch) { return { id, ...patch }; },
  };
  const result = await addApprovedTopicToPlan({ repository, tenant: "tenant-a", planId: "plan-1", topicId: "topic-1" });
  assert.equal(result.item.order, 4); assert.equal(result.item.status, "queued");
  assert.equal(result.topic.status, "consumed"); assert.equal(result.duplicate, false);
  assert.equal(writes[0].site_id, "site-a");
});

test("approves and queues a recommended topic as one compensated workflow", async () => {
  const topic = { id: "topic-1", tenant: "tenant-a", site_id: "site-a", status: "recommended", title: "Robotics" };
  const repository = {
    async getPlan() { return { id: "plan-1", tenant: "tenant-a", site_id: "site-a", status: "active" }; },
    async getTrendTopic() { return topic; }, async findPlanItemByTopic() { return null; }, async nextPlanItemOrder() { return 1; },
    async createPlanItem(value) { return { id: "item-1", ...value }; },
    async updateTrendTopic(_id, patch) { Object.assign(topic, patch); return { ...topic }; },
  };
  const result = await approveTopicToPlan({ repository, tenant: "tenant-a", planId: "plan-1", topicId: "topic-1" });
  assert.equal(result.item.status, "queued"); assert.equal(topic.status, "consumed");
});

test("restores topic review state when adding it to the plan fails", async () => {
  const writes = [];
  const topic = { id: "topic-1", tenant: "tenant-a", site_id: "site-a", status: "recommended", title: "Robotics" };
  const repository = {
    async getPlan() { return { id: "plan-1", tenant: "tenant-a", site_id: "site-a", status: "paused" }; },
    async getTrendTopic() { return topic; },
    async updateTrendTopic(_id, patch) { writes.push(patch.status); Object.assign(topic, patch); return { ...topic }; },
  };
  await assert.rejects(() => approveTopicToPlan({ repository, tenant: "tenant-a", planId: "plan-1", topicId: "topic-1" }), /paused/);
  assert.deepEqual(writes, ["approved", "recommended"]);
  repository.updateTrendTopic = async (_id, patch) => { if (patch.status === "recommended") throw new Error("restore failed"); Object.assign(topic, patch); };
  topic.status = "recommended";
  await assert.rejects(() => approveTopicToPlan({ repository, tenant: "tenant-a", planId: "plan-1", topicId: "topic-1" }), TopicApprovalCompensationError);
});

test("returns the concurrent winner when a unique topic-to-plan insert loses", async () => {
  let lookup = 0;
  const repository = {
    async getPlan() { return { tenant: "tenant-a", site_id: "site-a", status: "draft" }; },
    async getTrendTopic() { return { tenant: "tenant-a", site_id: "site-a", status: "approved", title: "Topic" }; },
    async findPlanItemByTopic() { lookup += 1; return lookup === 1 ? null : { id: "winner" }; },
    async nextPlanItemOrder() { return 1; }, async createPlanItem() { throw new Error("unique"); },
  };
  const result = await addApprovedTopicToPlan({ repository, tenant: "tenant-a", planId: "plan-1", topicId: "topic-1" });
  assert.equal(result.item.id, "winner"); assert.equal(result.duplicate, true);
});

test("compensates a new plan item when consuming its topic fails", async () => {
  const removed = [];
  const repository = {
    async getPlan() { return { tenant: "tenant-a", site_id: "site-a", status: "active" }; },
    async getTrendTopic() { return { tenant: "tenant-a", site_id: "site-a", status: "approved", title: "Topic" }; },
    async findPlanItemByTopic() { return null; }, async nextPlanItemOrder() { return 1; },
    async createPlanItem() { return { id: "item-1" }; }, async updateTrendTopic() { throw new Error("topic write failed"); },
    async deletePlanItem(id) { removed.push(id); },
  };
  await assert.rejects(() => addApprovedTopicToPlan({ repository, tenant: "tenant-a", planId: "plan-1", topicId: "topic-1" }), /topic write failed/);
  assert.deepEqual(removed, ["item-1"]);
  repository.deletePlanItem = async () => { throw new Error("cleanup failed"); };
  await assert.rejects(() => addApprovedTopicToPlan({ repository, tenant: "tenant-a", planId: "plan-1", topicId: "topic-1" }), PlanItemCompensationError);
});

test("schedules queued plan items FIFO and skips occupied cadence slots", async () => {
  const claims = [];
  const updates = [];
  const repository = {
    async getPlan() { return { tenant: "tenant-a", site_id: "site-a", status: "active", timezone: "UTC", cadence_json: JSON.stringify({ days: ["all"], times: ["03:00"] }) }; },
    async listUnscheduledPlanItems() { return { items: [{ id: "item-1" }, { id: "item-2" }] }; },
    async listScheduledPlanItems() { return { items: [{ scheduled_at: "2026-08-05T03:00:00.000Z" }] }; },
    async tryClaimSchedule(value) { claims.push(value); return { id: `claim-${value.itemId}` }; },
    async updatePlanItem(id, patch) { updates.push({ id, patch }); return { id, ...patch }; },
  };
  const result = await scheduleContentPlan({ repository, tenant: "tenant-a", planId: "plan-1", now: new Date("2026-08-05T02:00:00.000Z"), horizonDays: 3 });
  assert.deepEqual(updates.map((entry) => entry.patch.scheduled_at), ["2026-08-06T03:00:00.000Z", "2026-08-07T03:00:00.000Z"]);
  assert.equal(claims.length, 2);
  assert.equal(result.remaining, 0);
});

test("fails closed for a paused or foreign content plan", async () => {
  const paused = { async getPlan() { return { tenant: "tenant-a", status: "paused" }; } };
  await assert.rejects(() => scheduleContentPlan({ repository: paused, tenant: "tenant-a", planId: "plan-1" }), /paused/);
  const foreign = { async getPlan() { return { tenant: "tenant-b", status: "active" }; } };
  await assert.rejects(() => scheduleContentPlan({ repository: foreign, tenant: "tenant-a", planId: "plan-1" }), /does not belong/);
});

test("rejects invalid scheduler and plan date boundaries", async () => {
  const repository = {
    async getPlan() { return { tenant: "tenant-a", status: "active", starts_at: "not-a-date" }; },
  };
  await assert.rejects(
    () => scheduleContentPlan({ repository, tenant: "tenant-a", planId: "plan-1" }),
    /starts_at must be a valid date/,
  );
  repository.getPlan = async () => ({ tenant: "tenant-a", status: "active", ends_at: "not-a-date" });
  await assert.rejects(
    () => scheduleContentPlan({ repository, tenant: "tenant-a", planId: "plan-1" }),
    /ends_at must be a valid date/,
  );
  await assert.rejects(
    () => scheduleContentPlan({ repository, tenant: "tenant-a", planId: "plan-1", now: "not-a-date" }),
    /now must be a valid date/,
  );
});

test("leaves a contended item queued and does not reuse its attempted slot", async () => {
  const attempts = [];
  const repository = {
    async getPlan() { return { tenant: "tenant-a", site_id: "site-a", status: "active", timezone: "UTC", cadence_json: { days: ["all"], times: ["03:00"] } }; },
    async listUnscheduledPlanItems() { return { items: [{ id: "item-1" }, { id: "item-2" }] }; },
    async listScheduledPlanItems() { return { items: [] }; },
    async tryClaimSchedule(value) { attempts.push(value); return value.itemId === "item-1" ? null : { id: "claim-2" }; },
    async updatePlanItem(id, patch) { return { id, ...patch }; },
  };
  const result = await scheduleContentPlan({ repository, tenant: "tenant-a", planId: "plan-1", now: new Date("2026-08-05T02:00:00.000Z"), horizonDays: 2 });
  assert.deepEqual(attempts.map((attempt) => attempt.slot), ["2026-08-05T03:00:00.000Z", "2026-08-06T03:00:00.000Z"]);
  assert.equal(result.contentionCount, 1);
  assert.equal(result.assignments[0].item.id, "item-2");
  assert.equal(result.remaining, 1);
});

test("releases a schedule claim if assigning scheduled_at fails", async () => {
  const released = [];
  const repository = {
    async getPlan() { return { tenant: "tenant-a", site_id: "site-a", status: "active", timezone: "UTC", cadence_json: { days: ["all"], times: ["03:00"] } }; },
    async listUnscheduledPlanItems() { return { items: [{ id: "item-1" }] }; }, async listScheduledPlanItems() { return { items: [] }; },
    async tryClaimSchedule() { return { id: "claim-1" }; }, async updatePlanItem() { throw new Error("patch failed"); },
    async releaseScheduleClaim(id) { released.push(id); },
  };
  await assert.rejects(() => scheduleContentPlan({ repository, tenant: "tenant-a", planId: "plan-1", now: new Date("2026-08-05T02:00:00.000Z") }), /patch failed/);
  assert.deepEqual(released, ["claim-1"]);
  repository.releaseScheduleClaim = async () => { throw new Error("cleanup failed"); };
  await assert.rejects(() => scheduleContentPlan({ repository, tenant: "tenant-a", planId: "plan-1", now: new Date("2026-08-05T02:00:00.000Z") }), ScheduleClaimCompensationError);
});
