export class PublishingDependencyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PublishingDependencyError";
    this.details = details;
  }
}

export function assertPublishingDependencies({ post, planItem }) {
  if (!post?.content_plan_item_id) return { managed: false, ready: true };
  if (!planItem || planItem.id !== post.content_plan_item_id) {
    throw new PublishingDependencyError("Content Planning item is missing.", { reason: "missing_plan_item" });
  }
  if (planItem.tenant !== post.tenant || (post.site_id && planItem.site_id !== post.site_id)) {
    throw new PublishingDependencyError("Content Planning ownership does not match the post.", { reason: "ownership_mismatch" });
  }
  const translationStatus = planItem.translation_status || "";
  if (planItem.dependencies_ready !== true || !["completed", "not_required"].includes(translationStatus)) {
    throw new PublishingDependencyError("Content Planning dependencies are not ready.", {
      reason: "dependencies_not_ready",
      translationStatus,
    });
  }
  return { managed: true, ready: true, translationStatus };
}
