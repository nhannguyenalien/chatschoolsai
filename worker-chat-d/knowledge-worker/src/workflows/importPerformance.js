import { normalizePerformanceSnapshot, performanceSnapshotKey } from "../domain/analytics/performance.js";
import { ContentPlanningValidationError } from "../domain/contentPlanningErrors.js";

export async function importPerformance({ repository, tenant, siteId, snapshots }) {
  if (!tenant) throw new Error("Performance import requires tenant.");
  if (!siteId) throw new ContentPlanningValidationError("Performance import requires siteId.");
  if (!Array.isArray(snapshots) || !snapshots.length || snapshots.length > 500) throw new ContentPlanningValidationError("snapshots must contain 1 to 500 records.");
  await repository.assertSiteOwned(tenant, siteId);
  const normalized = snapshots.map(normalizePerformanceSnapshot);
  const prepared = await Promise.all(normalized.map(async (snapshot) => ({ snapshot, snapshotKey: await performanceSnapshotKey(snapshot) })));
  const results = [];
  for (const { snapshot, snapshotKey } of prepared) {
    const existing = await repository.findPerformanceSnapshot(tenant, siteId, snapshotKey);
    if (existing) { results.push({ record: existing, duplicate: true }); continue; }
    let record;
    try {
      record = await repository.createPerformanceSnapshot({
        tenant, site_id: siteId, post_id: snapshot.postId, source: snapshot.source,
        external_key: snapshot.externalKey, url: snapshot.url, snapshot_key: snapshotKey,
        window_start: snapshot.windowStart, window_end: snapshot.windowEnd,
        metrics_json: JSON.stringify(snapshot.metrics), dimensions_json: JSON.stringify(snapshot.dimensions),
        imported_at: new Date().toISOString(),
      });
    } catch (cause) {
      const raced = await repository.findPerformanceSnapshot(tenant, siteId, snapshotKey);
      if (raced) { results.push({ record: raced, duplicate: true }); continue; }
      throw cause;
    }
    results.push({ record, duplicate: false });
  }
  return { imported: results.filter((item) => !item.duplicate).length, duplicates: results.filter((item) => item.duplicate).length, results };
}
