import { mapGoogleAnalytics4Response } from "../adapters/analytics/googleAnalytics4.js";
import { importPerformance } from "../workflows/importPerformance.js";

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function encodeState(secret, payload) {
  const encoded = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(secret, encoded)}`;
}

async function decodeState(secret, state) {
  const [encoded, signature] = String(state || "").split(".");
  if (!encoded || !signature || await hmac(secret, encoded) !== signature) throw new Error("Google OAuth state is invalid.");
  const payload = JSON.parse(new TextDecoder().decode(fromBase64url(encoded)));
  if (!payload.exp || payload.exp < Date.now()) throw new Error("Google OAuth state has expired.");
  return payload;
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptJson(secret, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), new TextEncoder().encode(JSON.stringify(value)));
  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

async function decryptJson(secret, value) {
  const [iv, ciphertext] = String(value || "").split(".");
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(iv) }, await encryptionKey(secret), fromBase64url(ciphertext));
  return JSON.parse(new TextDecoder().decode(clear));
}

async function googleJson(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || body.error_description || `Google API HTTP ${response.status}`);
  return body;
}

function gscRows(response, dimensions) {
  return (response.rows || []).map((row) => ({
    dimensions: Object.fromEntries(dimensions.map((name, index) => [name, row.keys?.[index] || ""])),
    clicks: Number(row.clicks || 0), impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0), position: Number(row.position || 0),
  }));
}

function ga4Rows(response) {
  const dimensions = (response.dimensionHeaders || []).map((header) => header.name);
  const metrics = (response.metricHeaders || []).map((header) => header.name);
  return (response.rows || []).map((row) => ({
    dimensions: Object.fromEntries(dimensions.map((name, index) => [name, row.dimensionValues?.[index]?.value || ""])),
    metrics: Object.fromEntries(metrics.map((name, index) => [name, Number(row.metricValues?.[index]?.value || 0)])),
  }));
}

export function createGoogleAnalyticsIntegration({ repository, redirectUri, stateSecret, tokenEncryptionKey, fetchImpl = fetch }) {
  const serverConfigured = Boolean(redirectUri && stateSecret && tokenEncryptionKey);
  function requireServerConfig() { if (!serverConfigured) throw new Error("Google OAuth encryption is not configured on the server."); }

  async function clientCredentials(connection) {
    if (!connection?.oauth_client_encrypted) throw new Error("Configure a Google OAuth client for this site first.");
    const value = await decryptJson(tokenEncryptionKey, connection.oauth_client_encrypted);
    if (!value.client_id || !value.client_secret) throw new Error("The Google OAuth client for this site is incomplete.");
    return value;
  }

  async function accessToken(connection) {
    const { client_id: clientId, client_secret: clientSecret } = await clientCredentials(connection);
    const credentials = await decryptJson(tokenEncryptionKey, connection.credentials_encrypted);
    if (credentials.access_token && Number(credentials.expires_at || 0) > Date.now() + 60_000) return credentials.access_token;
    if (!credentials.refresh_token) throw new Error("Google refresh token is missing; reconnect Google.");
    const refreshed = await googleJson(fetchImpl, "https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: credentials.refresh_token, grant_type: "refresh_token" }),
    });
    const next = { ...credentials, ...refreshed, expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000 };
    await repository.updateAnalyticsConnection(connection.id, { credentials_encrypted: await encryptJson(tokenEncryptionKey, next), status: "connected", last_error: "" });
    return next.access_token;
  }

  async function selectedProperties(connection) {
    let embedded = {};
    if (connection?.credentials_encrypted) {
      const credentials = await decryptJson(tokenEncryptionKey, connection.credentials_encrypted);
      embedded = credentials._selection || {};
    }
    return {
      ga4Property: connection?.ga4_property || embedded.ga4Property || "",
      searchConsoleSite: connection?.gsc_site || embedded.searchConsoleSite || "",
    };
  }

  return {
    isConfigured: () => serverConfigured,
    async configure({ tenant, siteId, clientId, clientSecret }) {
      requireServerConfig(); await repository.assertSiteOwned(tenant, siteId);
      if (!String(clientId || "").endsWith(".apps.googleusercontent.com")) throw new Error("Google OAuth client ID is invalid.");
      if (!String(clientSecret || "").trim()) throw new Error("Google OAuth client secret is required.");
      const existing = await repository.findAnalyticsConnection(tenant, siteId);
      const patch = {
        tenant, site_id: siteId, provider: "google", status: existing?.credentials_encrypted ? existing.status : "revoked",
        oauth_client_encrypted: await encryptJson(tokenEncryptionKey, { client_id: String(clientId).trim(), client_secret: String(clientSecret).trim() }),
        scopes_json: JSON.stringify(SCOPES), last_error: "",
      };
      return existing ? repository.updateAnalyticsConnection(existing.id, patch) : repository.createAnalyticsConnection(patch);
    },
    async start({ tenant, siteId }) {
      requireServerConfig();
      await repository.assertSiteOwned(tenant, siteId);
      const connection = await repository.findAnalyticsConnection(tenant, siteId);
      const { client_id: clientId } = await clientCredentials(connection);
      const state = await encodeState(stateSecret, { tenant, siteId, exp: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() });
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: SCOPES.join(" "), access_type: "offline", include_granted_scopes: "true", prompt: "consent", state });
      return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state };
    },
    async complete({ tenant, code, state }) {
      requireServerConfig();
      if (!code) throw new Error("Google OAuth authorization code is required.");
      const payload = await decodeState(stateSecret, state);
      if (payload.tenant !== tenant) throw new Error("Google OAuth tenant mismatch.");
      await repository.assertSiteOwned(tenant, payload.siteId);
      const existing = await repository.findAnalyticsConnection(tenant, payload.siteId);
      const { client_id: clientId, client_secret: clientSecret } = await clientCredentials(existing);
      const token = await googleJson(fetchImpl, "https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });
      token.expires_at = Date.now() + Number(token.expires_in || 3600) * 1000;
      if (!token.refresh_token && existing?.credentials_encrypted) {
        const previous = await decryptJson(tokenEncryptionKey, existing.credentials_encrypted);
        token.refresh_token = previous.refresh_token;
      }
      const record = { tenant, site_id: payload.siteId, provider: "google", status: "connected", credentials_encrypted: await encryptJson(tokenEncryptionKey, token), scopes_json: JSON.stringify(SCOPES), last_error: "" };
      return existing ? repository.updateAnalyticsConnection(existing.id, record) : repository.createAnalyticsConnection(record);
    },
    async status({ tenant, siteId }) {
      await repository.assertSiteOwned(tenant, siteId);
      if (!serverConfigured) return { configured: false, connected: false };
      const connection = await repository.findAnalyticsConnection(tenant, siteId);
      if (!connection?.oauth_client_encrypted) return { configured: false, connected: false };
      const selected = await selectedProperties(connection);
      return { configured: true, connected: connection.status === "connected", ...selected, lastSyncedAt: connection.last_synced_at || "", lastError: connection.last_error || "" };
    },
    async properties({ tenant, siteId }) {
      requireServerConfig(); await repository.assertSiteOwned(tenant, siteId);
      const connection = await repository.findAnalyticsConnection(tenant, siteId);
      if (!connection) throw new Error("Google is not connected for this site.");
      const token = await accessToken(connection); const headers = { Authorization: `Bearer ${token}` };
      const [admin, search] = await Promise.all([
        googleJson(fetchImpl, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", { headers }),
        googleJson(fetchImpl, "https://www.googleapis.com/webmasters/v3/sites", { headers }),
      ]);
      return {
        ga4: (admin.accountSummaries || []).flatMap((account) => (account.propertySummaries || []).map((property) => ({ id: property.property, name: property.displayName, account: account.displayName }))),
        searchConsole: (search.siteEntry || []).map((site) => ({ id: site.siteUrl, permissionLevel: site.permissionLevel })),
        selected: await selectedProperties(connection),
      };
    },
    async select({ tenant, siteId, ga4Property, searchConsoleSite }) {
      requireServerConfig(); await repository.assertSiteOwned(tenant, siteId);
      const connection = await repository.findAnalyticsConnection(tenant, siteId);
      if (!connection) throw new Error("Google is not connected for this site.");
      const selection = { ga4Property: String(ga4Property || ""), searchConsoleSite: String(searchConsoleSite || "") };
      const credentials = await decryptJson(tokenEncryptionKey, connection.credentials_encrypted);
      return repository.updateAnalyticsConnection(connection.id, {
        ga4_property: selection.ga4Property,
        gsc_site: selection.searchConsoleSite,
        credentials_encrypted: await encryptJson(tokenEncryptionKey, { ...credentials, _selection: selection }),
      });
    },
    async research({ tenant, siteId, startDate, endDate, limit = 100 }) {
      requireServerConfig(); await repository.assertSiteOwned(tenant, siteId);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "") || startDate > endDate) {
        throw new Error("startDate and endDate must be a valid YYYY-MM-DD range.");
      }
      const rowLimit = Math.max(1, Math.min(250, Number(limit) || 100));
      const connection = await repository.findAnalyticsConnection(tenant, siteId);
      if (!connection) throw new Error("Google is not connected for this site.");
      const selected = await selectedProperties(connection);
      if (!selected.ga4Property && !selected.searchConsoleSite) throw new Error("Select at least one GA4 or Search Console property first.");
      const token = await accessToken(connection);
      const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
      const result = { siteId, startDate, endDate, generatedAt: new Date().toISOString(), selected, searchConsole: null, ga4: null };

      if (selected.searchConsoleSite) {
        const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(selected.searchConsoleSite)}/searchAnalytics/query`;
        const run = (dimensions, extra = {}) => googleJson(fetchImpl, endpoint, {
          method: "POST", headers, body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, dataState: "all", ...extra }),
        });
        const [summary, trend, queries, pages, queryPages, countries, devices] = await Promise.all([
          run([]), run(["date"]), run(["query"]), run(["page"]), run(["query", "page"]), run(["country"]), run(["device"]),
        ]);
        result.searchConsole = {
          summary: gscRows(summary, [])[0] || { dimensions: {}, clicks: 0, impressions: 0, ctr: 0, position: 0 },
          trend: gscRows(trend, ["date"]), topQueries: gscRows(queries, ["query"]), topPages: gscRows(pages, ["page"]),
          queryPageOpportunities: gscRows(queryPages, ["query", "page"]), countries: gscRows(countries, ["country"]), devices: gscRows(devices, ["device"]),
        };
      }

      if (selected.ga4Property) {
        const endpoint = `https://analyticsdata.googleapis.com/v1beta/${selected.ga4Property}:runReport`;
        const metrics = ["sessions", "totalUsers", "newUsers", "engagedSessions", "engagementRate", "averageSessionDuration", "screenPageViews", "eventCount", "keyEvents"];
        const run = (dimensions = []) => googleJson(fetchImpl, endpoint, {
          method: "POST", headers, body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), limit: String(rowLimit) }),
        });
        const [summary, trend, landingPages, channels, countries, devices] = await Promise.all([
          run(), run(["date"]), run(["landingPagePlusQueryString"]), run(["sessionDefaultChannelGroup"]), run(["country"]), run(["deviceCategory"]),
        ]);
        result.ga4 = {
          summary: ga4Rows(summary)[0] || { dimensions: {}, metrics: {} }, trend: ga4Rows(trend), landingPages: ga4Rows(landingPages),
          channels: ga4Rows(channels), countries: ga4Rows(countries), devices: ga4Rows(devices),
        };
      }
      return result;
    },
    async sync({ tenant, siteId, startDate, endDate }) {
      requireServerConfig(); await repository.assertSiteOwned(tenant, siteId);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "") || startDate > endDate) {
        throw new Error("startDate and endDate must be a valid YYYY-MM-DD range.");
      }
      const connection = await repository.findAnalyticsConnection(tenant, siteId);
      if (!connection) throw new Error("Google is not connected for this site.");
      const token = await accessToken(connection); const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
      const selected = await selectedProperties(connection);
      const snapshots = [];
      if (!selected.ga4Property && !selected.searchConsoleSite) throw new Error("Select at least one GA4 or Search Console property before syncing.");
      if (selected.searchConsoleSite) {
        // The dashboard consumes site-wide totals. Asking Google for every page can
        // produce thousands of rows and one PocketBase request per row, exceeding
        // Cloudflare Worker's subrequest limit. A dimensionless query returns the
        // same exact site-wide totals as a single snapshot.
        const response = await googleJson(fetchImpl, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(selected.searchConsoleSite)}/searchAnalytics/query`, { method: "POST", headers, body: JSON.stringify({ startDate, endDate }) });
        const total = response.rows?.[0];
        if (total) {
          snapshots.push({
            source: "gsc", externalKey: selected.searchConsoleSite, url: selected.searchConsoleSite,
            windowStart: startDate, windowEnd: endDate,
            metrics: { clicks: total.clicks, impressions: total.impressions, ctr: total.ctr, position: total.position },
            dimensions: { site: selected.searchConsoleSite },
          });
        }
      }
      if (selected.ga4Property) {
        const response = await googleJson(fetchImpl, `https://analyticsdata.googleapis.com/v1beta/${selected.ga4Property}:runReport`, { method: "POST", headers, body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: [{ name: "pageLocation" }], metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "conversions" }], limit: "10000" }) });
        snapshots.push(...mapGoogleAnalytics4Response({ response: { ...response, rows: response.rows || [] }, windowStart: startDate, windowEnd: endDate }));
      }
      const result = snapshots.length
        ? await importPerformance({ repository, tenant, siteId, snapshots })
        : { imported: 0, duplicates: 0, results: [] };
      await repository.updateAnalyticsConnection(connection.id, { last_synced_at: new Date().toISOString(), last_error: "", status: "connected" });
      return { ...result, fetched: snapshots.length };
    },
  };
}
