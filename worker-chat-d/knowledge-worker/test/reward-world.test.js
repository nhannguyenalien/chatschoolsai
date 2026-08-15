import test from "node:test";
import assert from "node:assert/strict";
import { pickWeightedPrize } from "../src/domain/loyalty/rewardWorld.js";
import { claimReward, joinRewardCampaign, listRewardWorld, spinRewardWorld } from "../src/workflows/loyalty/rewardWorld.js";

test("weighted draw is decided server-side from active prizes", () => {
  const prizes = [
    { id: "none", status: "active", weight: 80 },
    { id: "gift", status: "active", weight: 20 },
    { id: "paused", status: "paused", weight: 999 },
  ];
  assert.equal(pickWeightedPrize(prizes, () => 0.79).id, "none");
  assert.equal(pickWeightedPrize(prizes, () => 0.80).id, "gift");
});

test("reward world marks campaigns joined without tenant-owned campaign config", async () => {
  const repository = {
    async listRewardCampaigns() { return [{ id: "world-1", name: "World", status: "active" }]; },
    async listStoreCampaignJoins() { return [{ campaign_id: "world-1" }]; },
    async listCampaignPrizes() { return [{ id: "gift", name: "Gift" }]; },
  };
  const result = await listRewardWorld({ repository, tenant: "store-a" });
  assert.equal(result.campaigns[0].joined, true);
});

test("store can join an open global campaign idempotently", async () => {
  const repository = {
    async getRewardCampaign() { return { id: "world-1", status: "active" }; },
    async joinRewardCampaign(tenant, campaign) { return { tenant, campaign, replayed: true }; },
  };
  assert.equal((await joinRewardCampaign({ repository, tenant: "store-a", campaignId: "world-1" })).replayed, true);
});

test("spin consumes a server entitlement and persists the selected prize", async () => {
  let created;
  const repository = {
    async findSpinResultByIdempotency() { return null; },
    async getRewardCampaign() { return { id: "world-1", status: "active" }; },
    async findStoreCampaignJoin() { return { id: "join-1" }; },
    async findAvailableSpinEntitlement() { return { id: "spin-1" }; },
    async listAvailableCampaignPrizes() { return [{ id: "gift", name: "Voucher 20K", prize_type: "voucher", status: "active", weight: 1, value_json: "{}" }]; },
    async createSpinResult(record) { created = record; return { result: record, replayed: false }; },
  };
  const output = await spinRewardWorld({ repository, tenant: "store-a", random: () => 0, input: { campaign_id: "world-1", customer_ref: "0909", idempotency_key: "attempt-1" } });
  assert.equal(output.result.prize_name, "Voucher 20K");
  assert.equal(created.entitlement_id, "spin-1");
  assert.equal(created.tenant, "store-a");
  assert.equal(created.prize_slot_key, "entitlement:spin-1");
});

test("limited prizes receive a deterministic unique inventory slot", async () => {
  let created;
  const repository = {
    async findSpinResultByIdempotency() { return null; },
    async getRewardCampaign() { return { id: "world-1", status: "active" }; },
    async findStoreCampaignJoin() { return { id: "join-1" }; },
    async findAvailableSpinEntitlement() { return { id: "spin-2" }; },
    async listAvailableCampaignPrizes() { return [{ id: "limited", name: "TV", prize_type: "product", status: "active", weight: 1, max_wins: 10, next_win_number: 4 }]; },
    async createSpinResult(record) { created = record; return { result: record, replayed: false }; },
  };
  await spinRewardWorld({ repository, tenant: "store-a", random: () => 0, input: { campaign_id: "world-1", customer_ref: "0909", idempotency_key: "attempt-2" } });
  assert.equal(created.prize_slot_key, "prize:limited:4");
});

test("spin is rejected when store has not joined", async () => {
  const repository = {
    async findSpinResultByIdempotency() { return null; },
    async getRewardCampaign() { return { id: "world-1", status: "active" }; },
    async findStoreCampaignJoin() { return null; },
  };
  await assert.rejects(spinRewardWorld({ repository, tenant: "store-a", input: { campaign_id: "world-1", customer_ref: "0909", idempotency_key: "attempt-1" } }), /not joined/);
});

test("claim creates one append-only receipt and marks the spin", async () => {
  let claimRecord; let marked;
  const repository = {
    async getSpinResultForTenant() { return { id: "result-1", status: "won", campaign_id: "world-1", customer_ref: "0909", prize_id: "gift", prize_name: "Gift", prize_type: "product", prize_value_json: "{}" }; },
    async findClaimByResult() { return null; },
    async createRewardClaim(record) { claimRecord = record; return { claim: { id: "claim-1", ...record }, replayed: false }; },
    async markSpinClaimed(id) { marked = id; },
  };
  const result = await claimReward({ repository, tenant: "store-a", resultId: "result-1", input: { claim_note: "Giao tại quầy" } });
  assert.equal(result.claim.result_id, "result-1");
  assert.equal(claimRecord.tenant, "store-a");
  assert.equal(marked, "result-1");
});

test("claim replay returns existing receipt without writing again", async () => {
  let writes = 0;
  const repository = {
    async getSpinResultForTenant() { return { id: "result-1", status: "claimed" }; },
    async findClaimByResult() { return { id: "claim-1", result_id: "result-1" }; },
    async createRewardClaim() { writes += 1; }, async markSpinClaimed() {},
  };
  const result = await claimReward({ repository, tenant: "store-a", resultId: "result-1" });
  assert.equal(result.replayed, true);
  assert.equal(writes, 0);
});
