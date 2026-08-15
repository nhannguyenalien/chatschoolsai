import { escapePocketBaseFilter } from "./client.js";

const COLLECTIONS = {
  reports: "trend_reports",
  topics: "trend_topics",
  claims: "recommendation_claims",
  plans: "content_plans",
  items: "content_plan_items",
  scheduleClaims: "schedule_claims",
  generationClaims: "generation_claims",
  translationJobs: "translation_jobs",
  performanceSnapshots: "content_performance_snapshots",
};

export class SiteOwnershipError extends Error {
  constructor(siteId) {
    super(`Site '${siteId}' does not belong to this tenant.`);
    this.name = "SiteOwnershipError";
    this.siteId = siteId;
  }
}

function scope(tenant, siteId) {
  const clauses = [`tenant='${escapePocketBaseFilter(tenant)}'`];
  if (siteId) clauses.push(`site_id='${escapePocketBaseFilter(siteId)}'`);
  return clauses.join(" && ");
}

export function createContentPlanningRepository(client) {
  return {
    async findBotConfigByOwnerChat(chatId) {
      const result = await client.list("bot_configs", {
        filter: `owner_telegram_chat_id='${escapePocketBaseFilter(chatId)}'`, perPage: 2,
      });
      return result.items?.length === 1 ? result.items[0] : null;
    },
    updateBotConfig(id, patch) {
      return client.update("bot_configs", id, patch);
    },
    listActivePlans(tenant) {
      return client.list(COLLECTIONS.plans, {
        filter: `${scope(tenant, "")} && status='active'`, sort: "created", perPage: 200,
      });
    },
    listPlans(tenant) {
      return client.list(COLLECTIONS.plans, {
        filter: scope(tenant, ""), sort: "-created", perPage: 200,
      });
    },
    async assertSiteOwned(tenant, siteId) {
      if (!siteId) return null;
      let site;
      try {
        site = await client.get("pages_config", siteId);
      } catch {
        throw new SiteOwnershipError(siteId);
      }
      if (site.tenant !== tenant) throw new SiteOwnershipError(siteId);
      return site;
    },
    createTrendReport(report) {
      return client.create(COLLECTIONS.reports, report);
    },
    async findTrendImport(tenant, siteId, reportKey, checksum) {
      const filter = `${scope(tenant, siteId)} && report_key='${escapePocketBaseFilter(reportKey)}' && checksum='${escapePocketBaseFilter(checksum)}'`;
      const reports = await client.list(COLLECTIONS.reports, { filter, perPage: 1 });
      const report = reports.items?.[0];
      if (!report) return null;
      const topics = await client.list(COLLECTIONS.topics, {
        filter: `tenant='${escapePocketBaseFilter(tenant)}' && report_id='${escapePocketBaseFilter(report.id)}'`,
        sort: "rank", perPage: 10,
      });
      return { report, topics: topics.items || [] };
    },
    createTrendTopic(topic) {
      return client.create(COLLECTIONS.topics, topic);
    },
    getTrendTopic(id) {
      return client.get(COLLECTIONS.topics, id);
    },
    listRecommendationCandidates(tenant, { siteId, status = "imported" } = {}) {
      const filter = `${scope(tenant, siteId)} && status='${escapePocketBaseFilter(status)}'`;
      return client.list(COLLECTIONS.topics, { filter, sort: "rank", perPage: 200 });
    },
    listTopicsForReview(tenant) {
      return client.list(COLLECTIONS.topics, {
        filter: `${scope(tenant, "")} && status='recommended'`, sort: "-reserved_at,rank", perPage: 200,
      });
    },
    async findPerformanceSnapshot(tenant, siteId, snapshotKey) {
      const result = await client.list(COLLECTIONS.performanceSnapshots, {
        filter: `${scope(tenant, siteId)} && snapshot_key='${escapePocketBaseFilter(snapshotKey)}'`, perPage: 1,
      });
      return result.items?.[0] || null;
    },
    createPerformanceSnapshot(snapshot) { return client.create(COLLECTIONS.performanceSnapshots, snapshot); },
    listPerformanceSnapshots(tenant, siteId, source = "") {
      const sourceFilter = source ? ` && source='${escapePocketBaseFilter(source)}'` : "";
      return client.list(COLLECTIONS.performanceSnapshots, {
        filter: `${scope(tenant, siteId)}${sourceFilter}`, sort: "-window_end", perPage: 500,
      });
    },
    updateTrendTopic(id, patch) {
      return client.update(COLLECTIONS.topics, id, patch);
    },
    async tryClaimRecommendation({ tenant, siteId = "", topicId, reservationId, claimedAt }) {
      try {
        return await client.create(COLLECTIONS.claims, {
          tenant, site_id: siteId, topic_id: topicId, reservation_id: reservationId,
          claimed_at: claimedAt, status: "active",
        });
      } catch (cause) {
        const existing = await client.list(COLLECTIONS.claims, {
          filter: `topic_id='${escapePocketBaseFilter(topicId)}'`, perPage: 1,
        });
        if (existing.items?.length) return null;
        throw cause;
      }
    },
    releaseRecommendationClaim(id) {
      return client.delete(COLLECTIONS.claims, id);
    },
    deleteTrendTopic(id) {
      return client.delete(COLLECTIONS.topics, id);
    },
    deleteTrendReport(id) {
      return client.delete(COLLECTIONS.reports, id);
    },
    async listHistoricalTopics(tenant, siteId) {
      const siteScope = scope(tenant, siteId);
      const [posts, planItems] = await Promise.all([
        client.list("posts", { filter: `tenant='${escapePocketBaseFilter(tenant)}'`, sort: "-created", perPage: 500 }),
        client.list(COLLECTIONS.items, { filter: `${siteScope} && status!='cancelled'`, sort: "-created", perPage: 500 }),
      ]);
      return [
        ...(posts.items || []).map((item) => ({ title: item.title, source: "blog" })),
        ...(planItems.items || []).map((item) => ({ title: item.topic, source: "queue" })),
      ].filter((item) => item.title);
    },
    createPlan(plan) {
      if (!plan.site_id) throw new Error("Content plan requires site_id.");
      return client.create(COLLECTIONS.plans, plan);
    },
    getPlan(id) {
      return client.get(COLLECTIONS.plans, id);
    },
    updatePlan(id, patch) {
      return client.update(COLLECTIONS.plans, id, patch);
    },
    async findPlanItemByTopic(planId, topicId) {
      const result = await client.list(COLLECTIONS.items, {
        filter: `plan_id='${escapePocketBaseFilter(planId)}' && trend_topic_id='${escapePocketBaseFilter(topicId)}'`,
        perPage: 1,
      });
      return result.items?.[0] || null;
    },
    async nextPlanItemOrder(planId) {
      const result = await client.list(COLLECTIONS.items, {
        filter: `plan_id='${escapePocketBaseFilter(planId)}'`, sort: "-order", perPage: 1,
      });
      return Number(result.items?.[0]?.order || 0) + 1;
    },
    createPlanItem(item) {
      if (!item.plan_id || !item.site_id) throw new Error("Content plan item requires plan_id and site_id.");
      return client.create(COLLECTIONS.items, item);
    },
    deletePlanItem(id) {
      return client.delete(COLLECTIONS.items, id);
    },
    updatePlanItem(id, patch) {
      return client.update(COLLECTIONS.items, id, patch);
    },
    getPlanItem(id) {
      return client.get(COLLECTIONS.items, id);
    },
    listPlanItems(planId, statuses) {
      const statusFilter = Array.isArray(statuses) && statuses.length
        ? ` && (${statuses.map((status) => `status='${escapePocketBaseFilter(status)}'`).join(" || ")})`
        : "";
      return client.list(COLLECTIONS.items, {
        filter: `plan_id='${escapePocketBaseFilter(planId)}'${statusFilter}`, sort: "order", perPage: 500,
      });
    },
    getPost(id) {
      return client.get("posts", id);
    },
    createPost(post) {
      return client.create("posts", post);
    },
    updatePost(id, patch) { return client.update("posts", id, patch); },
    async findTranslatedPost(sourcePostId, language) {
      const result = await client.list("posts", { filter: `translation_of='${escapePocketBaseFilter(sourcePostId)}' && language='${escapePocketBaseFilter(language)}'`, perPage: 1 });
      return result.items?.[0] || null;
    },
    async listTranslatedPosts(sourcePostId) {
      const result = await client.list("posts", {
        filter: `translation_of='${escapePocketBaseFilter(sourcePostId)}'`, sort: "created", perPage: 100,
      });
      return result.items || [];
    },
    async listPostTargets(tenant, postId) {
      const result = await client.list("post_targets", { filter: `tenant='${escapePocketBaseFilter(tenant)}' && post_id='${escapePocketBaseFilter(postId)}'`, perPage: 100 });
      return result.items || [];
    },
    updatePostTarget(id, patch) { return client.update("post_targets", id, patch); },
    async findTranslationJob(sourcePostId, siteId, language) {
      const result = await client.list(COLLECTIONS.translationJobs, { filter: `source_post_id='${escapePocketBaseFilter(sourcePostId)}' && site_id='${escapePocketBaseFilter(siteId)}' && target_language='${escapePocketBaseFilter(language)}'`, perPage: 1 });
      return result.items?.[0] || null;
    },
    async tryCreateTranslationJob(job) {
      try { return await client.create(COLLECTIONS.translationJobs, job); }
      catch (cause) {
        if (await this.findTranslationJob(job.source_post_id, job.site_id, job.target_language)) return null;
        throw cause;
      }
    },
    updateTranslationJob(id, patch) { return client.update(COLLECTIONS.translationJobs, id, patch); },
    async createTranslationTargetIfMissing({ tenant, postId, site }) {
      const result = await client.list("post_targets", { filter: `tenant='${escapePocketBaseFilter(tenant)}' && post_id='${escapePocketBaseFilter(postId)}' && page_id='${escapePocketBaseFilter(site.page_id)}'`, perPage: 1 });
      return result.items?.[0] || client.create("post_targets", { tenant, post_id: postId, platform: site.platform, page_id: site.page_id, status: "pending" });
    },
    deletePost(id) {
      return client.delete("posts", id);
    },
    createPostTarget(target) {
      return client.create("post_targets", target);
    },
    createPostMedia(media) {
      return client.create("media", media);
    },
    deletePostTarget(id) {
      return client.delete("post_targets", id);
    },
    async listRelatedPosts(tenant, { seriesId, tag }) {
      const tenantFilter = `tenant='${escapePocketBaseFilter(tenant)}'`;
      const targets = await client.list("post_targets", {
        filter: `${tenantFilter} && status='published'`, sort: "-created", perPage: 500,
      });
      const publishedIds = [...new Set((targets.items || []).map((target) => target.post_id).filter(Boolean))];
      const posts = (await Promise.all(publishedIds.map((id) => client.get("posts", id).catch(() => null))))
        .filter((post) => post?.title && post?.slug);
      if (seriesId) {
        const bySeries = posts.filter((post) => post.cluster_id === seriesId)
          .sort((a, b) => String(a.created).localeCompare(String(b.created))).slice(0, 3);
        if (bySeries.length) return bySeries.map(({ id, title, slug }) => ({ id, title, slug }));
      }
      if (!tag) return [];
      return posts.filter((post) => post.tag === tag)
        .sort((a, b) => String(b.created).localeCompare(String(a.created))).slice(0, 3)
        .map(({ id, title, slug }) => ({ id, title, slug }));
    },
    async tryClaimGeneration({ tenant, siteId, itemId, reservationId, claimedAt }) {
      try {
        return await client.create(COLLECTIONS.generationClaims, {
          tenant, site_id: siteId, item_id: itemId, reservation_id: reservationId, claimed_at: claimedAt, status: "active",
        });
      } catch (cause) {
        const existing = await client.list(COLLECTIONS.generationClaims, {
          filter: `item_id='${escapePocketBaseFilter(itemId)}'`, perPage: 1,
        });
        if (existing.items?.length) return null;
        throw cause;
      }
    },
    completeGenerationClaim(id, patch) {
      return client.update(COLLECTIONS.generationClaims, id, patch);
    },
    releaseGenerationClaim(id) {
      return client.delete(COLLECTIONS.generationClaims, id);
    },
    listUnscheduledPlanItems(planId) {
      return client.list(COLLECTIONS.items, {
        filter: `plan_id='${escapePocketBaseFilter(planId)}' && status='queued' && scheduled_at=''`, sort: "order", perPage: 500,
      });
    },
    listScheduledPlanItems(planId) {
      return client.list(COLLECTIONS.items, {
        filter: `plan_id='${escapePocketBaseFilter(planId)}' && status!='cancelled' && scheduled_at!=''`, sort: "scheduled_at", perPage: 500,
      });
    },
    async tryClaimSchedule({ tenant, siteId, planId, itemId, slot, reservationId, claimedAt }) {
      try {
        return await client.create(COLLECTIONS.scheduleClaims, {
          tenant, site_id: siteId, plan_id: planId, item_id: itemId, slot, reservation_id: reservationId, claimed_at: claimedAt,
        });
      } catch (cause) {
        const existing = await client.list(COLLECTIONS.scheduleClaims, {
          filter: `item_id='${escapePocketBaseFilter(itemId)}' || (plan_id='${escapePocketBaseFilter(planId)}' && slot='${escapePocketBaseFilter(slot)}')`, perPage: 1,
        });
        if (existing.items?.length) return null;
        throw cause;
      }
    },
    releaseScheduleClaim(id) {
      return client.delete(COLLECTIONS.scheduleClaims, id);
    },
    listReadyPlanItems(tenant, siteId) {
      const filter = `${scope(tenant, siteId)} && status='approved' && dependencies_ready=true`;
      return client.list(COLLECTIONS.items, { filter, sort: "scheduled_at,order", perPage: 200 });
    },
  };
}

export { COLLECTIONS as CONTENT_PLANNING_COLLECTIONS };
