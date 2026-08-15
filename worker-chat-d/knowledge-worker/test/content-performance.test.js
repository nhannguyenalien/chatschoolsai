import test from "node:test";
import assert from "node:assert/strict";
import { normalizePerformanceSnapshot, performanceSnapshotKey, summarizePerformance } from "../src/domain/analytics/performance.js";
import { importPerformance } from "../src/workflows/importPerformance.js";
import { getPerformanceInsights } from "../src/workflows/getPerformanceInsights.js";

const gsc = {
  source: "gsc", externalKey: "https://example.test/blog/a", url: "https://example.test/blog/a",
  windowStart: "2026-07-01", windowEnd: "2026-07-31",
  metrics: { clicks: 20, impressions: 400, ctr: 0.05, position: 4.5 }, dimensions: { query: "topic a" },
};

test("normalizes provider-specific GSC and GA4 snapshots", () => {
  assert.equal(normalizePerformanceSnapshot(gsc).metrics.clicks, 20);
  const ga4 = normalizePerformanceSnapshot({ source: "GA4", externalKey: "/blog/a", windowStart: "2026-07-01", windowEnd: "2026-07-31", metrics: { sessions: 100, engagedSessions: 70, conversions: 3 } });
  assert.deepEqual(ga4.metrics, { sessions: 100, engagedSessions: 70, conversions: 3 });
  assert.throws(() => normalizePerformanceSnapshot({ ...gsc, source: "other" }), /gsc or ga4/);
  assert.throws(() => normalizePerformanceSnapshot({ ...gsc, metrics: { ...gsc.metrics, clicks: -1 } }), /clicks/);
});

test("creates stable snapshot identities independent of mutable metrics", async () => {
  const normalized = normalizePerformanceSnapshot(gsc);
  assert.equal(await performanceSnapshotKey(normalized), await performanceSnapshotKey({ ...normalized, metrics: { clicks: 999 } }));
});

test("imports analytics idempotently within tenant and site scope", async () => {
  const records = new Map();
  const repository = {
    async assertSiteOwned(tenant, siteId) { assert.deepEqual([tenant, siteId], ["tenant-a", "site-a"]); },
    async findPerformanceSnapshot(_tenant, _siteId, key) { return records.get(key) || null; },
    async createPerformanceSnapshot(record) { const stored = { id: `row-${records.size + 1}`, ...record }; records.set(record.snapshot_key, stored); return stored; },
  };
  const first = await importPerformance({ repository, tenant: "tenant-a", siteId: "site-a", snapshots: [gsc] });
  const second = await importPerformance({ repository, tenant: "tenant-a", siteId: "site-a", snapshots: [gsc] });
  assert.deepEqual([first.imported, first.duplicates], [1, 0]);
  assert.deepEqual([second.imported, second.duplicates], [0, 1]);
});

test("aggregates cross-provider insights without changing recommendation behavior", async () => {
  const records = [
    { metrics_json: JSON.stringify({ clicks: 20, impressions: 400 }) },
    { metrics_json: JSON.stringify({ sessions: 100, engagedSessions: 70, conversions: 3 }) },
  ];
  assert.deepEqual(summarizePerformance(records).derived, { ctr: 0.05, engagementRate: 0.7, conversionRate: 0.03 });
  const repository = { async assertSiteOwned() {}, async listPerformanceSnapshots() { return { items: records }; } };
  const insight = await getPerformanceInsights({ repository, tenant: "tenant-a", siteId: "site-a" });
  assert.equal(insight.advisoryOnly, true);
  assert.equal(insight.snapshotCount, 2);
});
