import test from "node:test";
import assert from "node:assert/strict";
import { createRewardWorldAdminApi } from "../src/api/rewardWorldAdmin.js";

test("system admin creates one global campaign", async () => {
  let created;
  const api = createRewardWorldAdminApi({ repository: { async createRewardCampaign(record) { created = record; return { id: "world-1", ...record }; } } });
  const response = await api(new Request("https://example.test/api/v1/admin/reward-world/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Tet", status: "draft", spend_per_spin_minor: 100000, max_spins_per_sale: 2 }) }));
  assert.equal(response.status, 201);
  assert.equal(created.spend_per_spin_minor, 100000);
  assert.equal(created.status, "draft");
});

test("system admin rejects invalid campaign budget rules", async () => {
  const api = createRewardWorldAdminApi({ repository: {} });
  const response = await api(new Request("https://example.test/api/v1/admin/reward-world/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Tet", spend_per_spin_minor: 0 }) }));
  assert.equal(response.status, 400);
});
