import test from "node:test";
import assert from "node:assert/strict";
import { assertPublishingDependencies, PublishingDependencyError } from "../src/domain/publishing/dependencyGate.js";

test("legacy posts remain outside the Content Planning publishing gate", () => {
  assert.deepEqual(assertPublishingDependencies({ post: { id: "post-1" } }), { managed: false, ready: true });
});

test("managed post is blocked until translation dependencies complete", () => {
  assert.throws(
    () => assertPublishingDependencies({
      post: { id: "post-1", tenant: "tenant-1", site_id: "site-1", content_plan_item_id: "item-1" },
      planItem: { id: "item-1", tenant: "tenant-1", site_id: "site-1", dependencies_ready: false, translation_status: "running" },
    }),
    (error) => error instanceof PublishingDependencyError && error.details.reason === "dependencies_not_ready",
  );
});

test("managed post is publishable only for completed or unnecessary translation", () => {
  const post = { id: "post-1", tenant: "tenant-1", site_id: "site-1", content_plan_item_id: "item-1" };
  for (const translation_status of ["completed", "not_required"]) {
    assert.equal(assertPublishingDependencies({
      post,
      planItem: { id: "item-1", tenant: "tenant-1", site_id: "site-1", dependencies_ready: true, translation_status },
    }).ready, true);
  }
});

test("managed post fails closed on missing or cross-tenant plan item", () => {
  const post = { id: "post-1", tenant: "tenant-1", site_id: "site-1", content_plan_item_id: "item-1" };
  assert.throws(() => assertPublishingDependencies({ post, planItem: null }), /item is missing/i);
  assert.throws(() => assertPublishingDependencies({
    post,
    planItem: { id: "item-1", tenant: "tenant-2", site_id: "site-1", dependencies_ready: true, translation_status: "completed" },
  }), /ownership/i);
});
