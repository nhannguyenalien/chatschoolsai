import test from "node:test";
import assert from "node:assert/strict";
import { createSanityHistoryAdapter, SanityHistoryConfigurationError } from "../src/adapters/sanity/history.js";

test("reads original Skillgo blog titles from the configured Sanity dataset", async () => {
  let request;
  const adapter = createSanityHistoryAdapter({ fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ result: [{ title: "Existing post" }, { title: " " }, {}] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } });
  const result = await adapter.listHistoricalTopics({ platform: "sanity", page_id: "project-1:production", access_token: "secret" });
  assert.deepEqual(result, [{ title: "Existing post", source: "legacy-sanity" }]);
  const url = new URL(request.url);
  assert.equal(url.hostname, "project-1.api.sanity.io");
  assert.equal(url.pathname, "/v2021-06-07/data/query/production");
  assert.match(url.searchParams.get("query"), /!defined\(translationOf\)/);
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  assert.doesNotMatch(request.url, /secret/);
});

test("does not query Sanity for another CMS", async () => {
  const adapter = createSanityHistoryAdapter({ fetchImpl: async () => { throw new Error("should not fetch"); } });
  assert.equal(adapter.supports({ platform: "wordpress" }), false);
  assert.deepEqual(await adapter.listHistoricalTopics({ platform: "wordpress" }), []);
});

test("rejects unsafe Sanity targets before making a request", async () => {
  let fetched = false;
  const adapter = createSanityHistoryAdapter({ fetchImpl: async () => { fetched = true; } });
  await assert.rejects(
    () => adapter.listHistoricalTopics({ platform: "sanity", page_id: "bad.example.com:production" }),
    SanityHistoryConfigurationError,
  );
  assert.equal(fetched, false);
});

test("fails closed when Sanity history is unavailable", async () => {
  const adapter = createSanityHistoryAdapter({ fetchImpl: async () => new Response(JSON.stringify({ error: { description: "dataset unavailable" } }), { status: 503 }) });
  await assert.rejects(
    () => adapter.listHistoricalTopics({ platform: "sanity", page_id: "project:production" }),
    /dataset unavailable/,
  );
});
