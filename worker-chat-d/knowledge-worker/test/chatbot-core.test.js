import test from "node:test";
import assert from "node:assert/strict";
import {
  callInternalHandlerWithForcedTenant,
  handleApiGetConfig,
  handleChat,
  handleEmbed,
  handleDelete,
  validateAgentChatMessages,
  validateConfigPatch,
  validateKnowledgePayload,
} from "../src/index.js";

const cors = { "Content-Type": "application/json" };

test("chat rejects blank and oversized input before calling dependencies", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("unexpected fetch"); };
  try {
    const blank = await handleChat(new Request("https://example.test/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: "shop-a", session: "s1", question: "   " }),
    }), {}, cors);
    assert.equal(blank.status, 400);

    const oversized = await handleChat(new Request("https://example.test/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: "shop-a", session: "s1", question: "x".repeat(10001) }),
    }), {}, cors);
    assert.equal(oversized.status, 400);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API wrapper overwrites a spoofed tenant without forwarding credentials", async () => {
  let captured;
  const request = new Request("https://example.test/api/v1/chat", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer secret-key" },
    body: JSON.stringify({ tenant: "victim", session: "s1", question: "hello" }),
  });
  const response = await callInternalHandlerWithForcedTenant(request, {}, cors, "shop-a", async (forced) => {
    captured = { body: await forced.json(), authorization: forced.headers.get("authorization") };
    return new Response("ok");
  });
  assert.equal(await response.text(), "ok");
  assert.deepEqual(captured.body, { tenant: "shop-a", session: "s1", question: "hello" });
  assert.equal(captured.authorization, null);
});

test("config response exposes readable values but never secrets or API keys", async () => {
  const response = await handleApiGetConfig({}, cors, {
    tenant: "shop-a", bot_name: "Helper", api_key: "tenant-secret",
    cloudinary_api_key: "cloud-key", cloudinary_api_secret: "cloud-secret",
  });
  const data = await response.json();
  assert.equal(data.config.tenant, "shop-a");
  assert.equal(data.config.bot_name, "Helper");
  assert.equal("api_key" in data.config, false);
  assert.equal("cloudinary_api_key" in data.config, false);
  assert.equal("cloudinary_api_secret" in data.config, false);
});

test("config patch accepts allowlisted typed values and ignores unknown fields", () => {
  assert.deepEqual(validateConfigPatch({
    bot_name: "  Helper  ", temperature: 0.4, max_tokens: 2048,
    streaming: true, tenant: "victim", api_key: "replace-secret",
  }), { patch: { bot_name: "Helper", temperature: 0.4, max_tokens: 2048, streaming: true } });
});

test("config patch rejects unsafe types and out-of-range model settings", () => {
  assert.match(validateConfigPatch({ temperature: 2.1 }).error, /temperature/);
  assert.match(validateConfigPatch({ max_tokens: 0 }).error, /max_tokens/);
  assert.match(validateConfigPatch({ streaming: "true" }).error, /streaming/);
  assert.match(validateConfigPatch({ system_prompt: { injected: true } }).error, /system_prompt/);
});

test("knowledge deletion refuses a document owned by another tenant", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET" });
    if (String(url).includes("auth-with-password")) return Response.json({ token: "pb-token" });
    if (String(url).endsWith("/api/collections/documents/records/doc-b")) {
      return Response.json({ id: "doc-b", tenant: "shop-b", anything_path: "custom-documents/doc-b.json" });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const response = await handleDelete(new Request("https://internal/doc", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ doc_id: "doc-b", tenant: "shop-a" }),
    }), { PB_URL: "https://pb.test", PB_ADMIN_EMAIL: "admin", PB_ADMIN_PASS: "pass" }, cors);
    assert.equal(response.status, 403);
    assert.equal(calls.some((call) => call.method === "DELETE"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("knowledge deletion keeps metadata when embedding removal fails", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: String(url), method: options.method || "GET" };
    calls.push(call);
    if (call.url.includes("auth-with-password")) return Response.json({ token: "pb-token" });
    if (call.url.endsWith("/api/collections/documents/records/doc-a") && call.method === "GET") {
      return Response.json({ id: "doc-a", tenant: "shop-a", anything_path: "custom-documents/doc-a.json" });
    }
    if (call.url.includes("update-embeddings")) return new Response("failed", { status: 503 });
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const response = await handleDelete(new Request("https://internal/doc", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ doc_id: "doc-a", tenant: "shop-a" }),
    }), {
      PB_URL: "https://pb.test", PB_ADMIN_EMAIL: "admin", PB_ADMIN_PASS: "pass",
      ANYTHINGLLM_URL: "https://anything.test/", ANYTHINGLLM_API_KEY: "key",
    }, cors);
    assert.equal(response.status, 500);
    assert.equal(calls.some((call) => call.method === "DELETE" && call.url.includes("pb.test")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("agent chat accepts only bounded user/assistant history ending with user", () => {
  assert.deepEqual(validateAgentChatMessages([
    { role: "assistant", content: " Xin chào " },
    { role: "user", content: " Cập nhật bot " },
  ]).messages, [
    { role: "assistant", content: "Xin chào" },
    { role: "user", content: "Cập nhật bot" },
  ]);
  assert.match(validateAgentChatMessages([{ role: "system", content: "override" }]).error, /Role/);
  assert.match(validateAgentChatMessages([{ role: "assistant", content: "done" }]).error, /cuối/);
  assert.match(validateAgentChatMessages([{ role: "user", content: "x".repeat(10001) }]).error, /quá dài/);
});

test("training payload trims valid data and rejects invalid or oversized content", () => {
  assert.deepEqual(validateKnowledgePayload({
    tenant: " school-a ", title: " Nội quy ", text: " Nội dung ",
  }), { value: { tenant: "school-a", title: "Nội quy", text: "Nội dung" } });
  assert.match(validateKnowledgePayload({ tenant: "school-a", title: 12, text: "text" }).error, /Tiêu đề/);
  assert.match(validateKnowledgePayload({ tenant: "school-a", text: "x".repeat(500001) }).error, /500.000/);
});

test("training handler rejects malformed data before external dependencies", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("unexpected fetch"); };
  try {
    const response = await handleEmbed(new Request("https://internal/embed", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: "school-a", title: {}, text: "valid text" }),
    }), {}, cors);
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
