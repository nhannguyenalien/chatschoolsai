import { requireNonEmpty, sumLedger } from "../../domain/loyalty/points.js";
import { LoyaltyNotFoundError } from "../../domain/loyalty/errors.js";

export async function getLoyaltyAccount({ repository, tenant, customerRef, page = 1, perPage = 100 }) {
  const ref = requireNonEmpty(customerRef, "customer_ref", 200);
  const customer = await repository.findCustomerByRef(tenant, ref);
  if (!customer) throw new LoyaltyNotFoundError("Customer was not found.");
  const [result, allEntries] = await Promise.all([
    repository.listCustomerLedger(tenant, customer.id, { page, perPage }),
    repository.listAllCustomerLedger(tenant, customer.id),
  ]);
  const entries = result.items || [];
  return {
    customer: { id: customer.id, customer_ref: customer.customer_ref, name: customer.name, status: customer.status },
    balance: sumLedger(allEntries), entries,
    pagination: { page: result.page || page, per_page: result.perPage || perPage, total_items: result.totalItems ?? entries.length },
  };
}
