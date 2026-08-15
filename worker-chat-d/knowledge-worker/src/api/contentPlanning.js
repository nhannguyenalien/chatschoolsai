import { importTrend } from "../workflows/importTrend.js";
import { recommendTopic } from "../workflows/recommendTopic.js";
import { reviewTopic } from "../workflows/reviewTopic.js";
import { addApprovedTopicToPlan } from "../workflows/addApprovedTopicToPlan.js";
import { approveTopicToPlan } from "../workflows/approveTopicToPlan.js";
import { scheduleContentPlan } from "../workflows/scheduleContentPlan.js";
import { generateBlogDraft } from "../workflows/generateBlogDraft.js";
import { translateBlog } from "../workflows/translateBlog.js";
import { approveContentPlanItem } from "../workflows/approveContentPlanItem.js";
import { rejectContentPlanItem } from "../workflows/rejectContentPlanItem.js";
import { importPerformance } from "../workflows/importPerformance.js";
import { getPerformanceInsights } from "../workflows/getPerformanceInsights.js";
import { createContentPlan, updateContentPlan } from "../workflows/manageContentPlan.js";
import { SiteOwnershipError } from "../repositories/pocketbase/contentPlanningRepository.js";
import { PublishingDependencyError } from "../domain/publishing/dependencyGate.js";
import {
  ContentPlanningAuthorizationError,
  ContentPlanningConflictError,
  ContentPlanningValidationError,
} from "../domain/contentPlanningErrors.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(status, body, responseHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { ...responseHeaders, ...JSON_HEADERS } });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new ContentPlanningRequestError(400, "Request body must be valid JSON.");
  }
}

export class ContentPlanningRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ContentPlanningRequestError";
    this.status = status;
  }
}

