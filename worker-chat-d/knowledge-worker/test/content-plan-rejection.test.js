import test from "node:test";
import assert from "node:assert/strict";
import { rejectContentPlanItem } from "../src/workflows/rejectContentPlanItem.js";

function fixture(targetStatus = "pending") {
  const deleted = []; const patches = [];
  const repository = {
    async getPlanItem() { return { id: "item-1", tenant: "tenant-a", site_id: "site-1", post_id: "post-en", status: "review" }; },
    async getPost() { return { id: "post-en", tenant: "tenant-a" }; },
    async listTranslatedPosts() { return [{ id: "post-vi", tenant: "tenant-a", translation_of: "post-en" }]; },
    async listPostTargets(_tenant, postId) { return [{ id: `target-${postId}`, status: targetStatus }]; },
    async updatePlanItem(id, patch) { patches.push(patch); return { id, ...patch }; },
    async deletePost(id) { deleted.push(id); },
  };
  return { repository, deleted, patches };
}

test("rejects a draft by cancelling the item and deleting translations before source", async () => {
  const fx = fixture();
  const result = await rejectContentPlanItem({ repository: fx.repository, tenant: "tenant-a", itemId: "item-1" });
  assert.deepEqual(fx.deleted, ["post-vi", "post-en"]);
  assert.equal(fx.patches[0].status, "cancelled");
  assert.equal(fx.patches.at(-1).post_id, "");
  assert.deepEqual(result.deletedPosts, ["post-vi", "post-en"]);
});

test("fails closed without deleting when a target was already published", async () => {
  const fx = fixture("published");
  await assert.rejects(() => rejectContentPlanItem({ repository: fx.repository, tenant: "tenant-a", itemId: "item-1" }), /already published/i);
  assert.deepEqual(fx.deleted, []);
  assert.deepEqual(fx.patches, []);
});

test("does not allow another tenant to reject a draft", async () => {
  const fx = fixture();
  await assert.rejects(() => rejectContentPlanItem({ repository: fx.repository, tenant: "attacker", itemId: "item-1" }), /another tenant/i);
  assert.deepEqual(fx.deleted, []);
});
