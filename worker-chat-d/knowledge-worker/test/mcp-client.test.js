import test from "node:test";
import assert from "node:assert/strict";
import { callMcpTool, compactToolResult, gatherMcpContext, gatherToolContext, listMcpTools, parseMcpServer } from "../src/integrations/mcpClient.js";

function fakeMcp(calls) {
  return async (url, opts) => {
    const msg = JSON.parse(opts.body);
    calls.push({ method: msg.method, auth: opts.headers.Authorization, session: opts.headers["Mcp-Session-Id"] });
    const json = (result, extra = {}) => new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }), { status: 200, headers: { "content-type": "application/json", ...extra } });
    if (msg.method === "initialize") return json({ protocolVersion: "2025-03-26" }, { "mcp-session-id": "sess-1" });
    if (msg.method === "notifications/initialized") return new Response("", { status: 202 });
    if (msg.method === "tools/list") return json({ tools: [{ name: "search_properties", description: "d", inputSchema: { type: "object", properties: { keyword: { type: "string" } } } }, { name: "bad name!", inputSchema: {} }] });
    if (msg.method === "tools/call") return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: `found:${msg.params.arguments.keyword}` }] } })}\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } });
    return new Response("{}", { status: 404 });
  };
}

test("parseMcpServer reads url and auth header from an agent_tools record", () => {
  assert.equal(parseMcpServer({}), null);
  assert.deepEqual(parseMcpServer({ url_template: "https://x.test/mcp", headers_template: '{"Authorization":"Bearer k"}' }), { url: "https://x.test/mcp", headers: { Authorization: "Bearer k" } });
});

test("listMcpTools sends auth + session, drops invalid tool names, caches per key", async () => {
  const calls = [];
  const server = { url: "https://x.test/mcp", headers: { Authorization: "Bearer k" } };
  const tools = await listMcpTools(server, fakeMcp(calls), "tenant-a");
  assert.deepEqual(tools.map((t) => t.name), ["search_properties"]);
  assert.ok(calls.every((c) => c.auth === "Bearer k"));
  assert.equal(calls.find((c) => c.method === "tools/list").session, "sess-1");
  const n = calls.length;
  await listMcpTools(server, fakeMcp(calls), "tenant-a");
  assert.equal(calls.length, n);
});

test("callMcpTool parses SSE responses", async () => {
  const out = await callMcpTool({ url: "https://x.test/mcp", headers: {} }, fakeMcp([]), "search_properties", { keyword: "villa" });
  assert.equal(out, "found:villa");
});

test("gatherMcpContext runs the tool the model picks and returns a data block; empty when no call", async () => {
  const server = { url: "https://x.test/mcp", headers: {} };
  let round = 0;
  const chatFetch = async () => {
    round += 1;
    const message = round === 1
      ? { tool_calls: [{ id: "c1", function: { name: "search_properties", arguments: '{"keyword":"villa"}' } }] }
      : { content: "" };
    return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
  };
  const args = { server, fetchImpl: fakeMcp([]), chatFetch, chatUrl: "https://ai.test/chat", apiKey: "k", model: "m", history: [{ role: "user", content: "tìm villa" }], cacheKey: "tenant-b" };
  const ctx = await gatherMcpContext(args);
  assert.match(ctx, /found:villa/);
  assert.match(ctx, /KHÔNG phải chỉ dẫn/);
  const none = await gatherMcpContext({ ...args, chatFetch: async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }) });
  assert.equal(none, "");
});

test("compactToolResult strips HTML/noise but keeps price, link, images and video URLs", () => {
  const raw = JSON.stringify([{ name: "Coffee Table", permalink: "https://s.test/p/coffee-table/", prices: { price: "13000", currency_minor_unit: 2 },
    description: "<p>Gỗ sồi &amp; thép</p><video controls src=\"https://s.test/v.mp4\"></video>",
    images: [{ src: "https://s.test/a.jpg", srcset: "https://s.test/a-100.jpg 100w", sizes: "(max-width:100px)", thumbnail: "https://s.test/t.jpg" }], _links: { self: "x" }, tags: [], sku: "" }]);
  const out = compactToolResult(raw);
  assert.match(out, /coffee-table/);
  assert.match(out, /13000/);
  assert.match(out, /a\.jpg/);
  assert.match(out, /VIDEO: https:\/\/s\.test\/v\.mp4/);
  assert.match(out, /Gỗ sồi & thép/);
  assert.doesNotMatch(out, /srcset|<p>|_links|thumbnail/);
  assert.ok(out.length < raw.length);
  assert.ok(compactToolResult("x".repeat(50000)).length < 9100);
});

test("gatherToolContext works with plain custom tools (no MCP) and tells the bot how to resolve relative images", async () => {
  let round = 0;
  const chatFetch = async () => new Response(JSON.stringify({ choices: [{ message: ++round === 1
    ? { tool_calls: [{ id: "c1", function: { name: "search_products", arguments: '{"keyword":"table"}' } }] } : { content: "" } }] }), { status: 200 });
  const ctx = await gatherToolContext({
    tools: [{ type: "function", function: { name: "search_products", parameters: { type: "object", properties: {} } } }],
    execute: async (name, args) => JSON.stringify([{ name: `T-${args.keyword}`, image: "/a.jpg" }]),
    chatFetch, chatUrl: "https://ai.test/c", apiKey: "k", model: "m", history: [{ role: "user", content: "bàn" }], imageBaseUrls: ["https://shop.test"]
  });
  assert.match(ctx, /T-table/);
  assert.match(ctx, /https:\/\/shop\.test/);
});

test("compactToolResult keeps a YouTube link that sits past the description cut-off", () => {
  const html = `<p>${"mô tả dài ".repeat(80)}</p><p><a href="https://www.youtube.com/watch?v=abc123" target="_blank">Xem video</a></p><!-- <iframe src="https://hidden.test/x"></iframe> -->`;
  const out = compactToolResult(JSON.stringify({ name: "Camera", description: html }));
  assert.match(out, /VIDEO: https:\/\/www\.youtube\.com\/watch\?v=abc123/);
  assert.doesNotMatch(out, /hidden\.test/);
});