export function createContentPlanningApi({ repository, legacyHistoryAdapter, blogWriter, imageGenerator, translator }) {
  if (!repository) throw new Error("Content Planning API requires a repository.");

  return async function handleContentPlanning(request, context) {
    const tenant = context?.tenant;
    const responseHeaders = context?.responseHeaders;
    if (!tenant) return json(401, { error: "Authentication is required." }, responseHeaders);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");

    try {
      if (request.method === "GET" && path === "/api/v1/content-planning/plans") {
        const plansResult = await repository.listPlans(tenant);
        const plans = plansResult.items || [];
        const itemGroups = await Promise.all(plans.map((plan) => repository.listPlanItems(plan.id)));
        return json(200, {
          plans: plans.map((plan, index) => ({
            id: plan.id, site_id: plan.site_id, name: plan.name, timezone: plan.timezone,
            cadence_json: plan.cadence_json, status: plan.status, starts_at: plan.starts_at, ends_at: plan.ends_at,
            items: (itemGroups[index]?.items || []).map((item) => ({
              id: item.id, topic: item.topic, content_type: item.content_type, status: item.status,
              scheduled_at: item.scheduled_at, dependencies_ready: item.dependencies_ready,
              translation_status: item.translation_status, error_log: item.error_log,
            })),
          })),
        }, responseHeaders);
      }

      if (request.method === "POST" && path === "/api/v1/content-planning/plans") {
        const result = await createContentPlan({ repository, tenant, input: await readJson(request) });
        return json(201, result, responseHeaders);
      }

      const planMatch = path.match(/^\/api\/v1\/content-planning\/plans\/([^/]+)$/);
      if (request.method === "PATCH" && planMatch) {
        const result = await updateContentPlan({ repository, tenant, planId: decodeURIComponent(planMatch[1]), input: await readJson(request) });
        return json(200, result, responseHeaders);
      }

      if (request.method === "GET" && path === "/api/v1/content-planning/review") {
        const [plansResult, topicsResult] = await Promise.all([
          repository.listActivePlans(tenant), repository.listTopicsForReview(tenant),
        ]);
        const plans = plansResult.items || [];
        const itemGroups = await Promise.all(plans.map((plan) => repository.listPlanItems(plan.id, ["draft", "review"])));
        const items = itemGroups.flatMap((result) => result.items || []);
        const posts = await Promise.all(items.map((item) => item.post_id
          ? repository.getPost(item.post_id).catch(() => null)
          : Promise.resolve(null)));
        return json(200, {
          plans: plans.map(({ id, site_id, name, timezone, cadence_json }) => ({ id, site_id, name, timezone, cadence_json })),
          topics: (topicsResult.items || []).map(({ id, site_id, title, primary_keyword, overall_score, rank, status }) => ({
            id, site_id, title, primary_keyword, overall_score, rank, status,
          })),
          items: items.map((item, index) => ({
            id: item.id, plan_id: item.plan_id, site_id: item.site_id, post_id: item.post_id,
            topic: item.topic, status: item.status, scheduled_at: item.scheduled_at,
            dependencies_ready: item.dependencies_ready, translation_status: item.translation_status,
            post: posts[index] ? { id: posts[index].id, title: posts[index].title, content: posts[index].content } : null,
          })),
        }, responseHeaders);
      }

      if (request.method === "GET" && path === "/api/v1/content-planning/analytics/insights") {
        const result = await getPerformanceInsights({ repository, tenant, siteId: url.searchParams.get("siteId") || "", source: url.searchParams.get("source") || "" });
        return json(200, result, responseHeaders);
      }

      if (request.method === "POST" && path === "/api/v1/content-planning/analytics/import") {
        const body = await readJson(request);
        if (!body.siteId) throw new ContentPlanningRequestError(400, "siteId is required.");
        if (!Array.isArray(body.snapshots) || !body.snapshots.length || body.snapshots.length > 500) throw new ContentPlanningRequestError(400, "snapshots must contain 1 to 500 records.");
        const result = await importPerformance({ repository, tenant, siteId: body.siteId, snapshots: body.snapshots });
        return json(201, result, responseHeaders);
      }

      if (request.method === "POST" && path === "/api/v1/content-planning/trends/import") {
        const body = await readJson(request);
        if (typeof body.trendJson !== "string" || !body.trendJson.trim()) {
          throw new ContentPlanningRequestError(400, "trendJson is required.");
        }
        const result = await importTrend({ repository, tenant, siteId: body.siteId || "", text: body.trendJson });
        return json(201, result, responseHeaders);
      }

      if (request.method === "POST" && path === "/api/v1/content-planning/trends/recommend") {
        const body = await readJson(request);
        const result = await recommendTopic({ repository, legacyHistoryAdapter, tenant, siteId: body.siteId || "", threshold: body.threshold });
        return json(200, result, responseHeaders);
      }

      const reviewMatch = path.match(/^\/api\/v1\/content-planning\/topics\/([^/]+)\/review$/);
      if (request.method === "POST" && reviewMatch) {
        const body = await readJson(request);
        if (!body.action) throw new ContentPlanningRequestError(400, "action is required.");
        const result = await reviewTopic({ repository, tenant, siteId: body.siteId || "", topicId: decodeURIComponent(reviewMatch[1]), action: body.action });
        return json(200, result, responseHeaders);
      }

      const approveToPlanMatch = path.match(/^\/api\/v1\/content-planning\/topics\/([^/]+)\/approve-to-plan$/);
      if (request.method === "POST" && approveToPlanMatch) {
        const body = await readJson(request);
        if (!body.planId) throw new ContentPlanningRequestError(400, "planId is required.");
        const result = await approveTopicToPlan({
          repository, tenant, planId: body.planId, topicId: decodeURIComponent(approveToPlanMatch[1]),
          contentType: body.contentType || "blog", scheduledAt: body.scheduledAt || "",
        });
        return json(result.duplicate ? 200 : 201, result, responseHeaders);
      }

      const planTopicMatch = path.match(/^\/api\/v1\/content-planning\/plans\/([^/]+)\/items\/from-topic$/);
      if (request.method === "POST" && planTopicMatch) {
        const body = await readJson(request);
        if (!body.topicId) throw new ContentPlanningRequestError(400, "topicId is required.");
        const result = await addApprovedTopicToPlan({
          repository, tenant, planId: decodeURIComponent(planTopicMatch[1]), topicId: body.topicId,
          contentType: body.contentType || "blog", scheduledAt: body.scheduledAt || "",
        });
        return json(result.duplicate ? 200 : 201, result, responseHeaders);
      }

      const schedulePlanMatch = path.match(/^\/api\/v1\/content-planning\/plans\/([^/]+)\/schedule$/);
      if (request.method === "POST" && schedulePlanMatch) {
        const body = await readJson(request);
        const result = await scheduleContentPlan({
          repository, tenant, planId: decodeURIComponent(schedulePlanMatch[1]), horizonDays: body.horizonDays ?? 90,
        });
        return json(200, result, responseHeaders);
      }

      const generateMatch = path.match(/^\/api\/v1\/content-planning\/items\/([^/]+)\/generate$/);
      if (request.method === "POST" && generateMatch) {
        if (!blogWriter) throw new ContentPlanningRequestError(503, "Blog generation AI is not configured.");
        const result = await generateBlogDraft({
          repository, writer: blogWriter, imageGenerator, tenant,
          itemId: decodeURIComponent(generateMatch[1]),
        });
        return json(result.duplicate ? 200 : 201, result, responseHeaders);
      }

      const translateMatch = path.match(/^\/api\/v1\/content-planning\/items\/([^/]+)\/translate$/);
      if (request.method === "POST" && translateMatch) {
        if (!translator) throw new ContentPlanningRequestError(503, "Translation AI is not configured.");
        const result = await translateBlog({ repository, translator, tenant, itemId: decodeURIComponent(translateMatch[1]) });
        return json(result.failedLanguages.length ? 502 : 200, result, responseHeaders);
      }

      const approveMatch = path.match(/^\/api\/v1\/content-planning\/items\/([^/]+)\/approve$/);
      if (request.method === "POST" && approveMatch) {
        const result = await approveContentPlanItem({ repository, tenant, itemId: decodeURIComponent(approveMatch[1]) });
        return json(200, result, responseHeaders);
      }

      const rejectMatch = path.match(/^\/api\/v1\/content-planning\/items\/([^/]+)\/reject$/);
      if (request.method === "POST" && rejectMatch) {
        const result = await rejectContentPlanItem({ repository, tenant, itemId: decodeURIComponent(rejectMatch[1]) });
        return json(200, result, responseHeaders);
      }

      return null;
    } catch (error) {
      if (error instanceof ContentPlanningRequestError) return json(error.status, { error: error.message }, responseHeaders);
      if (error instanceof ContentPlanningValidationError) return json(400, { error: error.message }, responseHeaders);
      if (error instanceof ContentPlanningAuthorizationError) return json(403, { error: error.message }, responseHeaders);
      if (error instanceof ContentPlanningConflictError) return json(409, { error: error.message }, responseHeaders);
      if (error instanceof PublishingDependencyError) return json(409, { error: error.message, details: error.details }, responseHeaders);
      if (error instanceof SiteOwnershipError) return json(403, { error: error.message }, responseHeaders);
      throw error;
    }
  };
}
