import test from "node:test";
import assert from "node:assert/strict";
import { createLoyaltyApi } from "../src/api/loyalty.js";

test("loyalty API rejects invalid sale input without writing", async () => {
  const api = createLoyaltyApi({ repository: {
    async findLedgerByIdempotencyKey() { return null; },
  } });
  const response = await api(new Request("https://example.test/api/v1/loyalty/sales", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotency_key: "x" }),
  }), { tenant: "shop-a" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /customer_ref/);
});

test("loyalty API requires tenant context", async () => {
  const response = await createLoyaltyApi({ repository: {} })(
    new Request("https://example.test/api/v1/loyalty/account?customer_ref=a"), {},
  );
  assert.equal(response.status, 401);
});

test("loyalty API returns only the authenticated tenant's active program", async () => {
  let seenTenant;
  const program = { id: "program-a", version: 3, spend_per_point_minor: 20000, points_per_step: 2 };
  const api = createLoyaltyApi({ repository: {
    async getActiveProgram(tenant) { seenTenant = tenant; return program; },
  } });
  const response = await api(new Request("https://example.test/api/v1/loyalty/program"), { tenant: "shop-a" });
  assert.equal(response.status, 200);
  assert.equal(seenTenant, "shop-a");
  assert.deepEqual(await response.json(), { program });
});

test("reward world API derives the store from authenticated tenant context", async () => {
  let seenTenant;
  const api = createLoyaltyApi({ repository: {
    async listRewardCampaigns() { return []; },
    async listStoreCampaignJoins(tenant) { seenTenant = tenant; return []; },
  } });
  const response = await api(new Request("https://example.test/api/v1/loyalty/reward-world/campaigns"), { tenant: "store-from-auth" });
  assert.equal(response.status, 200);
  assert.equal(seenTenant, "store-from-auth");
});

test("loyalty API exposes point redemption", async () => {
  const repository = {
    async findLedgerByIdempotencyKey() { return null; }, async findLedgerBySource() { return null; },
    async findCustomerByRef() { return { id: "customer-1", status: "active" }; },
    async listAllCustomerLedger() { return [{ points_delta: 20 }]; },
    async getActiveProgram() { return { version: 1, currency: "VND" }; },
    async appendLedger(entry) { return { entry: { id: "entry-1", ...entry }, replayed: false }; },
  };
  const response = await createLoyaltyApi({ repository })(new Request("https://example.test/api/v1/loyalty/redemptions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ customer_ref: "member-1", points: 5, source_ref: "gift-1", idempotency_key: "redeem:gift-1" }),
  }), { tenant: "shop-a" });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).balance, 15);
});
