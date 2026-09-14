import test from "node:test";
import assert from "node:assert/strict";
import { createFacebookInsightsIntegration } from "../src/integrations/facebookInsights.js";

const repository = {
  listFacebookPages: async () => [{ id: "config-1", page_id: "123", label: "Today Hoc", access_token: "page-token" }],
};

test("Facebook research aggregates page and post insights", async () => {
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.includes("/123/insights?")) return { ok: true, json: async () => ({ data: [{ name: "page_impressions", values: [{ value: 10, end_time: "2026-09-01" }, { value: 20, end_time: "2026-09-02" }] }] }) };
    if (value.includes("/123/posts?")) return { ok: true, json: async () => ({ data: [{ id: "post-1", message: "Hello", insights: { data: [{ name: "post_clicks", values: [{ value: 4 }] }] } }] }) };
    return { ok: true, json: async () => ({ id: "123", name: "Today Hoc", followers_count: 99 }) };
  };
  const integration = createFacebookInsightsIntegration({ repository, fetchImpl });
  const result = await integration.research({ tenant: "t1", since: "2026-09-01", until: "2026-09-02" });
  assert.equal(result.pages[0].profile.followers_count, 99);
  assert.equal(result.pages[0].summary.page_impressions, 30);
  assert.equal(result.pages[0].posts[0].metrics.post_clicks, 4);
});

test("Facebook research preserves partial data when one insights request fails", async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes("/insights?")) return { ok: false, status: 400, json: async () => ({ error: { message: "Missing read_insights", code: 200 } }) };
    return { ok: true, json: async () => ({ id: "123", name: "Today Hoc", data: [] }) };
  };
  const result = await createFacebookInsightsIntegration({ repository, fetchImpl }).research({ tenant: "t1", since: "2026-09-01", until: "2026-09-02" });
  assert.equal(result.pages[0].profile.name, "Today Hoc");
  assert.match(result.pages[0].warnings[0], /read_insights/);
});

test("Facebook research validates its date range", async () => {
  await assert.rejects(() => createFacebookInsightsIntegration({ repository }).research({ tenant: "t1", since: "bad", until: "2026-09-02" }), /valid YYYY-MM-DD range/);
});
