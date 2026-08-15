const TRANSITIONS = {
  approve: { from: new Set(["imported", "recommended"]), to: "approved" },
  reject: { from: new Set(["imported", "recommended", "approved"]), to: "rejected" },
};

export async function reviewTopic({ repository, tenant, siteId = "", topicId, action }) {
  const transition = TRANSITIONS[action];
  if (!tenant || !topicId) throw new ContentPlanningValidationError("Topic review requires tenant and topicId.");
  if (!transition) throw new ContentPlanningValidationError("action must be 'approve' or 'reject'.");
  const topic = await repository.getTrendTopic(topicId);
  if (topic.tenant !== tenant || (siteId && topic.site_id !== siteId)) {
    throw new ContentPlanningAuthorizationError("Trend topic does not belong to this tenant/site.");
  }
  if (!transition.from.has(topic.status)) {
    throw new ContentPlanningConflictError(`Cannot ${action} topic from status '${topic.status}'.`);
  }
  return repository.updateTrendTopic(topicId, { status: transition.to });
}
import {
  ContentPlanningAuthorizationError,
  ContentPlanningConflictError,
  ContentPlanningValidationError,
} from "../domain/contentPlanningErrors.js";
