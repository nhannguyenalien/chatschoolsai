import test from "node:test";
import assert from "node:assert/strict";
import { privacyNote, signYouTubeState, verifyYouTubeState, youtubeAuthUrl, buildYouTubeMetadata, publishToYouTube, googleApiError, youtubeSettings } from "../src/integrations/youtube.js";
import { classifyPublishError } from "../src/domain/publishing/retryPolicy.js";
import { checkTargetPreflight } from "../src/domain/publishing/preflight.js";

// Mỗi tenant tự nhập OAuth client + uploader trong extra_config của kênh; env chỉ là giá trị dự phòng chung.
const env = {};
const page = { platform: "youtube", page_id: "UC123", access_token: "refresh-tok", extra_config: JSON.stringify({ client_id: "cid.apps.googleusercontent.com", client_secret: "csecret", uploader_url: "https://up.example.com/", uploader_secret: "usecret" }) };
const post = { title: "Video <đầu> tiên", content: "Mô tả <b>video</b>" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("OAuth state is signed, scoped to youtube and expires", async () => {
  const state = await signYouTubeState("s3cret", { tenant: "acme" }, 1000);
  assert.equal((await verifyYouTubeState("s3cret", state, 2000)).tenant, "acme");
  await assert.rejects(() => verifyYouTubeState("other", state, 2000), /không hợp lệ/);
  await assert.rejects(() => verifyYouTubeState("s3cret", state, 1000 + 11 * 60 * 1000), /hết hạn/);
  const [body, sig] = state.split(".");
  const forged = btoa(JSON.stringify({ tenant: "evil", purpose: "youtube", exp: 9e15 })).replace(/=+$/, "");
  await assert.rejects(() => verifyYouTubeState("s3cret", `${forged}.${sig}`, 2000), /không hợp lệ/);
  assert.ok(body);
});

test("authorization URL asks for offline upload access", () => {
  const url = new URL(youtubeAuthUrl({ clientId: "cid", redirectUri: "https://api/cb", state: "st" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.match(url.searchParams.get("scope"), /youtube\.upload/);
  assert.equal(url.searchParams.get("state"), "st");
});

test("metadata defaults to public (customer can choose private), strips angle brackets and clamps title", () => {
  const m = buildYouTubeMetadata({ extra_config: "" }, { title: "x".repeat(150), content: "a<b>c" });
  assert.equal(m.snippet.title.length, 100);
  assert.equal(m.snippet.description, "abc");
  assert.equal(m.status.privacyStatus, "public", "mặc định công khai");
  assert.equal(buildYouTubeMetadata({ extra_config: '{"privacy":"private","tags":["a","b"]}' }, post).status.privacyStatus, "private", "khách chọn private");
  assert.equal(buildYouTubeMetadata({ extra_config: '{"privacy":"unlisted"}' }, post).status.privacyStatus, "unlisted");
  assert.deepEqual(buildYouTubeMetadata({ extra_config: '{"tags":["a","b"]}' }, post).snippet.tags, ["a", "b"]);
  assert.equal(buildYouTubeMetadata({ extra_config: '{"privacy":"weird"}' }, post).status.privacyStatus, "public");
  assert.throws(() => buildYouTubeMetadata({ extra_config: "" }, { title: "  ", content: "x" }), /tiêu đề/);
});

const fast = { sleep: async () => {}, pollMs: 0 };
const jobsFetch = (states, calls = []) => async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url) === "https://oauth2.googleapis.com/token") return json({ access_token: "access-1" });
  if (String(url).endsWith("/upload")) return json({ job_id: "j1", status: "running" }, 202);
  const next = states.shift();
  return json(next.body, next.status || 200);
};

test("publishes by refreshing the token, queuing a VPS upload job and polling it to completion", async () => {
  const calls = [];
  const id = await publishToYouTube({ page, post: { ...post, id: "p7" }, mediaItems: [{ type: "image", url: "https://x/i.png" }, { type: "video", url: "https://cdn/v.mp4" }], env, ...fast,
    fetchImpl: jobsFetch([{ body: { status: "running" } }, { body: { status: "done", video_id: "vid42", privacy: "public" } }], calls) });
  assert.deepEqual(id, { id: "vid42", note: "" });
  assert.match(String(calls[0].init.body), /grant_type=refresh_token/);
  assert.match(String(calls[0].init.body), /refresh_token=refresh-tok/);
  assert.equal(calls[1].url, "https://up.example.com/upload");
  assert.equal(calls[1].init.headers.Authorization, "Bearer usecret");
  const sent = JSON.parse(calls[1].init.body);
  assert.equal(sent.video_url, "https://cdn/v.mp4");
  assert.equal(sent.access_token, "access-1");
  assert.equal(sent.key, "p7:UC123", "idempotency key stops duplicate uploads on retry");
  assert.equal(sent.metadata.snippet.title, "Video đầu tiên");
  assert.ok(!calls[1].init.body.includes("csecret"), "client_secret must never reach the uploader");
  assert.equal(calls.filter((c) => c.url.endsWith("/jobs/j1")).length, 2);
});

test("an upload that never finishes is reported as uncertain, not retried", async () => {
  let now = 0;
  const realNow = Date.now;
  Date.now = () => now;
  try {
    await assert.rejects(() => publishToYouTube({ page, post, mediaItems: [{ type: "video", url: "https://v" }], env, pollMs: 0, maxWaitMs: 1000,
      sleep: async () => { now += 600; }, fetchImpl: jobsFetch(Array.from({ length: 10 }, () => ({ body: { status: "running" } }))) }),
    (error) => classifyPublishError(error).kind === "uncertain");
  } finally { Date.now = realNow; }
});

test("refuses to publish without video or per-channel configuration", async () => {
  const never = async () => { throw new Error("must not call network"); };
  const media = [{ type: "video", url: "https://v" }];
  await assert.rejects(() => publishToYouTube({ page, post, mediaItems: [{ type: "image", url: "https://x/i.png" }], env, fetchImpl: never }), /bắt buộc phải có video/);
  await assert.rejects(() => publishToYouTube({ page: { ...page, extra_config: "" }, post, mediaItems: media, env, fetchImpl: never }), /Client ID/);
  await assert.rejects(() => publishToYouTube({ page: { ...page, extra_config: JSON.stringify({ client_id: "a", client_secret: "b" }) }, post, mediaItems: media, env, fetchImpl: never }), /service upload/);
  await assert.rejects(() => publishToYouTube({ page: { ...page, extra_config: JSON.stringify({ client_id: "a", client_secret: "b", uploader_url: "http://plain.example.com", uploader_secret: "s" }) }, post, mediaItems: media, env, fetchImpl: never }), /service upload/);
});

test("system-wide env values are only a fallback for tenants that set nothing", () => {
  const sys = { YOUTUBE_CLIENT_ID: "sys-id", YOUTUBE_CLIENT_SECRET: "sys-secret", YT_UPLOADER_URL: "https://sys.example.com", YT_UPLOADER_SECRET: "sys-up" };
  assert.deepEqual(youtubeSettings({ extra_config: "" }, sys), { clientId: "sys-id", clientSecret: "sys-secret", uploaderUrl: "https://sys.example.com", uploaderSecret: "sys-up" });
  assert.equal(youtubeSettings(page, sys).clientId, "cid.apps.googleusercontent.com");
});

test("Google errors map onto the existing retry policy", async () => {
  const revoked = googleApiError({ status: 400 }, { error: "invalid_grant", error_description: "Token revoked" }, "x");
  assert.deepEqual(classifyPublishError(revoked), { kind: "permanent", reason: "token" });
  const quota = googleApiError({ status: 403 }, { error: { message: "quota", errors: [{ reason: "quotaExceeded" }] } }, "x");
  assert.equal(classifyPublishError(quota).kind, "retryable");
  const server = googleApiError({ status: 503 }, {}, "x");
  assert.equal(classifyPublishError(server).kind, "retryable");
  const forbidden = googleApiError({ status: 403 }, { error: { message: "no", errors: [{ reason: "forbidden" }] } }, "x");
  assert.deepEqual(classifyPublishError(forbidden), { kind: "permanent", reason: "permission" });
});

test("uploader failures map onto the retry policy", async () => {
  const run = (states, starter) => publishToYouTube({ page, post, mediaItems: [{ type: "video", url: "https://v" }], env, ...fast, fetchImpl: starter || jobsFetch(states) });
  const kind = (error) => classifyPublishError(error).kind;
  await assert.rejects(() => run([{ body: { status: "error", http_status: 401, error: "Unauthorized", reason: "authError", source: "google" } }]), (e) => classifyPublishError(e).reason === "token");
  await assert.rejects(() => run([{ body: { status: "error", http_status: 403, error: "quota", reason: "quotaExceeded", source: "google" } }]), (e) => kind(e) === "retryable");
  await assert.rejects(() => run([{ body: { status: "error", http_status: 422, error: "video_url không hợp lệ", source: "uploader" } }]), (e) => kind(e) === "permanent" && /video_url/.test(e.message));
  await assert.rejects(() => run([{ status: 404, body: { reason: "job_lost", error: "lost", source: "uploader" } }]), (e) => kind(e) === "retryable");
  const busy = async (url) => String(url).includes("oauth2") ? json({ access_token: "a" }) : json({ error: "busy", reason: "busy", source: "uploader" }, 429);
  await assert.rejects(() => run([], busy), (e) => kind(e) === "retryable");
});

test("a wrong uploader secret is not reported as an expired Google token", async () => {
  const fetchImpl = async (url) => String(url).includes("oauth2") ? json({ access_token: "a" }) : json({ error: "unauthorized", source: "uploader" }, 401);
  await assert.rejects(() => publishToYouTube({ page, post, mediaItems: [{ type: "video", url: "https://v" }], env, ...fast, fetchImpl }), (e) => e.metaCode === undefined && /unauthorized/.test(e.message) && classifyPublishError(e).reason === "rejected");
});

test("preflight requires a video and a title for YouTube", async () => {
  const ok = async () => ({ ok: true, status: 200 });
  assert.deepEqual(await checkTargetPreflight({ target: { platform: "youtube" }, page, post: { title: "hi" }, media: { url: "https://v", type: "video" }, fetchImpl: ok }), []);
  const bad = await checkTargetPreflight({ target: { platform: "youtube" }, page, post: { title: "" }, media: { url: "https://i", type: "image" }, fetchImpl: ok });
  assert.equal(bad.length, 2);
});

test("warns when YouTube locks the video to a different privacy than requested (unaudited Google project)", async () => {
  assert.equal(privacyNote("public", "public"), "");
  assert.equal(privacyNote("public", ""), "", "uploader cũ không báo privacy -> không cảnh báo");
  assert.match(privacyNote("public", "private"), /private.*public.*audit/s);
  const result = await publishToYouTube({ page, post, mediaItems: [{ type: "video", url: "https://v" }], env, ...fast,
    fetchImpl: jobsFetch([{ body: { status: "done", video_id: "v9", privacy: "private" } }]) });
  assert.equal(result.id, "v9");
  assert.match(result.note, /audit/);
});
