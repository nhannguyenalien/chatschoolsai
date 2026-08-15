import { ContentPlanningAuthorizationError, ContentPlanningConflictError } from "../domain/contentPlanningErrors.js";
import { addApprovedTopicToPlan, PlanItemCompensationError } from "./addApprovedTopicToPlan.js";
import { reviewTopic } from "./reviewTopic.js";

export class TopicApprovalCompensationError extends Error {
  constructor(cause, topicId, cleanupError) {
    super(`Topic '${topicId}' was approved but its previous review status could not be restored.`);
    this.name = "TopicApprovalCompensationError";
    this.cause = cause;
    this.topicId = topicId;
    this.cleanupError = cleanupError;
  }
}

export async function approveTopicToPlan({ repository, tenant, planId, topicId, contentType = "blog", scheduledAt = "" }) {
  const topic = await repository.getTrendTopic(topicId);
  if (topic.tenant !== tenant) throw new ContentPlanningAuthorizationError("Trend topic does not belong to this tenant.");
  if (!["imported", "recommended", "approved"].includes(topic.status)) {
    throw new ContentPlanningConflictError(`Cannot approve topic from status '${topic.status}'.`);
  }

  const originalStatus = topic.status;
  const changedReviewStatus = originalStatus !== "approved";
  if (changedReviewStatus) {
    await reviewTopic({ repository, tenant, siteId: topic.site_id, topicId, action: "approve" });
  }

  try {
    return await addApprovedTopicToPlan({ repository, tenant, planId, topicId, contentType, scheduledAt });
  } catch (cause) {
    // A failed plan-item cleanup needs operator intervention; do not make the topic
    // selectable again while a possibly live item still references it.
    if (!changedReviewStatus || cause instanceof PlanItemCompensationError) throw cause;
    try {
      await repository.updateTrendTopic(topicId, { status: originalStatus });
    } catch (cleanupError) {
      throw new TopicApprovalCompensationError(cause, topicId, cleanupError);
    }
    throw cause;
  }
}
