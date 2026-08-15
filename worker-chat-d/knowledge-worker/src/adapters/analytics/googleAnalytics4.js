import { ContentPlanningValidationError } from "../../domain/contentPlanningErrors.js";

const PAGE_DIMENSIONS = ["pageLocation", "pagePathPlusQueryString", "pagePath"];

export function mapGoogleAnalytics4Response({ response, windowStart, windowEnd }) {
  if (!response || typeof response !== "object" || !Array.isArray(response.rows)) {
    throw new ContentPlanningValidationError("GA4 response.rows must be an array.");
  }
  const dimensionNames = (response.dimensionHeaders || []).map((header) => String(header?.name || ""));
  const metricNames = (response.metricHeaders || []).map((header) => String(header?.name || ""));
  if (!dimensionNames.length || !metricNames.length) {
    throw new ContentPlanningValidationError("GA4 dimensionHeaders and metricHeaders are required.");
  }
  for (const required of ["sessions", "engagedSessions", "conversions"]) {
    if (!metricNames.includes(required)) throw new ContentPlanningValidationError(`GA4 metric ${required} is required.`);
  }
  return response.rows.map((row, rowIndex) => {
    if (row.dimensionValues?.length !== dimensionNames.length || row.metricValues?.length !== metricNames.length) {
      throw new ContentPlanningValidationError(`GA4 row ${rowIndex} does not match its headers.`);
    }
    const dimensions = Object.fromEntries(dimensionNames.map((name, index) => [name, String(row.dimensionValues[index]?.value ?? "")]));
    const metrics = Object.fromEntries(metricNames.map((name, index) => [name, row.metricValues[index]?.value]));
    const pageDimension = PAGE_DIMENSIONS.find((name) => dimensions[name]);
    const externalKey = pageDimension ? dimensions[pageDimension] : dimensionNames.map((name) => `${name}:${dimensions[name]}`).join("|");
    return {
      source: "ga4", externalKey, url: dimensions.pageLocation || "", windowStart, windowEnd,
      metrics: { sessions: metrics.sessions, engagedSessions: metrics.engagedSessions, conversions: metrics.conversions },
      dimensions,
    };
  });
}
