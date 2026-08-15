import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiBlogIllustrator, sanitizeBlogSvg } from "../src/adapters/openai/blogIllustrator.js";

test("sanitizes executable SVG content", () => {
  const svg = sanitizeBlogSvg('<svg onclick="bad()"><script>bad()</script><a href="javascript:bad()"></a></svg>');
  assert.doesNotMatch(svg, /script|onclick|javascript:/i);
});

test("uses Skillgo SVG settings and uploads the result to tenant media", async () => {
  const calls = [];
  const illustrator = createOpenAiBlogIllustrator({
    baseUrl: "https://ai.test/v1", apiKey: "secret", mediaBaseUrl: "https://pb.test", mediaToken: "pb-secret",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("chat/completions")) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ svg: '<svg viewBox="0 0 900 600"></svg>' }) } }] }), { status: 200 });
      return new Response(JSON.stringify({ id: "asset-1", file: "cover.svg" }), { status: 200 });
    },
  });
  const url = await illustrator.generate({ tenant: "tenant-a", prompt: "Git", alt: "Git cover" });
  const aiBody = JSON.parse(calls[0].init.body);
  assert.equal(aiBody.max_tokens, 2200); assert.equal(aiBody.temperature, 0.6);
  assert.equal(aiBody.response_format.json_schema.name, "course_cover_svg");
  assert.equal(calls[1].init.body.get("tenant"), "tenant-a");
  assert.equal(url, "https://pb.test/api/files/media_library/asset-1/cover.svg");
});

test("does not disclose upstream response bodies on illustration failure", async () => {
  const illustrator = createOpenAiBlogIllustrator({ baseUrl: "https://ai.test", apiKey: "secret", mediaBaseUrl: "https://pb.test", mediaToken: "pb", fetchImpl: async () => new Response("sensitive", { status: 500 }) });
  await assert.rejects(() => illustrator.generate({ tenant: "tenant-a", prompt: "Git", alt: "Git" }), (error) => !error.message.includes("sensitive"));
});
