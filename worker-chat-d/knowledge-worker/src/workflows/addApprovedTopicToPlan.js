import {
  ContentPlanningAuthorizationError,
  ContentPlanningConflictError,
  ContentPlanningValidationError,
} from "../domain/contentPlanningErrors.js";

export class PlanItemCompensationError extends Error {
  constructor(cause, itemId, cleanupError) {
    super(`Topic-to-plan write failed and plan item '${itemId}' could not be removed.`);
    this.name = "PlanItemCompensationError";
    this.cause = cause;
    this.itemId = itemId;
    this.cleanupError = cleanupError;
  }
}

function assertOwned(record, tenant, siteId, label) {
  if (record.tenant !== tenant || record.site_id !== siteId) {
    throw new ContentPlanningAuthorizationError(`${label} does not belong to this tenant/site.`);
  }
}

export async function addApprovedTopicToPlan({ repository, tenant, planId, topicId, contentType = "blog", scheduledAt = "" }) {
  if (!tenant || !planId || !topicId) {
    throw new ContentPlanningValidationError("Adding a topic to a plan requires tenant, planId and topicId.");
  }
  if (typeof contentType !== "string" || !contentType.trim()) {
    throw new ContentPlanningValidationError("contentType must be a non-empty string.");
  }
  if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) {
    throw new ContentPlanningValidationError("scheduledAt must be a valid date-time.");
  }

  const [plan, topic] = await Promise.all([repository.getPlan(planId), repository.getTrendTopic(topicId)]);
  assertOwned(plan, tenant, plan.site_id, "Content plan");
  assertOwned(topic, tenant, plan.site_id, "Trend topic");
  if (!["draft", "active"].includes(plan.status)) {
    throw new ContentPlanningConflictError(`Cannot add an item to plan from status '${plan.status}'.`);
  }
  if (topic.status !== "approved") {
    throw new ContentPlanningConflictError(`Cannot add topic from status '${topic.status}'.`);
  }

  const existing = await repository.findPlanItemByTopic(planId, topicId);
  if (existing) return { item: existing, topic, duplicate: true };

  const order = await repository.nextPlanItemOrder(planId);
  let item;
  try {
    item = await repository.createPlanItem({
      tenant, site_id: plan.site_id, plan_id: planId, trend_topic_id: topicId,
      content_type: contentType.trim(), topic: topic.title, order, status: "queued",
      scheduled_at: scheduledAt || "", dependencies_ready: false, attempt_count: 0,
    });
  } catch (cause) {
    const winner = await repository.findPlanItemByTopic(planId, topicId);
    if (winner) return { item: winner, topic, duplicate: true };
    throw cause;
  }

  try {
    const consumedTopic = await repository.updateTrendTopic(topicId, { status: "consumed" });
    return { item, topic: consumedTopic, duplicate: false };
  } catch (cause) {
    try {
      await repository.deletePlanItem(item.id);
    } catch (cleanupError) {
      throw new PlanItemCompensationError(cause, item.id, cleanupError);
    }
    throw cause;
  }
}
