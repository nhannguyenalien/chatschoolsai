import assert from "node:assert/strict";
import test from "node:test";

import { workspaceTemperature } from "../src/index.js";

const env = { ANYTHINGLLM_URL: "https://llm.example/", ANYTHINGLLM_API_KEY: "test" };

function mockSystemModel(model) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ settings: { LLMModel: model } }));
  };
  return { calls: () => calls, restore: () => { globalThis.fetch = original; } };
}

test("forces temperature 1 when the workspace pins a luna model", async () => {
  assert.equal(await workspaceTemperature(env, { chatModel: "gpt-6-luna" }, 0.3), 1);
});

test("keeps the configured temperature for a workspace pinned to another model", async () => {
  assert.equal(await workspaceTemperature(env, { chatModel: "gpt-4o-mini" }, "0.3"), 0.3);
});

test("uses the AnythingLLM default model when the workspace has none, and caches it", async () => {
  const mock = mockSystemModel("gpt-6-luna");
  try {
    assert.equal(await workspaceTemperature(env, { chatModel: null }, 0.7), 1);
    assert.equal(await workspaceTemperature(env, null, 0.1), 1);
    assert.equal(mock.calls(), 1);
  } finally {
    mock.restore();
  }
});
