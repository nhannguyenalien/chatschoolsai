import test from "node:test";
import assert from "node:assert/strict";

// Không có YOUTUBE_CLIENT_ID/SECRET ở env: mỗi tenant tự nhập OAuth client của mình.
const env = {
  PB_URL: "https://pb.test", PB_ADMIN_EMAIL: "a@b.c", PB_ADMIN_PASS: "pw", DASHBOARD_URL: "https://dash.test", YOUTUBE_RETURN_URL: "https://dash.test",
  ALLOWED_ORIGINS: "https://dash.test", GOOGLE_OAUTH_STATE_SECRET: "state-secret"
};
const CLIENT = { client_id: "tenant-123.apps.googleusercontent.com", client_secret: "GOCSPX-tenant-secret" };

// PocketBase giả trong bộ nhớ + Google giả; ghi lại mọi thay đổi để kiểm tra.
function installFetch({ channel = { id: "UCabc", snippet: { title: "Kênh Demo" } }, refreshToken = "rt-1", records = [] } = {}) {
  const db = new Map(records.map((r) => [r.id, structuredClone(r)]));
  const log = { writes: [], googleBodies: [], schemaPatches: [] };
  const collections = Object.fromEntries(["pages_config", "post_targets"].map((name) => [name, { id: `col_${name}`, name, schema: [{ name: "platform", type: "select", options: { values: ["facebook", "wordpress"] } }] }]));
  let seq = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    if (url.includes("/system_config/records")) return Response.json({ items: [] });
    if (url.includes("auth-with-password")) return Response.json({ token: "pb-admin" });
    if (url.endsWith("/tenants/auth-refresh")) return Response.json({ record: { id: "acc1", tenant: "acme" } });
    if (url === "https://oauth2.googleapis.com/token") {
      log.googleBodies.push(String(init.body));
      return Response.json({ access_token: "at-1", ...(refreshToken ? { refresh_token: refreshToken } : {}) });
    }
    if (url.startsWith("https://www.googleapis.com/youtube/v3/channels")) return Response.json({ items: channel ? [channel] : [] });
    const col = url.match(/\/api\/collections\/(?:col_)?(pages_config|post_targets)$/);
    if (col) {
      const c = collections[col[1]];
      if (method === "GET") return Response.json(c);
      if (method === "PATCH") { Object.assign(c, JSON.parse(init.body)); log.schemaPatches.push(col[1]); return Response.json(c); }
    }
    const m = url.match(/pages_config\/records(?:\/([^?]+))?(?:\?(.*))?$/);
    if (m) {
      const [, id, query] = m;
      if (method === "GET" && id) return db.has(id) ? Response.json(db.get(id)) : new Response("{}", { status: 404 });
      if (method === "GET") {
        const filter = decodeURIComponent(new URLSearchParams(query).get("filter") || "");
        const pageId = filter.match(/page_id='([^']*)'/)?.[1];
        return Response.json({ items: [...db.values()].filter((r) => r.page_id === pageId) });
      }
      if (method === "POST") { const rec = { id: `rec${++seq}`, ...JSON.parse(init.body) }; db.set(rec.id, rec); log.writes.push({ method, rec }); return Response.json(rec); }
      if (method === "PATCH") { const rec = Object.assign(db.get(id), JSON.parse(init.body)); log.writes.push({ method, rec: structuredClone(rec) }); return Response.json(rec); }
      if (method === "DELETE") { db.delete(id); log.writes.push({ method, id }); return new Response(null, { status: 204 }); }
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  };
  return { db, log, collections, restore: () => { globalThis.fetch = original; } };
}

const { default: worker } = await import("../src/index.js");
const ctx = { waitUntil() {} };

function start(body, auth = "tok") {
  return worker.fetch(new Request("https://api.test/api/account/youtube/start", {
    method: "POST", headers: { ...(auth ? { Authorization: auth } : {}), "Content-Type": "application/json", Origin: "https://dash.test" }, body: JSON.stringify({ tenant: "acme", ...body })
  }), env, ctx);
}
const callback = (state, extra = "code=good-code") => worker.fetch(new Request(`https://api.test/api/youtube/callback?${extra}&state=${encodeURIComponent(state)}`), env, ctx);
const stateOf = async (res) => new URL((await res.json()).url).searchParams.get("state");
const outcome = (res) => new URL(res.headers.get("location")).searchParams;

// Phải chạy đầu tiên: cờ "đã migrate" của Worker nằm ở biến module nên chỉ lần start đầu mới ghi schema.
test("first connection teaches PocketBase the youtube platform (and only once)", async () => {
  const net = installFetch();
  try {
    assert.equal((await start(CLIENT)).status, 200);
    for (const name of ["pages_config", "post_targets"]) assert.ok(net.collections[name].schema[0].options.values.includes("youtube"), name);
    assert.deepEqual(net.log.schemaPatches.sort(), ["pages_config", "post_targets"]);
    await start(CLIENT);
    assert.equal(net.log.schemaPatches.length, 2, "already migrated -> no further schema writes");
  } finally { net.restore(); }
});

