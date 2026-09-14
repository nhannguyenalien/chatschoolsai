import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeMessageQuota,
  createMeteredAiFetch,
  recordAiUsage,
} from "../src/index.js";

const env = {
  PB_URL: "https://pb.test",
  OPENAI_BASE_URL: "https://openai.test/v1",
  GEMINI_BASE_URL: "https://gemini.test/v1",
  ANYTHINGLLM_URL: "https://anything.test",
};

test("usage reset and increment use separate atomic billing updates", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || "GET", body: options.body });
    if ((options.method || "GET") === "GET") {
      return Response.json({
        items: [{ id: "tenant-1", tenant: "shop-a", message_used: 99, message_limit: 100, last_reset_month: "2000-01" }],
      });
    }
    return Response.json({ id: "tenant-1" });
  };

  try {
    await recordAiUsage(env, "shop-a", 2, "Bearer pb-token");
    const patches = requests.filter((request) => request.method === "PATCH").map((request) => JSON.parse(request.body));
    const currentMonth = new Date().toISOString().slice(0, 7);
    assert.deepEqual(patches, [
      { message_used: 0, last_reset_month: currentMonth },
      { "message_used+": 2 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("metered AI fetch bills successful provider calls only", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, method: options.method || "GET", body: options.body });
    if (target === "https://openai.test/v1/chat/completions") return Response.json({ choices: [] });
    if (target === "https://openai.test/v1/failing") return new Response("provider error", { status: 500 });
    if (target.startsWith("https://pb.test/api/collections/tenants/records?")) {
      return Response.json({
        items: [{ id: "tenant-1", tenant: "shop-a", message_used: 4, message_limit: 100, last_reset_month: new Date().toISOString().slice(0, 7) }],
      });
    }
    if (target === "https://pb.test/api/collections/tenants/records/tenant-1") return Response.json({ id: "tenant-1" });
    if (target === "https://pb.test/unrelated") return Response.json({ ok: true });
    throw new Error(`unexpected fetch ${target}`);
  };

  try {
    const meteredFetch = createMeteredAiFetch(env, "shop-a", "Bearer pb-token");
    assert.equal((await meteredFetch("https://openai.test/v1/chat/completions", { method: "POST" })).status, 200);
    assert.equal((await meteredFetch("https://openai.test/v1/failing", { method: "POST" })).status, 500);
    assert.equal((await meteredFetch("https://pb.test/unrelated")).status, 200);

    const increments = calls
      .filter((call) => call.target.endsWith("/api/collections/tenants/records/tenant-1"))
      .map((call) => JSON.parse(call.body));
    assert.deepEqual(increments, [{ "message_used+": 1 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parallel usage writes cannot overwrite each other with stale totals", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, options = {}) => {
    bodies.push(JSON.parse(options.body));
    return Response.json({ id: "tenant-1" });
  };

  try {
    const record = { id: "tenant-1", message_used: 7 };
    await Promise.all([
      consumeMessageQuota(env, "Bearer pb-token", record),
      consumeMessageQuota(env, "Bearer pb-token", record),
    ]);
    assert.deepEqual(bodies, [{ "message_used+": 1 }, { "message_used+": 1 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
