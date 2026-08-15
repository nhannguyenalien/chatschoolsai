import { summarizePerformance } from "../domain/analytics/performance.js";
import { ContentPlanningValidationError } from "../domain/contentPlanningErrors.js";

export async function getPerformanceInsights({ repository, tenant, siteId, source = "" }) {
  if (!tenant) throw new Error("Performance insights require tenant.");
  if (!siteId) throw new ContentPlanningValidationError("Performance insights require siteId.");
  if (source && !["gsc", "ga4"].includes(source)) throw new ContentPlanningValidationError("source must be gsc or ga4.");
  await repository.assertSiteOwned(tenant, siteId);
  const result = await repository.listPerformanceSnapshots(tenant, siteId, source);
  const records = result.items || [];
  return { siteId, source: source || "all", snapshotCount: records.length, ...summarizePerformance(records), advisoryOnly: true };
}
