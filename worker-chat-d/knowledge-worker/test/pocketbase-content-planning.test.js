import test from "node:test";
import assert from "node:assert/strict";
import { createPocketBaseClient, escapePocketBaseFilter, PocketBaseRepositoryError } from "../src/repositories/pocketbase/client.js";
import { createContentPlanningRepository, SiteOwnershipError } from "../src/repositories/pocketbase/contentPlanningRepository.js";

function response(body, status = 200) {
  return new Response(body == null ? "" : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("escapes tenant values used in PocketBase filters", () => {
  assert.equal(escapePocketBaseFilter("a'b\\c"), "a\\'b\\\\c");
});

test("repository scopes recommendation candidates by tenant and site", async () => {
  let requestedUrl;
  const client = createPocketBaseClient({ baseUrl: "https://pb.example/", token: "Admin test", fetchImpl: async (url) => {
    requestedUrl = url;
    return response({ items: [] });
  } });
  await createContentPlanningRepository(client).listRecommendationCandidates("tenant-a", { siteId: "site-1" });
  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/api/collections/trend_topics/records");
  assert.equal(url.searchParams.get("filter"), "tenant='tenant-a' && site_id='site-1' && status='imported'");
  assert.equal(url.searchParams.get("sort"), "rank");
});

test("requires site ownership before creating a plan", async () => {
  const repository = createContentPlanningRepository({ create() { throw new Error("should not write"); } });
  assert.throws(() => repository.createPlan({ tenant: "tenant-a" }), /requires site_id/);
});

test("verifies a site belongs to the authenticated tenant", async () => {
  const owned = createContentPlanningRepository({ async get() { return { id: "site-1", tenant: "tenant-a" }; } });
  assert.equal((await owned.assertSiteOwned("tenant-a", "site-1")).id, "site-1");

  const foreign = createContentPlanningRepository({ async get() { return { id: "site-1", tenant: "tenant-b" }; } });
  await assert.rejects(() => foreign.assertSiteOwned("tenant-a", "site-1"), SiteOwnershipError);

  const missing = createContentPlanningRepository({ async get() { throw new Error("404"); } });
  await assert.rejects(() => missing.assertSiteOwned("tenant-a", "site-404"), SiteOwnershipError);
});

test("surfaces PocketBase response failures with operation and status", async () => {
  const client = createPocketBaseClient({ baseUrl: "https://pb.example", token: "Admin test", fetchImpl: async () => response({ message: "bad record" }, 400) });
  await assert.rejects(() => client.create("trend_reports", {}), (error) => {
    assert.ok(error instanceof PocketBaseRepositoryError);
    assert.equal(error.status, 400);
    assert.match(error.message, /create trend_reports/);
    return true;
  });
});

test("treats a unique recommendation claim collision as lost contention", async () => {
  const calls = [];
  const client = {
    async create(collection, record) { calls.push(["create", collection, record]); throw new Error("unique constraint"); },
    async list(collection, options) { calls.push(["list", collection, options]); return { items: [{ id: "winner" }] }; },
  };
  const result = await createContentPlanningRepository(client).tryClaimRecommendation({
    tenant: "tenant-a", siteId: "site-a", topicId: "topic-1", reservationId: "reservation-a",
    claimedAt: "2026-08-05T08:00:00.000Z",
  });
  assert.equal(result, null);
  assert.equal(calls[0][1], "recommendation_claims");
  assert.equal(calls[1][2].filter, "topic_id='topic-1'");
});
