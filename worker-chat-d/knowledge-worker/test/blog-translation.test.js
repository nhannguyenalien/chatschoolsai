import test from "node:test";
import assert from "node:assert/strict";
import { applyBlogSegments, collectBlogSegments, parseSiteLanguages } from "../src/domain/translations/blogTranslation.js";
import { createOpenAiSegmentTranslator } from "../src/adapters/openai/segmentTranslator.js";

const document = { version: 1, draft: { title: "Git", metaDescription: "Learn Git", sections: [{ heading: "Start", paragraphs: ["Use `git init` at https://example.test."], imageAlt: "Branch diagram" }], wikipediaReferences: [{ term: "version control", wikipediaTitle: "Version control" }] }, relatedPosts: [{ title: "Related", slug: "related" }], sectionImages: [{ url: "https://img.test/a.svg" }] };

test("collects and reapplies blog strings without changing links or Wikipedia titles", () => {
  const segments = collectBlogSegments(document);
  const localized = applyBlogSegments(document, segments.map((value) => `VI:${value}`));
  assert.equal(localized.draft.sections[0].paragraphs[0], "VI:Use `git init` at https://example.test.");
  assert.equal(localized.draft.wikipediaReferences[0].wikipediaTitle, "Version control");
  assert.equal(localized.relatedPosts[0].slug, "related");
  assert.equal(localized.sectionImages[0].url, "https://img.test/a.svg");
});

test("site language targets are unique and exclude source", () => {
  assert.deepEqual(parseSiteLanguages({ default_language: "en", translation_languages_json: '["vi","en","vi","ja"]' }), { source: "en", targets: ["vi", "ja"] });
  assert.deepEqual(parseSiteLanguages({ default_language: "vi", translation_languages_json: '["en","fr","ja","ko","es"]' }), { source: "vi", targets: ["en", "fr", "ja", "ko", "es"] });
});

test("translator preserves Skillgo structured settings and rejects wrong output count", async () => {
  let body;
  const translator = createOpenAiSegmentTranslator({ baseUrl: "https://ai.test/v1", apiKey: "key", model: "model", fetchImpl: async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"translations":["one"]}' } }] }), { status: 200 });
  } });
  await assert.rejects(() => translator.translate(["a", "b"], "vi"), /expected 2/);
  assert.equal(body.temperature, 0.3);
  assert.equal(body.max_tokens, 1240);
  assert.equal(body.response_format.json_schema.name, "lesson_translation");
});
