import { calculateSalePoints, requireNonEmpty, requirePositiveInteger } from "../../domain/loyalty/points.js";
import { LoyaltyConflictError, LoyaltyNotFoundError } from "../../domain/loyalty/errors.js";

export async function recordLoyaltySale({ repository, tenant, input, now = () => new Date() }) {
  const idempotencyKey = requireNonEmpty(input.idempotency_key, "idempotency_key", 200);
  const customerRef = requireNonEmpty(input.customer_ref, "customer_ref", 200);
  const sourceRef = requireNonEmpty(input.source_ref, "source_ref", 200);
  const amountMinor = requirePositiveInteger(input.amount_minor, "amount_minor");
  const sourceType = requireNonEmpty(input.source_type || "manual", "source_type", 30);
  const existing = await repository.findLedgerByIdempotencyKey(tenant, idempotencyKey);
  if (existing) {
    const sameRequest = existing.customer_ref === customerRef
      && existing.source_type === sourceType
      && existing.source_ref === sourceRef
      && Number(existing.amount_minor) === amountMinor;
    if (!sameRequest) throw new LoyaltyConflictError("idempotency_key was already used for another sale.");
    const result = { entry: existing, replayed: true };
    if (repository.issueRewardEntitlementsForSale) {
      result.entitlements = await repository.issueRewardEntitlementsForSale({
        tenant, customerRef, sourceRef, amountMinor, occurredAt: existing.occurred_at || existing.created,
      });
    }
    return result;
  }
  if (await repository.findLedgerBySource(tenant, sourceType, sourceRef)) {
    throw new LoyaltyConflictError("This receipt/source was already credited.");
  }
  const program = await repository.getActiveProgram(tenant);
  if (!program) throw new LoyaltyNotFoundError("No active loyalty program is configured for this tenant.");
  const points = calculateSalePoints(amountMinor, program);
  if (points <= 0) throw new LoyaltyConflictError("Sale amount is below the minimum spend required to earn points.");
  const customer = await repository.findOrCreateCustomer(tenant, customerRef, input.customer || {});
  try {
    const result = await repository.appendLedger({
      tenant, customer_id: customer.id, customer_ref: customerRef, transaction_type: "earn",
      points_delta: points, amount_minor: amountMinor, currency: program.currency,
      source_type: sourceType, source_ref: sourceRef,
      rule_version: Number(program.version), idempotency_key: idempotencyKey,
      occurred_at: now().toISOString(), metadata_json: JSON.stringify(input.metadata || {}),
    });
    if (repository.issueRewardEntitlementsForSale) {
      result.entitlements = await repository.issueRewardEntitlementsForSale({
        tenant, customerRef, sourceRef, amountMinor, occurredAt: result.entry.occurred_at,
      });
    }
    return result;
  } catch (cause) {
    if (await repository.findLedgerBySource(tenant, sourceType, sourceRef)) {
      throw new LoyaltyConflictError("This receipt/source was already credited.");
    }
    throw cause;
  }
}
