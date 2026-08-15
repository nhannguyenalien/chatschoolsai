import { requireNonEmpty, requirePositiveInteger, sumLedger } from "../../domain/loyalty/points.js";
import { LoyaltyConflictError, LoyaltyNotFoundError } from "../../domain/loyalty/errors.js";

export async function redeemLoyaltyPoints({ repository, tenant, input, now = () => new Date() }) {
  const idempotencyKey = requireNonEmpty(input.idempotency_key, "idempotency_key", 200);
  const customerRef = requireNonEmpty(input.customer_ref, "customer_ref", 200);
  const sourceRef = requireNonEmpty(input.source_ref, "source_ref", 200);
  const points = requirePositiveInteger(input.points, "points");
  const sourceType = requireNonEmpty(input.source_type || "redemption", "source_type", 30);

  const existing = await repository.findLedgerByIdempotencyKey(tenant, idempotencyKey);
  if (existing) {
    const sameRequest = existing.transaction_type === "redeem"
      && existing.customer_ref === customerRef
      && existing.source_type === sourceType
      && existing.source_ref === sourceRef
      && Number(existing.points_delta) === -points;
    if (!sameRequest) throw new LoyaltyConflictError("idempotency_key was already used for another transaction.");
    return { entry: existing, replayed: true, balance: null };
  }
  if (await repository.findLedgerBySource(tenant, sourceType, sourceRef)) {
    throw new LoyaltyConflictError("This redemption reference was already used.");
  }
  const customer = await repository.findCustomerByRef(tenant, customerRef);
  if (!customer) throw new LoyaltyNotFoundError("Customer was not found.");
  if (customer.status !== "active") throw new LoyaltyConflictError("Customer account is not active.");
  const balance = sumLedger(await repository.listAllCustomerLedger(tenant, customer.id));
  if (balance < points) throw new LoyaltyConflictError(`Insufficient points. Current balance is ${balance}.`);
  const program = await repository.getActiveProgram(tenant);

  try {
    const result = await repository.appendLedger({
      tenant, customer_id: customer.id, customer_ref: customerRef, transaction_type: "redeem",
      points_delta: -points, amount_minor: 0, currency: program?.currency || "VND",
      source_type: sourceType, source_ref: sourceRef, rule_version: Number(program?.version || 0),
      idempotency_key: idempotencyKey, occurred_at: now().toISOString(),
      metadata_json: JSON.stringify({ note: input.note || "", ...(input.metadata || {}) }),
    });
    return { ...result, balance: balance - points };
  } catch (cause) {
    if (await repository.findLedgerBySource(tenant, sourceType, sourceRef)) {
      throw new LoyaltyConflictError("This redemption reference was already used.");
    }
    throw cause;
  }
}
