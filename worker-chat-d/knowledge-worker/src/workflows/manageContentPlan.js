import { parseCadence } from "../domain/content-plans/cadence.js";
import {
  ContentPlanningAuthorizationError,
  ContentPlanningValidationError,
} from "../domain/contentPlanningErrors.js";

const PLAN_STATUSES = new Set(["draft", "active", "paused", "completed", "cancelled"]);

function validateTimezone(value) {
  const timezone = String(value || "").trim();
  if (!timezone) throw new ContentPlanningValidationError("timezone is required.");
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); }
  catch { throw new ContentPlanningValidationError(`Invalid IANA timezone '${timezone}'.`); }
  return timezone;
}

function normalizeStatus(value) {
  const status = String(value || "draft");
  if (!PLAN_STATUSES.has(status)) throw new ContentPlanningValidationError("Invalid content plan status.");
  return status;
}

function normalizeCadence(value) {
  return JSON.stringify(parseCadence(value));
}

export async function createContentPlan({ repository, tenant, input }) {
  const siteId = String(input.siteId || "").trim();
  const name = String(input.name || "").trim();
  if (!siteId) throw new ContentPlanningValidationError("siteId is required.");
  if (!name) throw new ContentPlanningValidationError("name is required.");
  await repository.assertSiteOwned(tenant, siteId);
  return repository.createPlan({
    tenant, site_id: siteId, name,
    timezone: validateTimezone(input.timezone),
    cadence_json: normalizeCadence(input.cadence),
    status: normalizeStatus(input.status),
    starts_at: input.startsAt || "", ends_at: input.endsAt || "",
    created_by: input.createdBy || "dashboard",
  });
}

export async function updateContentPlan({ repository, tenant, planId, input }) {
  const plan = await repository.getPlan(planId);
  if (plan.tenant !== tenant) throw new ContentPlanningAuthorizationError("Content plan does not belong to this tenant.");
  const patch = {};
  if (input.name !== undefined) {
    patch.name = String(input.name).trim();
    if (!patch.name) throw new ContentPlanningValidationError("name cannot be empty.");
  }
  if (input.timezone !== undefined) patch.timezone = validateTimezone(input.timezone);
  if (input.cadence !== undefined) patch.cadence_json = normalizeCadence(input.cadence);
  if (input.status !== undefined) patch.status = normalizeStatus(input.status);
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt || "";
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt || "";
  if (!Object.keys(patch).length) throw new ContentPlanningValidationError("No content plan fields to update.");
  return repository.updatePlan(planId, patch);
}
