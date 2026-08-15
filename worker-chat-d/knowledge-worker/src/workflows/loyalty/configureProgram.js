import { requireNonEmpty, requirePositiveInteger } from "../../domain/loyalty/points.js";

export async function configureLoyaltyProgram({ repository, tenant, input }) {
  const currency = requireNonEmpty(input.currency || "VND", "currency", 3).toUpperCase();
  const spendPerPointMinor = requirePositiveInteger(input.spend_per_point_minor, "spend_per_point_minor");
  const pointsPerStep = requirePositiveInteger(input.points_per_step || 1, "points_per_step");
  const version = await repository.nextProgramVersion(tenant);
  const program = await repository.createProgram({
    tenant, version, currency, spend_per_point_minor: spendPerPointMinor,
    points_per_step: pointsPerStep, status: "draft",
  });
  // PocketBase REST cannot wrap these records in one transaction. Activate the
  // higher version first: readers sort by version, so cleanup failure can leave
  // two active rows temporarily but never leaves the tenant without a rule.
  const active = await repository.updateProgram(program.id, { status: "active" });
  await repository.archiveActivePrograms(tenant, active.id);
  return active;
}
