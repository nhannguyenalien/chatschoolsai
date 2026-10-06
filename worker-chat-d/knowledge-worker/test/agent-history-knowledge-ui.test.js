import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  handleApiAgentChatHistory,
  handleApiSaveAgentChatHistory,
  handleChat,
  handlePublicChatKnowledge
} from "../src/index.js";

const cors = { "Content-Type": "application/json" };

test("public knowledge endpoint rejects an invalid tenant before querying PocketBase", async () => {
  const response = await handlePublicChatKnowledge(
    new Request("https://example.test/chat/knowledge?tenant=not%20valid"),
    {},
    cors
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid tenant" });
});

test("agent history endpoint rejects malformed messages before writing", async () => {
  const response = await handleApiSaveAgentChatHistory(
    new Request("https://example.test/api/v1/agent-chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "system", content: "not allowed" })
    }),
    {},
    cors,
    { tenant: "nhantin" }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Tin nhắn lịch sử không hợp lệ" });
});

test("chat rejects an invalid tenant before calling PocketBase", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("unexpected fetch"); };
  try {
    const response = await handleChat(new Request("https://example.test/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: "bad tenant", session: "s1", question: "hello" })
    }), {}, cors);
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("agent history degrades to an empty list when an old PocketBase schema cannot be listed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("auth-with-password")) return Response.json({ token: "pb-token" });
    return new Response(JSON.stringify({ message: "Failed to list records" }), { status: 400 });
  };
  try {
    const response = await handleApiAgentChatHistory(
      new Request("https://example.test/api/v1/agent-chat/history?page=1"),
      { PB_URL: "https://pb.test", PB_ADMIN_EMAIL: "admin", PB_ADMIN_PASS: "pass" },
      cors,
      { tenant: "nhantin" }
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.degraded, true);
    assert.deepEqual(data.items, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("agent chat persists and reloads history through the workspace API", async () => {
  const html = await readFile(new URL("../../../dash-tabler/agent-chat.html", import.meta.url), "utf8");

  assert.match(html, /\/api\/v1\/agent-chat\/history/);
  assert.doesNotMatch(html, /PB\.collection\(["']agent_chat_messages["']\)/);
});

test("level-one chatbot lists bot knowledge separately from session uploads", async () => {
  const html = await readFile(new URL("../../../dash-tabler/chat.html", import.meta.url), "utf8");

  assert.match(html, /\/chat\/knowledge\?tenant=/);
  assert.match(html, /cache:\s*["']no-store["']/);
  assert.match(html, /finally\s*\{/);
  assert.match(html, /Knowledge Base/);
  assert.match(html, /collection\(["']tai_lieu["']\)/);
});
