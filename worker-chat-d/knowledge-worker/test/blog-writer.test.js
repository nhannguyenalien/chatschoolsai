import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiBlogWriter } from "../src/adapters/openai/blogWriter.js";

const aiDraft = { title: "Title", metaDescription: "Description", sections: [{ heading: "Heading", paragraphs: ["Paragraph"], imageAlt: "Diagram" }], wikipediaReferences: [{ term: "Git", wikipediaTitle: "Git" }] };

test("calls OpenAI with the Skillgo structured-output settings", async () => {
  let call;
  const writer = createOpenAiBlogWriter({ baseUrl: "https://ai.test/v1/", apiKey: "secret", model: "model-a", fetchImpl: async (url, init) => {
    call = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiDraft) } }] }), { status: 200 });
  } });
  const result = await writer.generate({ topic: "Git", tag: "Code", language: "en" });
  assert.equal(result.title, "Title"); assert.equal(call.url, "https://ai.test/v1/chat/completions");
  assert.equal(call.body.max_tokens, 4000); assert.equal(call.body.temperature, 0.7);
  assert.equal(call.body.response_format.json_schema.name, "daily_blog_content");
  assert.equal(call.body.response_format.json_schema.strict, true);
  assert.match(call.body.messages[1].content, /Chủ đề bài viết: Git\nDanh mục\/tag: Code/);
});

test("extracts a JSON object from fallback text and sanitizes upstream HTTP errors", async () => {
  const fallback = createOpenAiBlogWriter({ baseUrl: "https://ai.test", apiKey: "secret", model: "m", fetchImpl: async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: `prefix ${JSON.stringify(aiDraft)} suffix` } }] }), { status: 200 }) });
  assert.equal((await fallback.generate({ topic: "x", tag: "y" })).title, "Title");
  const failed = createOpenAiBlogWriter({ baseUrl: "https://ai.test", apiKey: "secret", model: "m", fetchImpl: async () => new Response('{"secret":"leak"}', { status: 429 }) });
  await assert.rejects(() => failed.generate({ topic: "x", tag: "y" }), /HTTP 429/);
});
