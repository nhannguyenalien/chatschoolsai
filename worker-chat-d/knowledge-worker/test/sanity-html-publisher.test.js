import test from "node:test";
import assert from "node:assert/strict";
import { htmlToPortableText, createSanityHtmlPublisher, sanityPostDocumentId, slugify } from "../src/adapters/sanity/htmlPublisher.js";

test("converts headings, paragraphs and inline marks to Portable Text", () => {
  const blocks = htmlToPortableText('<h1>Title</h1><p>Hello <strong>bold</strong> and <em>it</em> &amp; <a href="https://x.test/a?b=1">link</a>.</p><h3>Sub</h3>');
  assert.deepEqual(blocks.map((b) => b.style), ["h2", "normal", "h3"]);
  const para = blocks[1];
  assert.equal(para.children.map((c) => c.text).join(""), "Hello bold and it & link.");
  const bold = para.children.find((c) => c.text === "bold");
  assert.deepEqual(bold.marks, ["strong"]);
  const link = para.children.find((c) => c.text === "link");
  assert.equal(para.markDefs.length, 1);
  assert.deepEqual(link.marks, [para.markDefs[0]._key]);
  assert.equal(para.markDefs[0].href, "https://x.test/a?b=1");
});

test("keeps lists, quotes and drops unsafe links", () => {
  const blocks = htmlToPortableText('<ul><li>one</li><li><a href="javascript:alert(1)">two</a></li></ul><ol><li>n</li></ol><blockquote><p>q</p></blockquote>');
  assert.deepEqual(blocks.map((b) => [b.style, b.listItem]), [["normal", "bullet"], ["normal", "bullet"], ["normal", "number"], ["blockquote", undefined]]);
  assert.equal(blocks[1].markDefs.length, 0);
  assert.equal(blocks[1].children[0].text, "two");
});

test("extracts images and treats bare text as a paragraph", () => {
  const blocks = htmlToPortableText('plain text<figure><img src="https://img.test/a.png" alt="A"></figure><img src="data:x">');
  assert.equal(blocks[0].children[0].text, "plain text");
  assert.deepEqual(blocks[1], { _type: "image", _key: blocks[1]._key, _url: "https://img.test/a.png", alt: "A" });
  assert.equal(blocks.length, 2);
});

test("slugify strips Vietnamese diacritics", () => {
  assert.equal(slugify("Đừng bỏ lỡ: Học tiếng Anh!"), "dung-bo-lo-hoc-tieng-anh");
  assert.equal(sanityPostDocumentId("abc 1"), "dashpoc-post-abc-1");
});

test("publishes idempotently with language, SEO fields and uploaded images", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.startsWith("https://img.test/")) return new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } });
    if (url.includes("/assets/images/")) return Response.json({ document: { _id: `image-${calls.length}` } });
    return Response.json({ results: [] });
  };
  const publish = createSanityHtmlPublisher({ fetchImpl, now: () => new Date("2026-10-20T00:00:00Z") });
  const page = { page_id: "c59xzt2l:production", access_token: "tok", default_language: "en", extra_config: "" };
  const post = { id: "p1", title: "Xin chào", slug: "", language: "vi", content: "<p>Nội dung</p><img src=\"https://img.test/in.png\" alt=\"in\">", meta_title: "SEO", meta_description: "Mô tả", alt_img: "bìa" };
  const id = await publish(page, post, { url: "https://img.test/cover.png" });
  assert.equal(id, "dashpoc-post-p1");
  const mutate = calls.find((c) => c.url.includes("/data/mutate/production"));
  const { mutations } = JSON.parse(mutate.init.body);
  assert.equal(mutations[0].createIfNotExists.publishedAt, "2026-10-20T00:00:00.000Z");
  const set = mutations[1].patch.set;
  assert.equal(set.language, "vi");
  assert.equal(set.slug.current, "xin-chao");
  assert.equal(set.seoTitle, "SEO");
  assert.equal(set.excerpt, "Mô tả");
  assert.equal(set.mainImage.alt, "bìa");
  assert.equal(set.body.at(-1)._type, "image");
  assert.equal("publishedAt" in set, false);
});

test("rejects empty bodies and bad page ids", async () => {
  const publish = createSanityHtmlPublisher({ fetchImpl: async () => Response.json({}) });
  await assert.rejects(publish({ page_id: "bad", access_token: "t" }, { id: "1", title: "t", content: "<p>x</p>" }), /projectId:dataset/);
  await assert.rejects(publish({ page_id: "p:d", access_token: "t" }, { id: "1", title: "t", content: "" }), /nội dung/);
});
