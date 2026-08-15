import test from "node:test";
import assert from "node:assert/strict";
import { translateBlog } from "../src/workflows/translateBlog.js";

function fixture(fail = false) {
  const updates = []; const jobs = new Map();
  const source = { id: "post-1", tenant: "tenant-a", title: "Git", slug: "git-abcd", language: "en", author: "AI", tag: "Code", content_json: JSON.stringify({ version: 1, draft: { title: "Git", metaDescription: "Learn Git", sections: [{ heading: "Start", paragraphs: ["Use Git"], imageAlt: "Branches" }], wikipediaReferences: [] }, relatedPosts: [], sectionImages: [] }) };
  const repository = {
    async getPlanItem() { return { id: "item-1", tenant: "tenant-a", site_id: "site-1", post_id: "post-1", status: "draft" }; },
    async assertSiteOwned() { return { id: "site-1", default_language: "en", translation_languages_json: '["vi","ja"]', platform: "sanity", page_id: "p:d" }; },
    async getPost() { return source; }, async updatePlanItem(id, patch) { updates.push(patch); return { id, ...patch }; },
    async findTranslationJob(_post, _site, language) { return jobs.get(language) || null; },
    async tryCreateTranslationJob(value) { const job = { id: `job-${value.target_language}`, ...value }; jobs.set(value.target_language, job); return job; },
    async updateTranslationJob(id, patch) { const language = id.slice(4); const job = { ...jobs.get(language), ...patch }; jobs.set(language, job); return job; },
    async findTranslatedPost() { return null; }, async createPost(value) { return { id: `translated-${value.language}`, ...value }; }, async createTranslationTargetIfMissing() {},
  };
  const translator = { async translate(segments, language) { if (fail && language === "ja") throw new Error("boom"); return segments.map((value) => `${language}:${value}`); } };
  return { repository, translator, updates, jobs };
}

test("opens dependency gate only when every required translation succeeds", async () => {
  const f = fixture(); const result = await translateBlog({ ...f, tenant: "tenant-a", itemId: "item-1" });
  assert.deepEqual(result.failedLanguages, []); assert.equal(result.item.dependencies_ready, true); assert.equal(result.item.translation_status, "completed");
  assert.equal(f.jobs.get("vi").status, "completed"); assert.equal(f.jobs.get("ja").status, "completed");
});

test("keeps dependency gate closed and records each failed language", async () => {
  const f = fixture(true); const result = await translateBlog({ ...f, tenant: "tenant-a", itemId: "item-1" });
  assert.deepEqual(result.failedLanguages, ["ja"]); assert.equal(result.item.dependencies_ready, false); assert.equal(result.item.translation_status, "failed");
  assert.equal(f.jobs.get("ja").status, "failed");
});

test("marks a single-language site ready without calling AI", async () => {
  const f = fixture(); f.repository.assertSiteOwned = async () => ({ default_language: "en", translation_languages_json: "[]" });
  f.translator.translate = async () => { throw new Error("must not run"); };
  const result = await translateBlog({ ...f, tenant: "tenant-a", itemId: "item-1" });
  assert.equal(result.item.dependencies_ready, true); assert.equal(result.item.translation_status, "not_required");
});
