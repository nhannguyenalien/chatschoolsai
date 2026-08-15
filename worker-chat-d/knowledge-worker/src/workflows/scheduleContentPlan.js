import { buildCadenceSlots } from "../domain/content-plans/cadence.js";
import { ContentPlanningAuthorizationError, ContentPlanningConflictError, ContentPlanningValidationError } from "../domain/contentPlanningErrors.js";

export class ScheduleClaimCompensationError extends Error {
  constructor(cause, claimId, cleanupError) {
    super(`Scheduling failed and claim '${claimId}' could not be released.`);
    this.name = "ScheduleClaimCompensationError";
    this.cause = cause;
    this.claimId = claimId;
    this.cleanupError = cleanupError;
  }
}

export async function scheduleContentPlan({ repository, tenant, planId, now = new Date(), horizonDays = 90 }) {
  if (!tenant || !planId) throw new ContentPlanningValidationError("Scheduling requires tenant and planId.");
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 366) {
    throw new ContentPlanningValidationError("horizonDays must be an integer between 1 and 366.");
  }
  const plan = await repository.getPlan(planId);
  if (plan.tenant !== tenant) throw new ContentPlanningAuthorizationError("Content plan does not belong to this tenant.");
  if (plan.status !== "active") throw new ContentPlanningConflictError(`Cannot schedule plan from status '${plan.status}'.`);

  const nowDate = new Date(now);
  if (!Number.isFinite(nowDate.valueOf())) throw new ContentPlanningValidationError("now must be a valid date.");
  const startsAt = plan.starts_at ? Date.parse(plan.starts_at) : nowDate.valueOf();
  const endsAt = plan.ends_at ? Date.parse(plan.ends_at) : null;
  if (!Number.isFinite(startsAt)) throw new ContentPlanningValidationError("Plan starts_at must be a valid date.");
  if (endsAt !== null && !Number.isFinite(endsAt)) throw new ContentPlanningValidationError("Plan ends_at must be a valid date.");
  const from = new Date(Math.max(nowDate.valueOf(), startsAt));
  const requestedUntil = new Date(from.valueOf() + horizonDays * 86400000);
  const until = endsAt !== null && endsAt < requestedUntil.valueOf() ? new Date(endsAt) : requestedUntil;
  const [queue, occupied] = await Promise.all([
    repository.listUnscheduledPlanItems(planId), repository.listScheduledPlanItems(planId),
  ]);
  const occupiedSlots = new Set((occupied.items || []).map((item) => item.scheduled_at).filter(Boolean));
  const slots = buildCadenceSlots({ cadence: plan.cadence_json, timeZone: plan.timezone, from, until, limit: 500 })
    .filter((slot) => !occupiedSlots.has(slot));
  const assignments = [];
  let contentionCount = 0;
  let slotIndex = 0;
  for (const item of (queue.items || [])) {
    const slot = slots[slotIndex];
    if (!slot) break;
    slotIndex += 1;
    const claim = await repository.tryClaimSchedule({
      tenant, siteId: plan.site_id, planId, itemId: item.id, slot,
      reservationId: crypto.randomUUID(), claimedAt: nowDate.toISOString(),
    });
    if (!claim) { contentionCount += 1; continue; }
    try {
      const updated = await repository.updatePlanItem(item.id, { scheduled_at: slot });
      assignments.push({ item: updated, claim });
    } catch (cause) {
      try { await repository.releaseScheduleClaim(claim.id); }
      catch (cleanupError) { throw new ScheduleClaimCompensationError(cause, claim.id, cleanupError); }
      throw cause;
    }
  }
  return { planId, assignments, contentionCount, remaining: Math.max(0, (queue.items || []).length - assignments.length) };
}
