import { ContentPlanningAuthorizationError, ContentPlanningConflictError } from "../domain/contentPlanningErrors.js";

export async function rejectContentPlanItem({ repository, tenant, itemId }) {
  const item = await repository.getPlanItem(itemId);
  if (item.tenant !== tenant) throw new ContentPlanningAuthorizationError("Content plan item belongs to another tenant.");
  if (!item.post_id) throw new ContentPlanningConflictError("Content plan item has no generated draft to reject.");
  if (!["draft", "review"].includes(item.status)) {
    throw new ContentPlanningConflictError(`Cannot reject from status '${item.status}'.`);
  }

  const sourcePost = await repository.getPost(item.post_id);
  if (sourcePost.tenant !== tenant) throw new ContentPlanningAuthorizationError("Source post belongs to another tenant.");
  const translatedPosts = await repository.listTranslatedPosts(sourcePost.id);
  if (translatedPosts.some((post) => post.tenant !== tenant)) {
    throw new ContentPlanningAuthorizationError("A translated post belongs to another tenant.");
  }
  const posts = [sourcePost, ...translatedPosts];
  const targets = (await Promise.all(posts.map((post) => repository.listPostTargets(tenant, post.id)))).flat();
  const unsafe = targets.filter((target) => ["publishing", "published"].includes(target.status));
  if (unsafe.length) throw new ContentPlanningConflictError("Cannot reject a draft that is publishing or already published.");

  await repository.updatePlanItem(item.id, {
    status: "cancelled", dependencies_ready: false, error_log: "Rejected by reviewer; deleting generated drafts.",
  });
  const deleted = [];
  try {
    for (const post of [...translatedPosts, sourcePost]) {
      await repository.deletePost(post.id);
      deleted.push(post.id);
    }
    const updatedItem = await repository.updatePlanItem(item.id, { post_id: "", error_log: "" });
    return { item: updatedItem, deletedPosts: deleted };
  } catch (cause) {
    await repository.updatePlanItem(item.id, {
      error_log: `Rejection incomplete after deleting ${deleted.join(", ") || "no posts"}; manual reconciliation required.`,
    }).catch(() => undefined);
    throw new ContentPlanningConflictError(`Rejection was incomplete; manual reconciliation is required: ${cause instanceof Error ? cause.message : "unknown error"}`);
  }
}
