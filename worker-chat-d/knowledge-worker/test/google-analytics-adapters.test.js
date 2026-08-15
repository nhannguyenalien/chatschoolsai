import test from "node:test";
import assert from "node:assert/strict";
import { mapSearchConsoleResponse } from "../src/adapters/analytics/googleSearchConsole.js";
import { mapGoogleAnalytics4Response } from "../src/adapters/analytics/googleAnalytics4.js";

const window = { windowStart: "2026-07-01", windowEnd: "2026-07-31" };

test("maps Search Console row keys using the request dimension order", () => {
  const [snapshot] = mapSearchConsoleResponse({
    ...window, dimensions: ["page", "query"],
    response: { rows: [{ keys: ["https://example.com/a", "topic a"], clicks: 12, impressions: 240, ctr: 0.05, position: 3.4 }] },
  });
  assert.deepEqual(snapshot, {
    source: "gsc", externalKey: "https://example.com/a", url: "https://example.com/a", ...window,
    metrics: { clicks: 12, impressions: 240, ctr: 0.05, position: 3.4 },
    dimensions: { page: "https://example.com/a", query: "topic a" },
  });
});

test("rejects Search Console rows that do not match requested dimensions", () => {
  assert.throws(() => mapSearchConsoleResponse({ ...window, dimensions: ["page", "query"], response: { rows: [{ keys: ["/a"] }] } }), /does not match/i);
});

test("maps GA4 headers and string metric values without relying on column position", () => {
  const [snapshot] = mapGoogleAnalytics4Response({
    ...window,
    response: {
      dimensionHeaders: [{ name: "country" }, { name: "pageLocation" }],
      metricHeaders: [{ name: "conversions" }, { name: "sessions" }, { name: "engagedSessions" }],
      rows: [{ dimensionValues: [{ value: "VN" }, { value: "https://example.com/a" }], metricValues: [{ value: "3" }, { value: "100" }, { value: "70" }] }],
    },
  });
  assert.deepEqual(snapshot, {
    source: "ga4", externalKey: "https://example.com/a", url: "https://example.com/a", ...window,
    metrics: { sessions: "100", engagedSessions: "70", conversions: "3" },
    dimensions: { country: "VN", pageLocation: "https://example.com/a" },
  });
});

test("rejects GA4 reports missing a required normalized metric", () => {
  assert.throws(() => mapGoogleAnalytics4Response({
    ...window,
    response: { dimensionHeaders: [{ name: "pagePath" }], metricHeaders: [{ name: "sessions" }], rows: [] },
  }), /engagedSessions is required/i);
});
