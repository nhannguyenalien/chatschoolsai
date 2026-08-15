import test from "node:test";
import assert from "node:assert/strict";
import { createContentPlanningApi } from "../src/api/contentPlanning.js";
import { SiteOwnershipError } from "../src/repositories/pocketbase/contentPlanningRepository.js";

function request(path, body) {
  return new Request(`https://example.test${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function getRequest(path) {
  return new Request(`https://example.test${path}`);
}

function patchRequest(path, body) {
  return new Request(`https://example.test${path}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("rejects unauthenticated content planning requests", async () => {
  const handle = createContentPlanningApi({ repository: {} });
  const response = await handle(request("/api/v1/content-planning/trends/recommend", {}), {});
  assert.equal(response.status, 401);
});

test("uses the authenticated tenant instead of request-controlled data", async () => {
  const calls = [];
  const repository = {
    async assertSiteOwned() {},
    async listRecommendationCandidates(tenant, options) { calls.push({ tenant, options }); return { items: [] }; },
    async listHistoricalTopics() { return []; },
  };
  const handle = createContentPlanningApi({ repository });
  const response = await handle(request("/api/v1/content-planning/trends/recommend", { tenant: "attacker", siteId: "site-a" }), { tenant: "tenant-a" });
  assert.equal(response.status, 200);
  assert.equal(calls[0].tenant, "tenant-a");
});

test("returns null for routes outside the content planning API", async () => {
  const handle = createContentPlanningApi({ repository: {} });
  assert.equal(await handle(request("/api/v1/other", {}), { tenant: "tenant-a" }), null);
});

test("returns a tenant-scoped dashboard review snapshot", async () => {
  const repository = {
    async listActivePlans(tenant) {
      assert.equal(tenant, "tenant-a");
      return { items: [{ id: "plan-1", site_id: "site-1", name: "Main", timezone: "UTC", cadence_json: {} }] };
    },
    async listTopicsForReview(tenant) {
      assert.equal(tenant, "tenant-a");
      return { items: [{ id: "topic-1", site_id: "site-1", title: "Trend", primary_keyword: "trend", overall_score: 9, rank: 1, status: "recommended", internal: "hidden" }] };
    },
    async listPlanItems(planId, statuses) {
      assert.deepEqual([planId, statuses], ["plan-1", ["draft", "review"]]);
      return { items: [{ id: "item-1", plan_id: "plan-1", site_id: "site-1", post_id: "post-1", topic: "Draft", status: "review" }] };
    },
    async getPost() { return { id: "post-1", title: "Draft", content: "Preview", secret: "hidden" }; },
  };
  const api = createContentPlanningApi({ repository });
  const response = await api(getRequest("/api/v1/content-planning/review"), { tenant: "tenant-a" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.topics[0].internal, undefined);
  assert.equal(body.items[0].post.secret, undefined);
});

test("manages tenant-scoped plans and exposes the full schedule queue", async () => {
  const updates = [];
  const repository = {
    async assertSiteOwned(tenant, siteId) { assert.deepEqual([tenant, siteId], ["tenant-a", "site-a"]); },
    async createPlan(value) { return { id: "plan-new", ...value }; },
    async listPlans(tenant) { assert.equal(tenant, "tenant-a"); return { items: [{ id: "plan-1", site_id: "site-a", name: "Daily", timezone: "UTC", cadence_json: '{"days":["all"],"times":["03:00"]}', status: "active" }] }; },
    async listPlanItems() { return { items: [{ id: "item-1", topic: "Topic", content_type: "blog", status: "queued" }] }; },
    async getPlan() { return { id: "plan-1", tenant: "tenant-a", status: "active" }; },
    async updatePlan(id, patch) { updates.push([id, patch]); return { id, ...patch }; },
  };
  const api = createContentPlanningApi({ repository });
  const created = await api(request("/api/v1/content-planning/plans", { tenant: "attacker", siteId: "site-a", name: "Daily", timezone: "UTC", cadence: { days: ["all"], times: ["03:00"] }, status: "active" }), { tenant: "tenant-a" });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).tenant, "tenant-a");
  const overview = await api(getRequest("/api/v1/content-planning/plans"), { tenant: "tenant-a" });
  assert.equal((await overview.json()).plans[0].items[0].status, "queued");
  const updated = await api(patchRequest("/api/v1/content-planning/plans/plan-1", { status: "paused" }), { tenant: "tenant-a" });
  assert.equal(updated.status, 200);
  assert.deepEqual(updates, [["plan-1", { status: "paused" }]]);
});

test("validates import input before invoking the workflow", async () => {
  const handle = createContentPlanningApi({ repository: {} });
  const response = await handle(request("/api/v1/content-planning/trends/import", { trendJson: "" }), { tenant: "tenant-a" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /trendJson/);
});

test("imports tenant-scoped analytics and exposes advisory insights", async () => {
  const records = [];
  const repository = {
    async assertSiteOwned(tenant, siteId) { assert.deepEqual([tenant, siteId], ["tenant-a", "site-a"]); },
    async findPerformanceSnapshot() { return null; },
    async createPerformanceSnapshot(value) { records.push(value); return { id: "metric-1", ...value }; },
    async listPerformanceSnapshots(tenant, siteId, source) { assert.deepEqual([tenant, siteId, source], ["tenant-a", "site-a", "gsc"]); return { items: records }; },
  };
  const api = createContentPlanningApi({ repository });
  const imported = await api(request("/api/v1/content-planning/analytics/import", { tenant: "attacker", siteId: "site-a", snapshots: [{ source: "gsc", externalKey: "/a", windowStart: "2026-07-01", windowEnd: "2026-07-31", metrics: { clicks: 2, impressions: 10, ctr: 0.2, position: 3 } }] }), { tenant: "tenant-a" });
  assert.equal(imported.status, 201);
  const insight = await api(getRequest("/api/v1/content-planning/analytics/insights?siteId=site-a&source=gsc"), { tenant: "tenant-a" });
  assert.equal(insight.status, 200);
  assert.equal((await insight.json()).advisoryOnly, true);
});

test("returns forbidden when a requested site belongs to another tenant", async () => {
  const repository = { async assertSiteOwned(_tenant, siteId) { throw new SiteOwnershipError(siteId); } };
  const handle = createContentPlanningApi({ repository });
  const response = await handle(request("/api/v1/content-planning/trends/recommend", { siteId: "foreign-site" }), { tenant: "tenant-a" });
  assert.equal(response.status, 403);
});

test("returns validation errors instead of masking malformed trend content as 500", async () => {
  const api = createContentPlanningApi({ repository: {} });
  const response = await api(request("/api/v1/content-planning/trends/import", { trendJson: "{}" }), { tenant: "tenant-a" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /generatedAt|topics|report|field/i);
});

test("returns conflict for an invalid topic state transition", async () => {
  const repository = {
    async getTrendTopic() { return { id: "topic-1", tenant: "tenant-a", site_id: "", status: "rejected" }; },
  };
  const api = createContentPlanningApi({ repository });
  const response = await api(request("/api/v1/content-planning/topics/topic-1/review", { action: "approve" }), { tenant: "tenant-a" });
  assert.equal(response.status, 409);
});

test("adds an approved topic to a plan without accepting request tenant", async () => {
  const calls = [];
  const repository = {
    async getPlan() { return { id: "plan-1", tenant: "tenant-a", site_id: "site-a", status: "active" }; },
    async getTrendTopic() { return { id: "topic-1", tenant: "tenant-a", site_id: "site-a", status: "approved", title: "Topic" }; },
    async findPlanItemByTopic() { return null; }, async nextPlanItemOrder() { return 1; },
    async createPlanItem(value) { calls.push(value); return { id: "item-1", ...value }; },
    async updateTrendTopic(id, patch) { return { id, ...patch }; },
  };
  const api = createContentPlanningApi({ repository });
  const response = await api(request("/api/v1/content-planning/plans/plan-1/items/from-topic", { tenant: "attacker", topicId: "topic-1" }), { tenant: "tenant-a" });
  assert.equal(response.status, 201); assert.equal(calls[0].tenant, "tenant-a");
});

test("approves and adds a dashboard topic through one endpoint", async () => {
  const topic = { id: "topic-1", tenant: "tenant-a", site_id: "site-a", status: "recommended", title: "Topic" };
  const repository = {
    async getPlan() { return { id: "plan-1", tenant: "tenant-a", site_id: "site-a", status: "active" }; },
    async getTrendTopic() { return topic; }, async findPlanItemByTopic() { return null; }, async nextPlanItemOrder() { return 1; },
    async createPlanItem(value) { return { id: "item-1", ...value }; },
    async updateTrendTopic(_id, patch) { Object.assign(topic, patch); return { ...topic }; },
  };
  const api = createContentPlanningApi({ repository });
  const response = await api(request("/api/v1/content-planning/topics/topic-1/approve-to-plan", { planId: "plan-1", tenant: "attacker" }), { tenant: "tenant-a" });
  assert.equal(response.status, 201); assert.equal(topic.status, "consumed");
});

test("schedules a plan with authenticated tenant and validates horizon", async () => {
  const repository = {
    async getPlan() { return { tenant: "tenant-a", site_id: "site-a", status: "active", timezone: "UTC", cadence_json: { days: ["all"], times: ["03:00"] } }; },
    async listUnscheduledPlanItems() { return { items: [] }; }, async listScheduledPlanItems() { return { items: [] }; },
  };
  const api = createContentPlanningApi({ repository });
  const response = await api(request("/api/v1/content-planning/plans/plan-1/schedule", { tenant: "attacker", horizonDays: 7 }), { tenant: "tenant-a" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).planId, "plan-1");
  const invalid = await api(request("/api/v1/content-planning/plans/plan-1/schedule", { horizonDays: 0 }), { tenant: "tenant-a" });
  assert.equal(invalid.status, 400);
});

test("returns service unavailable when blog generation AI is not configured", async () => {
  const api = createContentPlanningApi({ repository: {} });
  const response = await api(request("/api/v1/content-planning/items/item-1/generate", {}), { tenant: "tenant-a" });
  assert.equal(response.status, 503);
});

test("generates a blog for the authenticated tenant through the API", async () => {
  const tenants = [];
  const repository = {
    async getPlanItem() { return { id: "item-1", tenant: "tenant-a", site_id: "site-1", content_type: "blog", topic: "Git", status: "queued" }; },
    async assertSiteOwned(tenant) { tenants.push(tenant); return { platform: "sanity", page_id: "project:dataset", default_language: "vi" }; },
    async tryClaimGeneration() { return { id: "claim-1" }; }, async updatePlanItem(id, patch) { return { id, ...patch }; },
    async listRelatedPosts() { return []; }, async createPost(value) { return { id: "post-1", ...value }; },
    async createPostTarget(value) { return { id: "target-1", ...value }; }, async completeGenerationClaim() {},
  };
  const blogWriter = { async generate() { return { title: "Git", metaDescription: "Learn Git", sections: [{ heading: "Start", paragraphs: ["Use Git."], imageAlt: "Git branches" }], wikipediaReferences: [] }; } };
  const api = createContentPlanningApi({ repository, blogWriter });
  const response = await api(request("/api/v1/content-planning/items/item-1/generate", { tenant: "attacker" }), { tenant: "tenant-a" });
  assert.equal(response.status, 201);
  assert.deepEqual(tenants, ["tenant-a"]);
  assert.equal((await response.json()).post.id, "post-1");
});

test("runs translation for the authenticated tenant and reports partial failure", async () => {
  const repository = {
    async getPlanItem() { return { id: "item-1", tenant: "tenant-a", site_id: "site-1", post_id: "post-1", status: "draft" }; },
    async assertSiteOwned() { return { default_language: "en", translation_languages_json: '["vi"]', platform: "sanity", page_id: "p:d" }; },
    async getPost() { return { id: "post-1", language: "en", content_json: JSON.stringify({ version: 1, draft: { title: "Git", metaDescription: "Learn", sections: [{ heading: "Start", paragraphs: ["Use Git"], imageAlt: "Git" }], wikipediaReferences: [] }, relatedPosts: [], sectionImages: [] }) }; },
    async updatePlanItem(id, patch) { return { id, ...patch }; }, async findTranslationJob() { return null; },
    async tryCreateTranslationJob(value) { return { id: "job-1", ...value }; }, async updateTranslationJob(id, patch) { return { id, ...patch }; },
  };
  const translator = { async translate() { throw new Error("upstream unavailable"); } };
  const api = createContentPlanningApi({ repository, translator });
  const response = await api(request("/api/v1/content-planning/items/item-1/translate", { tenant: "attacker" }), { tenant: "tenant-a" });
  assert.equal(response.status, 502);
  assert.deepEqual((await response.json()).failedLanguages, ["vi"]);
});

test("returns conflict when publishing dependencies are not ready", async () => {
  const repository = {
    async getPlanItem() {
      return { id: "item-1", tenant: "tenant-a", site_id: "site-1", post_id: "post-1", status: "review", dependencies_ready: false, translation_status: "pending" };
    },
    async assertSiteOwned() { return { default_language: "en", translation_languages_json: "[]" }; },
    async getPost() { return { id: "post-1", tenant: "tenant-a", site_id: "site-1", content_plan_item_id: "item-1" }; },
  };
  const api = createContentPlanningApi({ repository });
  const response = await api(request("/api/v1/content-planning/items/item-1/approve", {}), { tenant: "tenant-a" });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Content Planning dependencies are not ready.",
    details: { reason: "dependencies_not_ready", translationStatus: "pending" },
  });
});

test("rejects a generated draft through the authenticated content planning API", async () => {
  const deleted = [];
  const repository = {
    async getPlanItem() { return { id: "item-1", tenant: "tenant-a", post_id: "post-1", status: "draft" }; },
    async getPost() { return { id: "post-1", tenant: "tenant-a" }; }, async listTranslatedPosts() { return []; },
    async listPostTargets() { return [{ id: "target-1", status: "pending" }]; },
    async updatePlanItem(id, patch) { return { id, ...patch }; }, async deletePost(id) { deleted.push(id); },
  };
  const api = createContentPlanningApi({ repository });
  const response = await api(request("/api/v1/content-planning/items/item-1/reject", { tenant: "attacker" }), { tenant: "tenant-a" });
  assert.equal(response.status, 200);
  assert.deepEqual(deleted, ["post-1"]);
});
