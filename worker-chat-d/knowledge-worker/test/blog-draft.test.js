import test from "node:test";
import assert from "node:assert/strict";
import { AI_AUTHOR_NAME, buildBlogSystemPrompt, renderBlogHtml, slugifyBlogTitle, validateBlogDraft } from "../src/domain/content-writing/blogDraft.js";

const draft = {
  title: "Git cho người mới", metaDescription: "Một mô tả thực tế về Git dành cho người mới bắt đầu.",
  sections: [{ heading: "Bắt đầu <Git>", paragraphs: ["Dùng Git & kiểm tra lịch sử."], imageAlt: "A commit diagram" }],
  wikipediaReferences: [{ term: "Git", wikipediaTitle: "Git" }],
};

test("preserves Skillgo blog prompt and fixed AI author contract", () => {
  const prompt = buildBlogSystemPrompt("vi");
  assert.equal(AI_AUTHOR_NAME, "Đội Ngũ Toidayhoc");
  assert.match(prompt, /6-8 phần/); assert.match(prompt, /1200-1600 từ/); assert.match(prompt, /Vietnamese/);
  assert.match(prompt, /KHÔNG dùng markdown/); assert.match(prompt, /wikipediaTitle/);
});

test("validates draft shape and renders escaped internal and Wikipedia links at the end", () => {
  const validated = validateBlogDraft(draft);
  const html = renderBlogHtml(validated, { language: "vi", relatedPosts: [{ title: "Bài <cũ>", slug: "bai-cu" }] });
  assert.match(html, /<h2>Bắt đầu &lt;Git&gt;<\/h2>/);
  assert.match(html, /Dùng Git &amp; kiểm tra/);
  assert.ok(html.indexOf("Bài viết liên quan") > html.indexOf("Bắt đầu"));
  assert.match(html, /href="\/blog-details\/bai-cu"/);
  assert.ok(html.indexOf("Tài liệu tham khảo") > html.indexOf("Bài viết liên quan"));
  assert.match(html, /https:\/\/en\.wikipedia\.org\/wiki\/Git/);
  assert.throws(() => validateBlogDraft({ ...draft, sections: "bad" }), /arrays are invalid/);
});

test("uses Skillgo-compatible normalized slug plus four-character suffix", () => {
  assert.equal(slugifyBlogTitle("Đường đến Git!", () => 0.5), "duong-den-git-i");
});
