import test from "node:test";
import assert from "node:assert/strict";
import { createLoyaltyApi } from "../src/api/loyalty.js";
import { LoyaltyCustomerLock } from "../src/index.js";

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

test("loyalty API routes redemption through an injected redeemPoints implementation", async () => {
  let received;
  const api = createLoyaltyApi({
    repository: {},
    redeemPoints: async (args) => { received = args; return { entry: { id: "e1" }, balance: 42, replayed: false }; },
  });
  const response = await api(new Request("https://example.test/api/v1/loyalty/redemptions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ customer_ref: "member-1", points: 5, source_ref: "gift-1", idempotency_key: "redeem:gift-1" }),
  }), { tenant: "shop-a" });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.balance, 42);
  assert.equal(received.tenant, "shop-a");
  assert.deepEqual(received.input, { customer_ref: "member-1", points: 5, source_ref: "gift-1", idempotency_key: "redeem:gift-1" });
});

// LoyaltyCustomerLock is the Durable Object that serializes redemptions per (tenant,
// customer_ref) so two concurrent requests can't both read the same balance before either
// writes its ledger entry. These tests exercise its fetch() handler directly (a DO instance's
// fetch calls are already run one-at-a-time by the Workers runtime, so no concurrency needed
// here — this just checks it wires the real workflow/repository correctly and reports errors
// in a form the caller in handleApiV1 can turn back into the right domain error).
test("LoyaltyCustomerLock durable object performs the redemption and returns the resulting balance", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const method = options.method || "GET";
    if (parsed.pathname.includes("auth-with-password")) return Response.json({ token: "pb-token" });
    if (parsed.pathname.endsWith("/loyalty_customers/records")) return Response.json({ items: [{ id: "cust-1", status: "active" }] });
    if (parsed.pathname.endsWith("/loyalty_programs/records")) return Response.json({ items: [{ version: 1, currency: "VND" }] });
    if (parsed.pathname.endsWith("/loyalty_ledger/records") && method === "POST") return Response.json({ id: "entry-1" });
    if (parsed.pathname.endsWith("/loyalty_ledger/records")) {
      const filter = parsed.searchParams.get("filter") || "";
      if (filter.includes("idempotency_key") || filter.includes("source_type")) return Response.json({ items: [], totalPages: 1 });
      return Response.json({ items: [{ points_delta: 100 }], totalPages: 1 });
    }
    throw new Error(`unexpected fetch ${parsed}`);
  };
  try {
    const lock = new LoyaltyCustomerLock({}, { PB_URL: "https://pb.test", PB_ADMIN_EMAIL: "admin", PB_ADMIN_PASS: "pass" });
    const response = await lock.fetch(new Request("https://loyalty-lock/redeem", {
      method: "POST",
      body: JSON.stringify({ tenant: "shop-a", input: { idempotency_key: "k1", customer_ref: "member-1", source_ref: "gift-1", points: 5 } }),
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result.balance, 95);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("LoyaltyCustomerLock durable object reports domain errors with a reconstructible errorName", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.includes("auth-with-password")) return Response.json({ token: "pb-token" });
    if (parsed.pathname.endsWith("/loyalty_customers/records")) return Response.json({ items: [{ id: "cust-1", status: "active" }] });
    if (parsed.pathname.endsWith("/loyalty_ledger/records")) return Response.json({ items: [], totalPages: 1 });
    throw new Error(`unexpected fetch ${parsed}`);
  };
  try {
    const lock = new LoyaltyCustomerLock({}, { PB_URL: "https://pb.test", PB_ADMIN_EMAIL: "admin", PB_ADMIN_PASS: "pass" });
    const response = await lock.fetch(new Request("https://loyalty-lock/redeem", {
      method: "POST",
      body: JSON.stringify({ tenant: "shop-a", input: { idempotency_key: "k1", customer_ref: "member-1", source_ref: "gift-1", points: 5 } }),
    }));
    assert.equal(response.status, 409);
    const data = await response.json();
    assert.equal(data.errorName, "LoyaltyConflictError");
    assert.match(data.error, /Insufficient points/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
