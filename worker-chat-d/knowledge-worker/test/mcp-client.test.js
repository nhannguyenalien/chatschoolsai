import test from "node:test";
import assert from "node:assert/strict";
import { callMcpTool, gatherMcpContext, listMcpTools, parseMcpServer } from "../src/integrations/mcpClient.js";

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
