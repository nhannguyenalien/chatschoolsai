import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createGoogleAnalyticsIntegration } from "../src/integrations/googleAnalytics.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function repository() {
  let connection = null;
  return {
    assertSiteOwned: async () => true,
    findAnalyticsConnection: async () => connection,
    createAnalyticsConnection: async value => (connection = { id: "connection-1", ...value }),
    updateAnalyticsConnection: async (id, patch) => (connection = { ...connection, id, ...patch }),
  };
}

test("reports server OAuth configuration without exposing secrets", async () => {
  const integration = createGoogleAnalyticsIntegration({ repository: repository() });
  assert.deepEqual(await integration.status({ tenant: "t1", siteId: "s1" }), { configured: false, connected: false });
});

test("creates a signed Google authorization URL", async () => {
  const repo = repository();
  const integration = createGoogleAnalyticsIntegration({ repository: repo, redirectUri:"https://app.example/analytics", stateSecret:"state-secret", tokenEncryptionKey:"token-secret" });
  await integration.configure({ tenant:"t1", siteId:"s1", clientId:"client.apps.googleusercontent.com", clientSecret:"secret" });
  const result = await integration.start({ tenant:"t1", siteId:"s1" });
  const url = new URL(result.authorizationUrl);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.match(url.searchParams.get("scope"), /analytics\.readonly/);
  assert.match(url.searchParams.get("scope"), /webmasters\.readonly/);
});

test("rejects invalid sync date ranges before calling Google", async () => {
  const repo = repository();
  const integration = createGoogleAnalyticsIntegration({ repository: repo, redirectUri:"https://app.example/analytics", stateSecret:"state-secret", tokenEncryptionKey:"token-secret" });
  await integration.configure({ tenant:"t1", siteId:"s1", clientId:"client.apps.googleusercontent.com", clientSecret:"secret" });
  await assert.rejects(() => integration.sync({ tenant:"t1", siteId:"s1", startDate:"bad", endDate:"2026-09-01" }), /valid YYYY-MM-DD range/);
});

test("research returns bounded strategic Search Console datasets", async () => {
  const repo = repository();
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("oauth2.googleapis.com/token")) return { ok: true, json: async () => ({ access_token: "token", expires_in: 3600 }) };
    const body = JSON.parse(init.body || "{}");
    const keys = (body.dimensions || []).map((name) => name === "date" ? "2026-09-01" : `${name}-value`);
    return { ok: true, json: async () => ({ rows: [{ keys, clicks: 5, impressions: 100, ctr: .05, position: 8 }] }) };
  };
  const integration = createGoogleAnalyticsIntegration({ repository: repo, redirectUri:"https://app.example/analytics", stateSecret:"state-secret", tokenEncryptionKey:"token-secret", fetchImpl });
  await integration.configure({ tenant:"t1", siteId:"s1", clientId:"client.apps.googleusercontent.com", clientSecret:"secret" });
  const connection = await integration.complete({ tenant:"t1", code:"code", state:(await integration.start({ tenant:"t1", siteId:"s1" })).state });
  await repo.updateAnalyticsConnection(connection.id, { gsc_site: "https://example.com/" });
  const result = await integration.research({ tenant:"t1", siteId:"s1", startDate:"2026-08-01", endDate:"2026-09-01", limit:999 });
  assert.equal(result.searchConsole.summary.clicks, 5);
  assert.equal(result.searchConsole.topQueries[0].dimensions.query, "query-value");
  assert.equal(result.searchConsole.queryPageOpportunities[0].dimensions.page, "page-value");
});
