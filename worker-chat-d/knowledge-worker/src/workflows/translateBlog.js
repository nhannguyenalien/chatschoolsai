import { AI_AUTHOR_NAME, parseBlogDocument, renderBlogHtml, serializeBlogDocument } from "../domain/content-writing/blogDraft.js";
import { applyBlogSegments, collectBlogSegments, parseSiteLanguages } from "../domain/translations/blogTranslation.js";
import { ContentPlanningAuthorizationError, ContentPlanningConflictError, ContentPlanningValidationError } from "../domain/contentPlanningErrors.js";

export async function translateBlog({ repository, translator, tenant, itemId, now = new Date() }) {
  if (!repository || !translator) throw new Error("Blog translation requires repository and translator.");
  const item = await repository.getPlanItem(itemId);
  if (item.tenant !== tenant) throw new ContentPlanningAuthorizationError("Content plan item belongs to another tenant.");
  if (!item.post_id) throw new ContentPlanningConflictError("Generate the source blog before translating it.");
  if (!["draft", "review", "approved", "scheduled"].includes(item.status)) throw new ContentPlanningConflictError(`Cannot translate from status '${item.status}'.`);
  const [site, sourcePost] = await Promise.all([repository.assertSiteOwned(tenant, item.site_id), repository.getPost(item.post_id)]);
  if (sourcePost.translation_of) throw new ContentPlanningValidationError("A translated post cannot start another translation batch.");
  const { source, targets } = parseSiteLanguages(site);
  if (sourcePost.language && sourcePost.language !== source) throw new ContentPlanningValidationError("Source post language does not match the site default language.");
  if (!targets.length) {
    const updated = await repository.updatePlanItem(item.id, { dependencies_ready: true, translation_status: "not_required", error_log: "" });
    return { item: updated, jobs: [], failedLanguages: [] };
  }
  const document = parseBlogDocument(sourcePost.content_json);
  await repository.updatePlanItem(item.id, { dependencies_ready: false, translation_status: "translating", error_log: "" });
  const results = await Promise.allSettled(targets.map(async (language) => {
    const existing = await repository.findTranslationJob(sourcePost.id, item.site_id, language);
    if (existing?.status === "completed") return existing;
    if (existing && existing.status !== "failed") throw new Error(`Translation for '${language}' is already running.`);
    const job = existing || await repository.tryCreateTranslationJob({
      tenant, site_id: item.site_id, item_id: item.id, source_post_id: sourcePost.id,
      target_language: language, status: "pending", attempt_count: 0,
    });
    if (!job) throw new Error(`Translation for '${language}' is already running.`);
    await repository.updateTranslationJob(job.id, { status: "translating", attempt_count: Number(job.attempt_count || 0) + 1, error_log: "" });
    try {
      const localized = applyBlogSegments(document, await translator.translate(collectBlogSegments(document), language));
      const translatedPost = await repository.findTranslatedPost(sourcePost.id, language) || await repository.createPost({
        tenant, title: localized.draft.title.slice(0, 60), content: renderBlogHtml(localized.draft, { language, relatedPosts: localized.relatedPosts, sectionImages: localized.sectionImages }),
        content_json: serializeBlogDocument(localized.draft, localized), slug: sourcePost.slug,
        meta_title: localized.draft.title.slice(0, 60), meta_description: localized.draft.metaDescription.slice(0, 160),
        focus_keyword: sourcePost.focus_keyword || "", alt_img: localized.draft.sections[0]?.imageAlt || "",
        cluster_id: sourcePost.cluster_id || "", image_prompt: localized.draft.sections[0]?.imageAlt || "",
        content_plan_item_id: item.id, author: sourcePost.author || AI_AUTHOR_NAME, language, tag: sourcePost.tag || "", translation_of: sourcePost.id,
      });
      await repository.createTranslationTargetIfMissing({ tenant, postId: translatedPost.id, site, language });
      return repository.updateTranslationJob(job.id, { status: "completed", translated_post_id: translatedPost.id, completed_at: now.toISOString(), error_log: "" });
    } catch (error) {
      await repository.updateTranslationJob(job.id, { status: "failed", error_log: error instanceof Error ? error.message : "Translation failed." }).catch(() => {});
      throw error;
    }
  }));
  const failedLanguages = results.flatMap((result, index) => result.status === "rejected" ? [targets[index]] : []);
  const updated = await repository.updatePlanItem(item.id, {
    dependencies_ready: failedLanguages.length === 0, translation_status: failedLanguages.length ? "failed" : "completed",
    error_log: failedLanguages.length ? `Translation failed: ${failedLanguages.join(", ")}` : "",
  });
  return { item: updated, jobs: results.filter((result) => result.status === "fulfilled").map((result) => result.value), failedLanguages };
}
