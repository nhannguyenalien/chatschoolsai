import { requireNonEmpty } from "../../domain/loyalty/points.js";
import { LoyaltyConflictError, LoyaltyNotFoundError } from "../../domain/loyalty/errors.js";

export async function syncRewardCatalog({ repository, provider, providerName, options = {}, now = () => new Date() }) {
  const items = await provider.listCatalog(options);
  let created = 0; let updated = 0;
  for (const item of items) {
    const result = await repository.upsertCatalogItem({ ...item, provider: providerName, synced_at: now().toISOString() });
    result.created ? created += 1 : updated += 1;
  }
  return { provider: providerName, fetched: items.length, created, updated };
}

export async function listRewardCatalog({ repository, provider, status = "active" }) {
  return { items: await repository.listCatalogItems({ provider, status }) };
}

export async function fulfillClaim({ repository, providers, tenant, claim, result, input = {}, now = () => new Date() }) {
  const prizeValue = JSON.parse(result.prize_value_json || "{}");
  if (!prizeValue.catalog_item_id) return { claim, fulfillment: null, replayed: false };
  const item = await repository.getCatalogItem(requireNonEmpty(prizeValue.catalog_item_id, "catalog_item_id", 200));
  if (!item || item.status !== "active") throw new LoyaltyNotFoundError("Reward catalog item is unavailable.");
  const existing = await repository.findFulfillmentByClaim(claim.id);
  if (existing) return { claim, fulfillment: existing, replayed: true };
  const provider = providers[item.provider];
  if (!provider) throw new LoyaltyConflictError(`Reward provider ${item.provider} is not configured.`);
  const pending = await repository.createRewardFulfillment({
    tenant, campaign_id: result.campaign_id, result_id: result.id, claim_id: claim.id, catalog_item_id: item.id,
    source_type: item.source_type, provider: item.provider, status: "processing", provider_ref: "", delivery_json: "{}", error_message: "", attempts: 1, requested_at: now().toISOString(), fulfilled_at: "",
  });
  try {
    const output = await provider.fulfill({ catalogItem: item, fulfillmentId: pending.id, recipient: { email: input.recipient_email, sender_name: input.sender_name } });
    const fulfillment = await repository.updateRewardFulfillment(pending.id, { provider_ref: output.provider_ref || "", status: output.status, delivery_json: JSON.stringify(output.delivery || {}), fulfilled_at: output.status === "fulfilled" ? now().toISOString() : "" });
    return { claim, fulfillment, replayed: false };
  } catch (error) {
    await repository.updateRewardFulfillment(pending.id, { status: "manual_review", error_message: String(error.message || error).slice(0, 500) });
    throw error;
  }
}
