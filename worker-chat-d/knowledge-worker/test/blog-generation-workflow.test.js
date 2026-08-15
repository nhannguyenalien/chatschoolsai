import test from "node:test";
import assert from "node:assert/strict";
import { generateBlogDraft } from "../src/workflows/generateBlogDraft.js";

const aiDraft = { title: "Generated title", metaDescription: "Generated description", sections: [{ heading: "Heading", paragraphs: ["Paragraph"], imageAlt: "Diagram" }], wikipediaReferences: [{ term: "Git", wikipediaTitle: "Git" }] };

function repository(overrides = {}) {
  const updates = [];
  return {
    updates,
    async getPlanItem() { return { id: "item-1", tenant: "tenant-a", site_id: "site-1", content_type: "blog", topic: "Git", status: "queued", attempt_count: 0, trend_topic_id: "topic-1" }; },
    async assertSiteOwned() { return { platform: "sanity", page_id: "project:dataset", default_language: "vi" }; },
    async tryClaimGeneration() { return { id: "claim-1" }; },
    async updatePlanItem(id, patch) { updates.push(patch); return { id, ...patch }; },
    async getTrendTopic() { return { category: "Code", primary_keyword: "git", topic_json: "{}" }; },
    async listRelatedPosts() { return [{ title: "Published", slug: "published" }]; },
    async createPost(value) { return { id: "post-1", ...value }; },
    async createPostTarget(value) { return { id: "target-1", ...value }; },
    async completeGenerationClaim() {}, async releaseGenerationClaim() {}, async deletePost() {}, async deletePostTarget() {},
    ...overrides,
  };
}

test("claims, writes a canonical draft and creates only its selected site target", async () => {
  const repo = repository();
  const result = await generateBlogDraft({ repository: repo, writer: { async generate() { return aiDraft; } }, tenant: "tenant-a", itemId: "item-1", random: () => 0.5 });
  assert.equal(result.item.status, "draft"); assert.equal(result.post.author, "Đội Ngũ Toidayhoc");
  assert.equal(result.post.language, "vi"); assert.equal(result.target.platform, "sanity");
  assert.match(result.post.content, /\/blog-details\/published/);
  assert.deepEqual(repo.updates.map((patch) => patch.status), ["generating", "draft"]);
});

test("section image failures are non-fatal", async () => {
  const result = await generateBlogDraft({ repository: repository(), writer: { async generate() { return aiDraft; } }, imageGenerator: { async generate() { throw new Error("image failed"); } }, tenant: "tenant-a", itemId: "item-1" });
  assert.equal(result.post.id, "post-1"); assert.doesNotMatch(result.post.content, /<img/);
});

test("stores a generated cover as canonical post media without blocking the draft", async () => {
  const media = [];
  const repo = repository({ async createPostMedia(value) { media.push(value); return { id: "media-1", ...value }; } });
  const imageGenerator = { async generate() { return "https://pb.test/section.svg"; }, async generateCover() { return "https://pb.test/cover.svg"; } };
  const result = await generateBlogDraft({ repository: repo, writer: { async generate() { return aiDraft; } }, imageGenerator, tenant: "tenant-a", itemId: "item-1" });
  assert.equal(result.cover.id, "media-1");
  assert.deepEqual(media[0], { tenant: "tenant-a", post_id: "post-1", url: "https://pb.test/cover.svg", type: "image", order: 0 });
});

test("cover generation failures are non-fatal", async () => {
  const repo = repository({ async createPostMedia() { throw new Error("should not be called"); } });
  const imageGenerator = { async generate() { return null; }, async generateCover() { throw new Error("cover failed"); } };
  const result = await generateBlogDraft({ repository: repo, writer: { async generate() { return aiDraft; } }, imageGenerator, tenant: "tenant-a", itemId: "item-1" });
  assert.equal(result.post.id, "post-1"); assert.equal(result.cover, null);
});

test("releases a generation claim and restores queue state after a failed write", async () => {
  const cleanup = [];
  const repo = repository({ async createPost() { throw new Error("post failed"); }, async releaseGenerationClaim(id) { cleanup.push(id); } });
  await assert.rejects(() => generateBlogDraft({ repository: repo, writer: { async generate() { return aiDraft; } }, tenant: "tenant-a", itemId: "item-1" }), /post failed/);
  assert.deepEqual(cleanup, ["claim-1"]); assert.equal(repo.updates.at(-1).status, "queued");
  assert.equal(repo.updates.at(-1).order, -1);
  assert.match(repo.updates.at(-1).error_log, /post failed/);
});

test("restores a scheduled item without changing its queue order after failure", async () => {
  const repo = repository({
    async getPlanItem() { return { id: "item-1", tenant: "tenant-a", site_id: "site-1", content_type: "blog", topic: "Git", status: "scheduled", order: 4 }; },
    async createPost() { throw new Error("post failed"); },
  });
  await assert.rejects(() => generateBlogDraft({ repository: repo, writer: { async generate() { return aiDraft; } }, tenant: "tenant-a", itemId: "item-1" }));
  assert.equal(repo.updates.at(-1).status, "scheduled");
  assert.equal("order" in repo.updates.at(-1), false);
});

test("returns the existing draft idempotently without claiming again", async () => {
  const repo = repository({ async getPlanItem() { return { id: "item-1", tenant: "tenant-a", content_type: "blog", status: "draft", post_id: "post-1" }; }, async getPost() { return { id: "post-1" }; }, async tryClaimGeneration() { throw new Error("should not claim"); } });
  const result = await generateBlogDraft({ repository: repo, writer: {}, tenant: "tenant-a", itemId: "item-1" });
  assert.equal(result.duplicate, true); assert.equal(result.post.id, "post-1");
});
