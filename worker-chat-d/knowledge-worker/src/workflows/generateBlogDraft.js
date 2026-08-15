import { AI_AUTHOR_NAME, renderBlogHtml, serializeBlogDocument, slugifyBlogTitle } from "../domain/content-writing/blogDraft.js";
import { ContentPlanningAuthorizationError, ContentPlanningConflictError, ContentPlanningValidationError } from "../domain/contentPlanningErrors.js";

const GENERATABLE_STATES = new Set(["queued", "scheduled"]);

export async function generateBlogDraft({ repository, writer, imageGenerator, tenant, itemId, now = new Date(), random = Math.random }) {
  if (!repository || !writer) throw new Error("Blog generation requires repository and writer.");
  if (!tenant || !itemId) throw new ContentPlanningValidationError("tenant and itemId are required.");
  const item = await repository.getPlanItem(itemId);
  if (item.tenant !== tenant) throw new ContentPlanningAuthorizationError("Content plan item belongs to another tenant.");
  if (item.content_type !== "blog") throw new ContentPlanningValidationError("Only blog plan items can use this workflow.");
  if (item.post_id && ["draft", "review", "approved", "scheduled", "publishing", "published"].includes(item.status)) {
    return { item, post: await repository.getPost(item.post_id), duplicate: true };
  }
  if (!GENERATABLE_STATES.has(item.status)) throw new ContentPlanningConflictError(`Cannot generate a blog from status '${item.status}'.`);
  const site = await repository.assertSiteOwned(tenant, item.site_id);
  const reservationId = crypto.randomUUID();
  const claim = await repository.tryClaimGeneration({ tenant, siteId: item.site_id, itemId, reservationId, claimedAt: now.toISOString() });
  if (!claim) throw new ContentPlanningConflictError("This content plan item is already being generated.");

  const previousStatus = item.status;
  let post;
  let target;
  try {
    await repository.updatePlanItem(item.id, { status: "generating", error_log: "", attempt_count: Number(item.attempt_count || 0) + 1 });
    const topicData = item.trend_topic_id ? await repository.getTrendTopic(item.trend_topic_id) : null;
    const topicDetails = topicData?.topic_json ? JSON.parse(topicData.topic_json) : {};
    const tag = topicData?.category || topicDetails.category || "General";
    const language = site.default_language || "en";
    const [draft, relatedPosts] = await Promise.all([
      writer.generate({ topic: item.topic, tag, language }),
      repository.listRelatedPosts(tenant, { seriesId: item.series_id || "", tag }),
    ]);

    const sectionImages = imageGenerator
      ? await Promise.all(draft.sections.map(async (section) => {
          try { return await imageGenerator.generate({ tenant, prompt: section.imageAlt, alt: section.imageAlt }); }
          catch { return null; }
        }))
      : [];
    const content = renderBlogHtml(draft, { language, relatedPosts, sectionImages });
    const title = draft.title.slice(0, 60);
    post = await repository.createPost({
      tenant, title, content, slug: slugifyBlogTitle(draft.title, random),
      meta_title: title, meta_description: draft.metaDescription.slice(0, 160),
      focus_keyword: topicData?.primary_keyword || "", alt_img: draft.sections[0]?.imageAlt || "",
      cluster_id: item.series_id || "", image_prompt: draft.sections[0]?.imageAlt || "",
      content_plan_item_id: item.id, author: AI_AUTHOR_NAME, language, tag,
      translation_of: "", content_json: serializeBlogDocument(draft, { relatedPosts, sectionImages }),
    });
    target = await repository.createPostTarget({
      tenant, post_id: post.id, platform: site.platform, page_id: site.page_id, status: "pending",
    });
    let cover = null;
    if (imageGenerator?.generateCover && repository.createPostMedia) {
      try {
        const url = await imageGenerator.generateCover({ tenant, tag, title: draft.title });
        cover = await repository.createPostMedia({ tenant, post_id: post.id, url, type: "image", order: 0 });
      } catch { /* Skillgo keeps the draft and uses the site's fallback cover. */ }
    }
    const updated = await repository.updatePlanItem(item.id, {
      status: "draft", post_id: post.id, dependencies_ready: false, error_log: "",
    });
    await repository.completeGenerationClaim(claim.id, { status: "consumed", post_id: post.id });
    return { item: updated, post, target, cover, duplicate: false };
  } catch (error) {
    if (target?.id) await repository.deletePostTarget(target.id).catch(() => {});
    if (post?.id) await repository.deletePost(post.id).catch(() => {});
    await repository.updatePlanItem(item.id, {
      status: previousStatus,
      ...(previousStatus === "queued" ? { order: -1 } : {}),
      error_log: error instanceof Error ? error.message : "Blog generation failed.",
    }).catch(() => {});
    await repository.releaseGenerationClaim(claim.id).catch(() => {});
    throw error;
  }
}