test("start stores the tenant's own OAuth client on a pending channel and never puts the secret in the URL", async () => {
  const net = installFetch();
  try {
    const res = await start(CLIENT);
    assert.equal(res.status, 200);
    const body = await res.json();
    const url = new URL(body.url);
    assert.equal(url.searchParams.get("client_id"), CLIENT.client_id);
    assert.equal(body.redirect_uri, "https://api.test/api/youtube/callback");
    assert.ok(!body.url.includes(CLIENT.client_secret), "secret must not travel in the URL or state");
    const pending = [...net.db.values()][0];
    assert.equal(pending.tenant, "acme");
    assert.equal(pending.is_active, false);
    assert.deepEqual(JSON.parse(pending.extra_config), CLIENT);
  } finally { net.restore(); }
});

test("start validates the client id, requires both values and a logged-in user", async () => {
  const net = installFetch();
  try {
    assert.equal((await start({ client_id: "not-google", client_secret: "x" })).status, 400);
    assert.equal((await start({ client_id: CLIENT.client_id })).status, 400);
    assert.equal((await start(CLIENT, "")).status, 401);
    assert.equal(net.db.size, 0);
  } finally { net.restore(); }
});

test("callback exchanges the code with the TENANT's client, activates the channel and returns the user to sm-config", async () => {
  const net = installFetch();
  try {
    const state = await stateOf(await start(CLIENT));
    const res = await callback(state);
    assert.equal(res.status, 302);
    assert.equal(outcome(res).get("youtube"), "connected");
    assert.match(net.log.googleBodies[0], /client_id=tenant-123\.apps\.googleusercontent\.com/);
    assert.match(net.log.googleBodies[0], /client_secret=GOCSPX-tenant-secret/);
    const [rec] = [...net.db.values()];
    assert.deepEqual([rec.page_id, rec.access_token, rec.is_active, rec.label], ["UCabc", "rt-1", true, "YouTube Kênh Demo"]);
    assert.equal(JSON.parse(rec.extra_config).client_secret, CLIENT.client_secret);
    assert.ok(!res.headers.get("location").includes("rt-1"));
  } finally { net.restore(); }
});

test("reconnecting an already-connected channel by record_id reuses stored credentials and keeps settings", async () => {
  const existing = { id: "recA", tenant: "acme", platform: "youtube", page_id: "UCabc", access_token: "old", is_active: true, extra_config: JSON.stringify({ ...CLIENT, privacy: "public", tags: ["x"] }) };
  const net = installFetch({ records: [existing], refreshToken: "rt-new" });
  try {
    const state = await stateOf(await start({ record_id: "recA" }));
    assert.equal(outcome(await callback(state)).get("youtube"), "connected");
    assert.equal(net.db.size, 1, "no duplicate channel");
    const rec = net.db.get("recA");
    assert.equal(rec.access_token, "rt-new");
    assert.deepEqual([JSON.parse(rec.extra_config).privacy, JSON.parse(rec.extra_config).tags], ["public", ["x"]]);
  } finally { net.restore(); }
});

test("connecting with new credentials a channel that already exists updates it and drops the pending record", async () => {
  const existing = { id: "recA", tenant: "acme", platform: "youtube", page_id: "UCabc", access_token: "old", is_active: true, extra_config: JSON.stringify({ privacy: "unlisted" }) };
  const net = installFetch({ records: [existing], refreshToken: "rt-new" });
  try {
    const state = await stateOf(await start(CLIENT));
    assert.equal(net.db.size, 2);
    assert.equal(outcome(await callback(state)).get("youtube"), "connected");
    assert.deepEqual([...net.db.keys()], ["recA"]);
    const extra = JSON.parse(net.db.get("recA").extra_config);
    assert.deepEqual([extra.privacy, extra.client_id], ["unlisted", CLIENT.client_id]);
  } finally { net.restore(); }
});

test("a tenant cannot start or finish a flow on another tenant's channel", async () => {
  const foreign = { id: "recX", tenant: "other-tenant", platform: "youtube", page_id: "UCx", access_token: "t", is_active: true, extra_config: JSON.stringify(CLIENT) };
  const net = installFetch({ records: [foreign] });
  try {
    assert.equal((await start({ record_id: "recX" })).status, 404);
    const { signYouTubeState } = await import("../src/integrations/youtube.js");
    const forged = await signYouTubeState(env.GOOGLE_OAUTH_STATE_SECRET, { tenant: "acme", record: "recX" });
    const res = await callback(forged);
    assert.equal(outcome(res).get("youtube"), "error");
    assert.equal(net.log.writes.length, 0);
    assert.equal(net.log.googleBodies.length, 0, "must not even talk to Google with someone else's secret");
  } finally { net.restore(); }
});

