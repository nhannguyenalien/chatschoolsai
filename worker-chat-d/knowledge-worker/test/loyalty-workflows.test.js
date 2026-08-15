import test from "node:test";
import assert from "node:assert/strict";
import { recordLoyaltySale } from "../src/workflows/loyalty/recordSale.js";
import { getLoyaltyAccount } from "../src/workflows/loyalty/getAccount.js";
import { redeemLoyaltyPoints } from "../src/workflows/loyalty/redeemPoints.js";

test("sale points are server-calculated and carry the rule version", async () => {
  let appended;
  const repository = {
    async findLedgerByIdempotencyKey() { return null; },
    async findLedgerBySource() { return null; },
    async getActiveProgram() { return { version: 3, currency: "VND", spend_per_point_minor: 10_000, points_per_step: 1 }; },
    async findOrCreateCustomer() { return { id: "customer-1" }; },
    async appendLedger(entry) { appended = entry; return { entry: { id: "ledger-1", ...entry }, replayed: false }; },
  };
  const result = await recordLoyaltySale({
    repository, tenant: "shop-a", now: () => new Date("2026-08-11T00:00:00.000Z"),
    input: { customer_ref: "0909000000", amount_minor: 105_000, source_ref: "receipt-01", idempotency_key: "device-1:receipt-01", points: 999_999 },
  });
  assert.equal(result.entry.points_delta, 10);
  assert.equal(appended.rule_version, 3);
  assert.equal(appended.tenant, "shop-a");
  assert.equal(appended.occurred_at, "2026-08-11T00:00:00.000Z");
});

test("same idempotency key and request returns the original entry without another write", async () => {
  const original = {
    id: "ledger-1", idempotency_key: "same-key", points_delta: 10,
    customer_ref: "member-1", source_type: "manual", source_ref: "receipt-1", amount_minor: 100_000,
  };
  const repository = {
    async findLedgerByIdempotencyKey() { return original; },
    async appendLedger() { throw new Error("must not append"); },
  };
  assert.deepEqual(await recordLoyaltySale({
    repository,
    tenant: "shop-a",
    input: { idempotency_key: "same-key", customer_ref: "member-1", source_ref: "receipt-1", amount_minor: 100_000 },
  }), {
    entry: original, replayed: true,
  });
});

test("rejects a receipt already credited under another idempotency key", async () => {
  const repository = {
    async findLedgerByIdempotencyKey() { return null; },
    async findLedgerBySource() { return { id: "ledger-existing" }; },
  };
  await assert.rejects(
    recordLoyaltySale({
      repository,
      tenant: "shop-a",
      input: { idempotency_key: "new-key", customer_ref: "member-1", source_ref: "receipt-1", amount_minor: 100_000 },
    }),
    /already credited/,
  );
});

test("account balance uses the complete ledger, independent of history pagination", async () => {
  const repository = {
    async findCustomerByRef() { return { id: "customer-1", customer_ref: "member-1", name: "A", status: "active" }; },
    async listCustomerLedger() { return { page: 2, perPage: 1, totalItems: 3, items: [{ id: "third", points_delta: 5 }] }; },
    async listAllCustomerLedger() { return [{ points_delta: 10 }, { points_delta: 20 }, { points_delta: 5 }]; },
  };
  const account = await getLoyaltyAccount({ repository, tenant: "shop-a", customerRef: "member-1", page: 2, perPage: 1 });
  assert.equal(account.balance, 35);
  assert.equal(account.entries.length, 1);
});

test("redemption appends a negative ledger entry and returns the new balance", async () => {
  let appended;
  const repository = {
    async findLedgerByIdempotencyKey() { return null; },
    async findLedgerBySource() { return null; },
    async findCustomerByRef() { return { id: "customer-1", status: "active" }; },
    async listAllCustomerLedger() { return [{ points_delta: 80 }, { points_delta: -10 }]; },
    async getActiveProgram() { return { version: 2, currency: "VND" }; },
    async appendLedger(entry) { appended = entry; return { entry: { id: "redeem-1", ...entry }, replayed: false }; },
  };
  const result = await redeemLoyaltyPoints({
    repository, tenant: "shop-a", now: () => new Date("2026-08-13T00:00:00.000Z"),
    input: { customer_ref: "member-1", points: 25, source_ref: "gift-1", idempotency_key: "redeem:gift-1" },
  });
  assert.equal(appended.points_delta, -25);
  assert.equal(appended.transaction_type, "redeem");
  assert.equal(result.balance, 45);
});

test("redemption rejects an amount greater than the complete balance", async () => {
  const repository = {
    async findLedgerByIdempotencyKey() { return null; }, async findLedgerBySource() { return null; },
    async findCustomerByRef() { return { id: "customer-1", status: "active" }; },
    async listAllCustomerLedger() { return [{ points_delta: 12 }]; },
  };
  await assert.rejects(redeemLoyaltyPoints({
    repository, tenant: "shop-a",
    input: { customer_ref: "member-1", points: 13, source_ref: "gift-1", idempotency_key: "redeem:gift-1" },
  }), /Insufficient points/);
});
