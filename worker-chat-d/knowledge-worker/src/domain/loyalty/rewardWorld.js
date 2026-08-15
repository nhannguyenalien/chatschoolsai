import { LoyaltyConflictError, LoyaltyValidationError } from "./errors.js";

export function assertCampaignOpen(campaign, at = new Date()) {
  if (!campaign || campaign.status !== "active") throw new LoyaltyConflictError("Campaign is not active.");
  const time = at.getTime();
  if (campaign.starts_at && new Date(campaign.starts_at).getTime() > time) throw new LoyaltyConflictError("Campaign has not started.");
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() < time) throw new LoyaltyConflictError("Campaign has ended.");
}

export function secureRandom() {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 0x100000000;
}

export function pickWeightedPrize(prizes, random = secureRandom) {
  const eligible = prizes.filter(prize => prize.status === "active" && Number(prize.weight) > 0);
  const total = eligible.reduce((sum, prize) => sum + Number(prize.weight), 0);
  if (!Number.isFinite(total) || total <= 0) throw new LoyaltyConflictError("Campaign has no available prize.");
  const value = Number(random());
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new LoyaltyValidationError("Random source must return a value from 0 up to 1.");
  let cursor = value * total;
  for (const prize of eligible) {
    cursor -= Number(prize.weight);
    if (cursor < 0) return prize;
  }
  return eligible[eligible.length - 1];
}
