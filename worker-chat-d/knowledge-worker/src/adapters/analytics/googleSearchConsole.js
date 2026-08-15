import { ContentPlanningValidationError } from "../../domain/contentPlanningErrors.js";

export function mapSearchConsoleResponse({ response, dimensions = ["page"], windowStart, windowEnd }) {
  if (!response || typeof response !== "object" || !Array.isArray(response.rows)) {
    throw new ContentPlanningValidationError("Search Console response.rows must be an array.");
  }
  if (!Array.isArray(dimensions) || !dimensions.length) {
    throw new ContentPlanningValidationError("Search Console dimensions are required.");
  }
  return response.rows.map((row, rowIndex) => {
    if (!Array.isArray(row.keys) || row.keys.length !== dimensions.length) {
      throw new ContentPlanningValidationError(`Search Console row ${rowIndex} does not match the requested dimensions.`);
    }
    const values = Object.fromEntries(dimensions.map((name, index) => [name, String(row.keys[index] ?? "")]));
    const externalKey = values.page || dimensions.map((name) => `${name}:${values[name]}`).join("|");
    return {
      source: "gsc", externalKey, url: values.page || "", windowStart, windowEnd,
      metrics: { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position },
      dimensions: values,
    };
  });
}
