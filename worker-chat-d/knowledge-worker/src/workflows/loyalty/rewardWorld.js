import { requireNonEmpty } from "../../domain/loyalty/points.js";
import { assertCampaignOpen, pickWeightedPrize, secureRandom } from "../../domain/loyalty/rewardWorld.js";
import { LoyaltyConflictError, LoyaltyNotFoundError, LoyaltyValidationError } from "../../domain/loyalty/errors.js";

export async function listRewardWorld({ repository, tenant, now = () => new Date() }) {
  const campaigns = await repository.listRewardCampaigns();
  const joins = await repository.listStoreCampaignJoins(tenant);
  const joined = new Set(joins.map(item => item.campaign_id));
  const visible = [];
  for (const campaign of campaigns) {
    try { assertCampaignOpen(campaign, now()); }
    catch { continue; }
    visible.push({ ...campaign, joined: joined.has(campaign.id), prizes: await repository.listCampaignPrizes(campaign.id) });
  }
  return { campaigns: visible };
}

export async function joinRewardCampaign({ repository, tenant, campaignId, now = () => new Date() }) {
  const id = requireNonEmpty(campaignId, "campaign_id", 200);
  const campaign = await repository.getRewardCampaign(id);
  if (!campaign) throw new LoyaltyNotFoundError("Campaign was not found.");
  assertCampaignOpen(campaign, now());
  return repository.joinRewardCampaign(tenant, id, now().toISOString());
}

export async function spinRewardWorld({ repository, tenant, input, now = () => new Date(), random = secureRandom }) {
  const campaignId = requireNonEmpty(input.campaign_id, "campaign_id", 200);
  const customerRef = requireNonEmpty(input.customer_ref, "customer_ref", 200);
  const idempotencyKey = requireNonEmpty(input.idempotency_key, "idempotency_key", 200);
  const replay = await repository.findSpinResultByIdempotency(tenant, idempotencyKey);
  if (replay) return { result: replay, replayed: true };
  const campaign = await repository.getRewardCampaign(campaignId);
  if (!campaign) throw new LoyaltyNotFoundError("Campaign was not found.");
  assertCampaignOpen(campaign, now());
  if (!await repository.findStoreCampaignJoin(tenant, campaignId)) throw new LoyaltyConflictError("Store has not joined this campaign.");
  const entitlement = await repository.findAvailableSpinEntitlement(tenant, campaignId, customerRef);
  if (!entitlement) throw new LoyaltyConflictError("Customer has no available spin.");
  const prizes = await repository.listAvailableCampaignPrizes(campaignId);
  const prize = pickWeightedPrize(prizes, random);
  const prizeSlotKey = Number(prize.max_wins) > 0
    ? `prize:${prize.id}:${prize.next_win_number}`
    : `entitlement:${entitlement.id}`;
  return repository.createSpinResult({
    tenant, campaign_id: campaignId, customer_ref: customerRef, entitlement_id: entitlement.id,
    prize_id: prize.id, prize_name: prize.name, prize_type: prize.prize_type,
    prize_value_json: prize.value_json || "{}", prize_slot_key: prizeSlotKey, idempotency_key: idempotencyKey,
    status: prize.prize_type === "none" ? "no_win" : "won", spun_at: now().toISOString(),
  });
}

export async function listCustomerRewards({ repository, tenant, customerRef }) {
  return { rewards: await repository.listCustomerWins(tenant, requireNonEmpty(customerRef, "customer_ref", 200)) };
}

export async function claimReward({ repository, tenant, resultId, input = {}, fulfillmentService, now = () => new Date() }) {
  const id = requireNonEmpty(resultId, "result_id", 200);
  const result = await repository.getSpinResultForTenant(tenant, id);
  if (!result) throw new LoyaltyNotFoundError("Winning result was not found.");
  if (result.status === "no_win") throw new LoyaltyConflictError("This spin has no prize to claim.");
  if (!["won", "claimed"].includes(result.status)) throw new LoyaltyConflictError("This prize cannot be claimed.");
  const note = String(input.claim_note || "").trim();
  if (note.length > 500) throw new LoyaltyValidationError("claim_note must not exceed 500 characters.");
  const existing = await repository.findClaimByResult(id);
  if (existing) {
    if (fulfillmentService) return fulfillmentService({ repository, tenant, claim: existing, result, input, now });
    return { claim: existing, replayed: true };
  }
  const created = await repository.createRewardClaim({
    tenant, campaign_id: result.campaign_id, result_id: id, customer_ref: result.customer_ref,
    prize_id: result.prize_id, prize_name: result.prize_name, prize_type: result.prize_type,
    prize_value_json: result.prize_value_json || "{}", claim_note: note, claimed_at: now().toISOString(),
  });
  await repository.markSpinClaimed(id);
  if (fulfillmentService) return fulfillmentService({ repository, tenant, claim: created.claim, result, input, now });
  return created;
}
