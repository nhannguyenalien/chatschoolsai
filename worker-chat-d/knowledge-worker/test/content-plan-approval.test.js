import test from "node:test";
import assert from "node:assert/strict";
import { approveContentPlanItem } from "../src/workflows/approveContentPlanItem.js";

function fixture({ failUpdate = false } = {}) {
  const targetStates = new Map([["target-en", "pending"], ["target-vi", "pending"]]);
  const source = { id: "post-en", tenant: "tenant-a", site_id: "site-1", content_plan_item_id: "item-1" };
  const repository = {
    async getPlanItem() { return { id: "item-1", tenant: "tenant-a", site_id: "site-1", post_id: "post-en", status: "review", dependencies_ready: true, translation_status: "completed" }; },
    async assertSiteOwned() { return { id: "site-1", default_language: "en", translation_languages_json: '["vi"]' }; },
    async getPost() { return source; },
    async findTranslatedPost() { return { id: "post-vi", tenant: "tenant-a", site_id: "site-1", content_plan_item_id: "item-1", translation_of: "post-en" }; },
    async listPostTargets(_tenant, postId) { const id = postId === "post-en" ? "target-en" : "target-vi"; return [{ id, status: targetStates.get(id) }]; },
    async updatePostTarget(id, patch) { if (failUpdate && id === "target-vi" && patch.status === "approved") throw new Error("write failed"); targetStates.set(id, patch.status); return { id, ...patch }; },
    async updatePlanItem(id, patch) { return { id, ...patch }; },
  };
  return { repository, targetStates };
}

test("approves source and every required translation as one compensated workflow", async () => {
  const f = fixture();
  const result = await approveContentPlanItem({ repository: f.repository, tenant: "tenant-a", itemId: "item-1" });
  assert.deepEqual(result.posts, ["post-en", "post-vi"]);
  assert.deepEqual([...f.targetStates.values()], ["approved", "approved"]);
  assert.equal(result.item.status, "approved");
});

test("rolls already-approved targets back when a later approval fails", async () => {
  const f = fixture({ failUpdate: true });
  await assert.rejects(() => approveContentPlanItem({ repository: f.repository, tenant: "tenant-a", itemId: "item-1" }), /rolled back/i);
  assert.deepEqual([...f.targetStates.values()], ["pending", "pending"]);
});

test("fails closed if a required translated post is missing", async () => {
  const f = fixture(); f.repository.findTranslatedPost = async () => null;
  await assert.rejects(() => approveContentPlanItem({ repository: f.repository, tenant: "tenant-a", itemId: "item-1" }), /missing translated posts/i);
});
