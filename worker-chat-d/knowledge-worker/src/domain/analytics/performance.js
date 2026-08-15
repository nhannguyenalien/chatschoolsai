import { ContentPlanningValidationError } from "../contentPlanningErrors.js";

const SOURCES = new Set(["gsc", "ga4"]);

function finite(value, field, { min = 0 } = {}) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < min) throw new ContentPlanningValidationError(`${field} must be a number >= ${min}.`);
  return number;
}

function isoDate(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new ContentPlanningValidationError(`${field} must be a valid date.`);
  return date.toISOString();
}

export function normalizePerformanceSnapshot(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ContentPlanningValidationError("snapshot must be an object.");
  const source = String(input.source || "").toLowerCase();
  if (!SOURCES.has(source)) throw new ContentPlanningValidationError("source must be gsc or ga4.");
  const externalKey = String(input.externalKey || input.url || "").trim();
  if (!externalKey) throw new ContentPlanningValidationError("externalKey or url is required.");
  const windowStart = isoDate(input.windowStart, "windowStart");
  const windowEnd = isoDate(input.windowEnd, "windowEnd");
  if (windowStart > windowEnd) throw new ContentPlanningValidationError("windowStart must not be after windowEnd.");
  const metrics = source === "gsc"
    ? { clicks: finite(input.metrics?.clicks, "metrics.clicks"), impressions: finite(input.metrics?.impressions, "metrics.impressions"), ctr: finite(input.metrics?.ctr, "metrics.ctr"), position: finite(input.metrics?.position, "metrics.position") }
    : { sessions: finite(input.metrics?.sessions, "metrics.sessions"), engagedSessions: finite(input.metrics?.engagedSessions, "metrics.engagedSessions"), conversions: finite(input.metrics?.conversions, "metrics.conversions") };
  return { source, externalKey, postId: String(input.postId || ""), url: String(input.url || ""), windowStart, windowEnd, metrics, dimensions: input.dimensions && typeof input.dimensions === "object" ? input.dimensions : {} };
}

export async function performanceSnapshotKey(snapshot) {
  const identity = [snapshot.source, snapshot.externalKey, snapshot.windowStart, snapshot.windowEnd].join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function summarizePerformance(records) {
  const totals = { clicks: 0, impressions: 0, sessions: 0, engagedSessions: 0, conversions: 0 };
  for (const record of records) {
    const metrics = typeof record.metrics_json === "string" ? JSON.parse(record.metrics_json || "{}") : (record.metrics_json || {});
    for (const key of Object.keys(totals)) totals[key] += Number(metrics[key] || 0);
  }
  return {
    totals,
    derived: {
      ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
      engagementRate: totals.sessions ? totals.engagedSessions / totals.sessions : 0,
      conversionRate: totals.sessions ? totals.conversions / totals.sessions : 0,
    },
  };
}
