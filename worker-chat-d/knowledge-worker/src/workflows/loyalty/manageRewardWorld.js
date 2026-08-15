import { requireNonEmpty } from "../../domain/loyalty/points.js";
import { LoyaltyNotFoundError, LoyaltyValidationError } from "../../domain/loyalty/errors.js";

const CAMPAIGN_STATUSES = new Set(["draft", "active", "paused", "ended"]);
const PRIZE_STATUSES = new Set(["active", "paused", "exhausted"]);
const PRIZE_TYPES = new Set(["none", "points", "voucher", "product", "partner_code"]);
const integer = (value, field, min = 0) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) throw new LoyaltyValidationError(`${field} must be an integer >= ${min}.`);
  return parsed;
};
const optionalDate = (value, field) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new LoyaltyValidationError(`${field} must be a valid date.`);
  return parsed.toISOString();
};
const enumValue = (value, field, allowed) => {
  if (!allowed.has(value)) throw new LoyaltyValidationError(`${field} is invalid.`);
  return value;
};

export async function listManagedRewardWorld({ repository }) {
  const campaigns = await repository.listAllRewardCampaigns();
  return { campaigns: await Promise.all(campaigns.map(async campaign => ({ ...campaign, prizes: await repository.listAllCampaignPrizes(campaign.id) }))) };
}

export function createManagedCampaign({ repository, input }) {
  const startsAt = optionalDate(input.starts_at, "starts_at");
  const endsAt = optionalDate(input.ends_at, "ends_at");
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) throw new LoyaltyValidationError("ends_at must be after starts_at.");
  return repository.createRewardCampaign({
    name: requireNonEmpty(input.name, "name", 200), description: String(input.description || "").trim(),
    status: enumValue(input.status || "draft", "status", CAMPAIGN_STATUSES), starts_at: startsAt, ends_at: endsAt,
    spend_per_spin_minor: integer(input.spend_per_spin_minor, "spend_per_spin_minor", 1),
    max_spins_per_sale: integer(input.max_spins_per_sale ?? 1, "max_spins_per_sale", 1),
    theme_json: JSON.stringify(input.theme || {}),
  });
}

export async function updateManagedCampaign({ repository, campaignId, input }) {
  if (!await repository.getRewardCampaign(campaignId)) throw new LoyaltyNotFoundError("Campaign was not found.");
  const patch = {};
  if (input.name !== undefined) patch.name = requireNonEmpty(input.name, "name", 200);
  if (input.description !== undefined) patch.description = String(input.description).trim();
  if (input.status !== undefined) patch.status = enumValue(input.status, "status", CAMPAIGN_STATUSES);
  if (input.starts_at !== undefined) patch.starts_at = optionalDate(input.starts_at, "starts_at");
  if (input.ends_at !== undefined) patch.ends_at = optionalDate(input.ends_at, "ends_at");
  if (input.spend_per_spin_minor !== undefined) patch.spend_per_spin_minor = integer(input.spend_per_spin_minor, "spend_per_spin_minor", 1);
  if (input.max_spins_per_sale !== undefined) patch.max_spins_per_sale = integer(input.max_spins_per_sale, "max_spins_per_sale", 1);
  if (input.theme !== undefined) patch.theme_json = JSON.stringify(input.theme || {});
  return repository.updateRewardCampaign(campaignId, patch);
}

export async function createManagedPrize({ repository, campaignId, input }) {
  if (!await repository.getRewardCampaign(campaignId)) throw new LoyaltyNotFoundError("Campaign was not found.");
  return repository.createCampaignPrize({
    campaign_id: campaignId, name: requireNonEmpty(input.name, "name", 200),
    prize_type: enumValue(input.prize_type, "prize_type", PRIZE_TYPES), weight: Number(input.weight) > 0 ? Number(input.weight) : (() => { throw new LoyaltyValidationError("weight must be greater than 0."); })(),
    max_wins: integer(input.max_wins ?? 0, "max_wins", 0), sort_order: integer(input.sort_order ?? 0, "sort_order", 0),
    status: enumValue(input.status || "active", "status", PRIZE_STATUSES), value_json: JSON.stringify(input.value || {}),
  });
}

export async function updateManagedPrize({ repository, prizeId, input }) {
  const prize = await repository.getCampaignPrize(prizeId);
  if (!prize) throw new LoyaltyNotFoundError("Prize was not found.");
  const patch = {};
  if (input.name !== undefined) patch.name = requireNonEmpty(input.name, "name", 200);
  if (input.prize_type !== undefined) patch.prize_type = enumValue(input.prize_type, "prize_type", PRIZE_TYPES);
  if (input.weight !== undefined) { if (!(Number(input.weight) > 0)) throw new LoyaltyValidationError("weight must be greater than 0."); patch.weight = Number(input.weight); }
  if (input.max_wins !== undefined) patch.max_wins = integer(input.max_wins, "max_wins", 0);
  if (input.sort_order !== undefined) patch.sort_order = integer(input.sort_order, "sort_order", 0);
  if (input.status !== undefined) patch.status = enumValue(input.status, "status", PRIZE_STATUSES);
  if (input.value !== undefined) patch.value_json = JSON.stringify(input.value || {});
  return repository.updateCampaignPrize(prizeId, patch);
}
