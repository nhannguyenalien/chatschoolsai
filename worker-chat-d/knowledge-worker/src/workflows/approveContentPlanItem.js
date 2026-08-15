import { assertPublishingDependencies } from "../domain/publishing/dependencyGate.js";
import { parseSiteLanguages } from "../domain/translations/blogTranslation.js";
import { ContentPlanningAuthorizationError, ContentPlanningConflictError } from "../domain/contentPlanningErrors.js";

export async function approveContentPlanItem({ repository, tenant, itemId }) {
  const item = await repository.getPlanItem(itemId);
  if (item.tenant !== tenant) throw new ContentPlanningAuthorizationError("Content plan item belongs to another tenant.");
  if (!item.post_id) throw new ContentPlanningConflictError("Generate the source blog before approval.");
  if (!["draft", "review", "approved", "scheduled"].includes(item.status)) {
    throw new ContentPlanningConflictError(`Cannot approve from status '${item.status}'.`);
  }
  const [site, sourcePost] = await Promise.all([
    repository.assertSiteOwned(tenant, item.site_id), repository.getPost(item.post_id),
  ]);
  assertPublishingDependencies({ post: sourcePost, planItem: item });
  const { targets: languages } = parseSiteLanguages(site);
  const translatedPosts = await Promise.all(languages.map((language) => repository.findTranslatedPost(sourcePost.id, language)));
  const missing = languages.filter((_language, index) => !translatedPosts[index]);
  if (missing.length) throw new ContentPlanningConflictError(`Missing translated posts: ${missing.join(", ")}.`);
  const posts = [sourcePost, ...translatedPosts];
  const targets = (await Promise.all(posts.map((post) => repository.listPostTargets(tenant, post.id))))
    .flat().filter((target) => target.status === "pending");
  const approved = [];
  try {
    for (const target of targets) {
      approved.push(await repository.updatePostTarget(target.id, { status: "approved", error_log: "" }));
    }
    const updatedItem = item.status === "approved" ? item : await repository.updatePlanItem(item.id, { status: "approved", error_log: "" });
    return { item: updatedItem, posts: posts.map((post) => post.id), approvedTargets: approved.map((target) => target.id) };
  } catch (cause) {
    const rollback = await Promise.allSettled(approved.map((target) => repository.updatePostTarget(target.id, { status: "pending" })));
    const rollbackFailed = rollback.some((result) => result.status === "rejected");
    throw new ContentPlanningConflictError(rollbackFailed
      ? "Approval failed and compensation was incomplete; manual reconciliation is required."
      : `Approval failed and was rolled back: ${cause instanceof Error ? cause.message : "unknown error"}`);
  }
}
