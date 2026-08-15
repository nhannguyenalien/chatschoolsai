import { parseTrendReportText, trendReportIdentity } from "../domain/trends/import.js";
import { ContentPlanningValidationError } from "../domain/contentPlanningErrors.js";

export class TrendImportCompensationError extends Error {
  constructor(cause, cleanupErrors) {
    super(`Trend import failed and compensation was incomplete: ${cause.message}`);
    this.name = "TrendImportCompensationError";
    this.cause = cause;
    this.cleanupErrors = cleanupErrors;
  }
}

export async function importTrend({ repository, tenant, siteId = "", source = "dashboard", text }) {
  if (!tenant) throw new Error("Trend import requires tenant.");
  if (!text) throw new Error("Trend import requires JSON text.");
  if (siteId) await repository.assertSiteOwned(tenant, siteId);
  let report;
  try {
    report = parseTrendReportText(text);
  } catch (error) {
    throw new ContentPlanningValidationError(error.message);
  }
  const identity = await trendReportIdentity(report);
  const existing = await repository.findTrendImport(tenant, siteId, identity.reportId, identity.checksum);
  if (existing) return { ...existing, identity, recovered: report.selectedCount < 10, duplicate: true };
  let reportRecord = null;
  const topicRecords = [];
  try {
    try {
      reportRecord = await repository.createTrendReport({
        tenant, site_id: siteId, report_key: identity.reportId, checksum: identity.checksum,
        generated_at: report.generatedAt, total_candidates: report.totalCandidates,
        selected_count: report.selectedCount, source_summary_json: JSON.stringify(report.sourceSummary),
        raw_report_json: JSON.stringify(report), import_status: report.selectedCount === 10 ? "complete" : "partial",
        import_source: source,
      });
    } catch (cause) {
      const raced = await repository.findTrendImport(tenant, siteId, identity.reportId, identity.checksum);
      if (raced) return { ...raced, identity, recovered: report.selectedCount < 10, duplicate: true };
      throw cause;
    }
    for (const topic of report.topics) {
      topicRecords.push(await repository.createTrendTopic({
        tenant, site_id: siteId, report_id: reportRecord.id, rank: topic.rank, title: topic.title,
        category: topic.category, primary_keyword: topic.primaryKeyword, topic_json: JSON.stringify(topic),
        overall_score: topic.overallScore, status: "imported", duplicate_check_json: "",
      }));
    }
    return { report: reportRecord, topics: topicRecords, identity, recovered: report.selectedCount < 10, duplicate: false };
  } catch (cause) {
    const cleanupErrors = [];
    for (const topic of topicRecords.reverse()) {
      try { await repository.deleteTrendTopic(topic.id); } catch (error) { cleanupErrors.push(error); }
    }
    if (reportRecord?.id) {
      try { await repository.deleteTrendReport(reportRecord.id); } catch (error) { cleanupErrors.push(error); }
    }
    if (cleanupErrors.length) throw new TrendImportCompensationError(cause, cleanupErrors);
    throw cause;
  }
}