test("callback rejects a forged state and a denied consent without touching the database", async () => {
  const net = installFetch();
  try {
    assert.equal(outcome(await callback("abc.def")).get("youtube"), "error");
    assert.match(outcome(await worker.fetch(new Request("https://api.test/api/youtube/callback?error=access_denied"), env, ctx)).get("msg"), /từ chối/);
    assert.equal(net.log.writes.length, 0);
  } finally { net.restore(); }
});

test("callback explains a Google account without a YouTube channel or without a refresh token and keeps the pending record", async () => {
  let net = installFetch({ channel: null });
  try {
    assert.match(outcome(await callback(await stateOf(await start(CLIENT)))).get("msg"), /chưa có kênh YouTube/);
    assert.equal(net.db.size, 1, "pending credentials stay so the user can retry without retyping");
  } finally { net.restore(); }
  net = installFetch({ refreshToken: "" });
  try {
    const res = await callback(await stateOf(await start(CLIENT)));
    assert.match(outcome(res).get("msg"), /refresh token/);
    assert.equal([...net.db.values()][0].is_active, false);
  } finally { net.restore(); }
});

test("a tenant can bring its own uploader service (https only)", async () => {
  const net = installFetch();
  try {
    assert.equal((await start({ ...CLIENT, uploader_url: "http://plain.example.com" })).status, 400);
    assert.equal((await start({ ...CLIENT, uploader_url: "https://up.mine.example.com", uploader_secret: "s3" })).status, 200);
    const extra = JSON.parse([...net.db.values()][0].extra_config);
    assert.deepEqual([extra.uploader_url, extra.uploader_secret], ["https://up.mine.example.com", "s3"]);
  } finally { net.restore(); }
});


test("the user is sent back to the dashboard they started from, never the landing site", async () => {
  const net = installFetch();
  try {
    const res = await worker.fetch(new Request("https://api.test/api/account/youtube/start", {
      method: "POST", headers: { Authorization: "tok", "Content-Type": "application/json", Origin: "https://dash.test" }, body: JSON.stringify({ tenant: "acme", ...CLIENT })
    }), { ...env, DASHBOARD_URL: "https://landing.test", ALLOWED_ORIGINS: "https://dash.test,https://other.test" }, ctx);
    const state = await stateOf(res);
    const ok = await worker.fetch(new Request(`https://api.test/api/youtube/callback?code=good-code&state=${encodeURIComponent(state)}`), { ...env, DASHBOARD_URL: "https://landing.test" }, ctx);
    assert.equal(new URL(ok.headers.get("location")).origin, "https://dash.test");
    const denied = await worker.fetch(new Request(`https://api.test/api/youtube/callback?error=access_denied&state=${encodeURIComponent(state)}`), { ...env, DASHBOARD_URL: "https://landing.test" }, ctx);
    assert.equal(new URL(denied.headers.get("location")).origin, "https://dash.test");
  } finally { net.restore(); }
});

test("an Origin outside ALLOWED_ORIGINS cannot choose the redirect target", async () => {
  const net = installFetch();
  try {
    const res = await worker.fetch(new Request("https://api.test/api/account/youtube/start", {
      method: "POST", headers: { Authorization: "tok", "Content-Type": "application/json", Origin: "https://evil.test" }, body: JSON.stringify({ tenant: "acme", ...CLIENT })
    }), env, ctx);
    const state = await stateOf(res);
    const noFallback = { ...env, YOUTUBE_RETURN_URL: undefined };
    const done = await worker.fetch(new Request(`https://api.test/api/youtube/callback?code=good-code&state=${encodeURIComponent(state)}`), noFallback, ctx);
    assert.equal(new URL(done.headers.get("location")).origin, "https://chat.schoolsai.work");
  } finally { net.restore(); }
});

test("the customer can choose the video privacy and switch comment auto-reply off when connecting", async () => {
  const net = installFetch();
  try {
    assert.equal((await start({ ...CLIENT, privacy: "private", auto_reply: false })).status, 200);
    const extra = JSON.parse([...net.db.values()].at(-1).extra_config);
    assert.deepEqual([extra.privacy, extra.auto_reply], ["private", false]);
    // giá trị lạ bị bỏ qua (mặc định công khai nằm ở lúc đăng, không ghi vào kênh)
    net.db.clear();
    await start({ ...CLIENT, privacy: "everyone" });
    assert.equal("privacy" in JSON.parse([...net.db.values()].at(-1).extra_config), false);
  } finally { net.restore(); }
});

test("connecting a channel stamps when comment auto-reply started so old comments are never answered", async () => {
  const net = installFetch();
  try {
    const state = await stateOf(await start(CLIENT));
    await callback(state);
    const rec = [...net.db.values()][0];
    const since = JSON.parse(rec.extra_config).auto_reply_since;
    assert.ok(Date.parse(since) > Date.now() - 10_000 && Date.parse(since) <= Date.now());
    // kết nối lại không làm mốc lùi về sau
    const again = await stateOf(await start({ record_id: rec.id }));
    await callback(again);
    assert.equal(JSON.parse(net.db.get(rec.id).extra_config).auto_reply_since, since);
  } finally { net.restore(); }
});
