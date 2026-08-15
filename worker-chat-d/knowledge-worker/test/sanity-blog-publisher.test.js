import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSkillgoBlogDocument, buildSkillgoPortableText, createSanityBlogPublisher, isSkillgoBlogProfile, sanityBlogDocumentId,
} from "../src/adapters/sanity/blogPublisher.js";

const structuredDocument = {
  version: 1,
  draft: {
    title: "A title", metaDescription: "A sufficiently long description for the original Skillgo validation contract.",
    sections: [{ heading: "First", paragraphs: ["One paragraph."], imageAlt: "Diagram alt" }],
    wikipediaReferences: [{ term: "API", wikipediaTitle: "API" }],
  },
  relatedPosts: [{ title: "Related", slug: "related" }],
  sectionImages: [{ url: "https://images.test/section.png", alt: "Diagram alt" }],
};

const post = {
  id: "post_123", title: "A title", slug: "a-title", tag: "Marketing", cluster_id: "series-1",
  created: "2026-08-05 10:00:00.000Z", author: "Đội Ngũ Toidayhoc", language: "vi",
  meta_title: "SEO title", meta_description: structuredDocument.draft.metaDescription, alt_img: "Cover alt",
  content_json: JSON.stringify(structuredDocument), translation_of: "source_456",
};

test("builds the exact Skillgo blog schema and deterministic translation reference", () => {
  const document = buildSkillgoBlogDocument({ post, structuredDocument, thumbAssetRef: "image-cover", sectionAssetRefs: ["image-section"] });
  assert.equal(document._id, "dashpoc-blog-post_123");
  assert.equal(document._type, "blog");
  assert.deepEqual(document.slug, { _type: "slug", current: "a-title" });
  assert.deepEqual(document.translationOf, { _type: "reference", _ref: "dashpoc-blog-source_456" });
  assert.equal(document.seriesId, undefined);
  assert.equal(document.seoTitle, undefined);
  assert.deepEqual(document.thumb, { _type: "image", alt: "Cover alt", asset: { _type: "reference", _ref: "image-cover" } });
  assert.equal(document.content.find((block) => block._type === "image").alt, "Diagram alt");
  assert.equal(document.content.find((block) => block._key === "related-0").markDefs[0].href, "/blog-details/related");
  assert.match(document.content.find((block) => block._key === "reference-0").markDefs[0].href, /wikipedia\.org/);
});

test("localizes generated related and reference headings in every supported language", () => {
  const labels = {
    en: ["Related Articles", "Further Reading"], vi: ["Bài viết liên quan", "Tài liệu tham khảo"],
    ja: ["関連記事", "参考資料"], es: ["Artículos relacionados", "Lecturas adicionales"],
    fr: ["Articles connexes", "Pour aller plus loin"], ko: ["관련 글", "추가 자료"],
  };
  for (const [language, [related, references]] of Object.entries(labels)) {
    const blocks = buildSkillgoPortableText({ ...structuredDocument, language });
    assert.equal(blocks.find((block) => block._key === "related-heading").children[0].text, related);
    assert.equal(blocks.find((block) => block._key === "references-heading").children[0].text, references);
  }
});

test("reuses the source Sanity assets for a translation without uploading duplicates", async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("/data/query/")) {
      return Response.json({ result: {
        thumb: { asset: { _ref: "image-source-cover" } },
        content: [
          { _type: "block", style: "h2" },
          { _type: "image", asset: { _ref: "image-source-section" } },
        ],
      } });
    }
    return Response.json({ results: [{ id: sanityBlogDocumentId(post.id) }] });
  };
  const publish = createSanityBlogPublisher({ fetchImpl });
  await publish({ page_id: "project-1:production", access_token: "secret" }, post, null);
  assert.equal(requests.some((request) => request.url.includes("/assets/images/")), false);
  const mutation = requests.find((request) => request.url.includes("/data/mutate/"));
  const document = JSON.parse(mutation.options.body).mutations[0].createOrReplace;
  assert.equal(document.thumb.asset._ref, "image-source-cover");
  assert.equal(document.content.find((block) => block._type === "image").asset._ref, "image-source-section");
});

test("fails closed before mutation when the translated source document is missing", async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return Response.json({ result: null });
  };
  const publish = createSanityBlogPublisher({ fetchImpl });
  await assert.rejects(
    publish({ page_id: "project-1:production", access_token: "secret" }, post, null),
    /must be published before its translation/,
  );
  assert.equal(requests.some((request) => request.url.includes("/data/mutate/")), false);
});

test("publishes with createOrReplace so retries reconcile one Sanity document", async () => {
  const sourcePost = { ...post, translation_of: "" };
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).startsWith("https://images.test/")) return new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } });
    if (String(url).includes("/assets/images/")) return Response.json({ document: { _id: `image-${requests.length}` } });
    return Response.json({ results: [{ id: sanityBlogDocumentId(post.id) }] });
  };
  const publish = createSanityBlogPublisher({ fetchImpl });
  const page = { page_id: "project-1:production", access_token: "secret" };
  assert.equal(await publish(page, sourcePost, { url: "https://images.test/cover.png" }), "dashpoc-blog-post_123");
  const mutation = requests.find((request) => request.url.includes("/data/mutate/"));
  const body = JSON.parse(mutation.options.body);
  assert.equal(body.mutations[0].createOrReplace._id, "dashpoc-blog-post_123");
  assert.equal(body.mutations[0].createOrReplace.seriesId, "series-1");
  assert.equal(body.mutations[0].create, undefined);
});

test("requires explicit profile opt-in and validates deterministic ids", () => {
  assert.equal(isSkillgoBlogProfile({ extra_config: '{"contentPlanningProfile":"skillgo-blog-v1"}' }), true);
  assert.equal(isSkillgoBlogProfile({ extra_config: '{"docType":"post"}' }), false);
  assert.throws(() => sanityBlogDocumentId("***"), /post id/i);
});
