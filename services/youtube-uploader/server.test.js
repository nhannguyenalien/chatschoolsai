import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createUploader, isPrivateAddress, assertPublicHttpsUrl } from "./server.js";

const SECRET = "0123456789abcdef-secret";
const publicLookup = async () => [{ address: "93.184.216.34" }];
const metadata = { snippet: { title: "Hi", description: "d" }, status: { privacyStatus: "private" } };
const video = Buffer.alloc(300_000, 7);

async function serve(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

// fetch giả: CDN chứa video và YouTube (init + PUT) — ghi lại để kiểm tra.
function fakeWorld({ cdn = {}, youtube = {} } = {}) {
  const seen = { init: null, put: null, putBytes: 0 };
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith("https://cdn.example.com/")) {
      if (cdn.redirectTo && url.endsWith("/redir.mp4")) return new Response(null, { status: 302, headers: { location: cdn.redirectTo } });
      return new Response(cdn.noLength ? new ReadableStream({ start(c) { c.enqueue(video); c.close(); } }) : video, { status: cdn.status || 200, headers: { "content-type": cdn.type || "video/mp4", ...(cdn.noLength ? {} : { "content-length": String(video.length) }) } });
    }
    if (url.startsWith("https://www.googleapis.com/upload/youtube/v3/videos")) {
      seen.init = { headers: init.headers, body: JSON.parse(init.body) };
      if (youtube.initStatus) return Response.json({ error: { message: youtube.initMessage || "denied", errors: [{ reason: youtube.initReason || "forbidden" }] } }, { status: youtube.initStatus });
      return new Response(null, { status: 200, headers: { location: "https://upload.youtube.test/session/1" } });
    }
    throw new Error(`unexpected ${url}`);
  };
  const putImpl = async (url, { headers, body }) => {
    assert.equal(url, "https://upload.youtube.test/session/1");
    seen.put = { headers };
    for await (const chunk of body) seen.putBytes += chunk.length;
    return { ok: true, status: 200, data: { id: "vid_999" } };
  };
  return { fetchImpl, putImpl, seen };
}

// POST /upload trả job_id; hỏi /jobs/:id tới khi xong và quy về {status, body} như một lời gọi đồng bộ.
async function call(base, body, secret = SECRET) {
  const headers = { Authorization: `Bearer ${secret}`, "content-type": "application/json" };
  const res = await fetch(`${base}/upload`, { method: "POST", headers, body: JSON.stringify(body) });
  const accepted = await res.json();
  if (res.status !== 202) return { status: res.status, body: accepted };
  for (let i = 0; i < 400; i++) {
    const job = await (await fetch(`${base}/jobs/${accepted.job_id}`, { headers })).json();
    if (job.status === "done") return { status: 200, body: { video_id: job.video_id } };
    if (job.status === "error") return { status: job.http_status, body: { error: job.error, reason: job.reason, source: job.source } };
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("job không kết thúc");
}

test("rejects requests without the shared secret", async () => {
  const world = fakeWorld();
  const srv = await serve(createUploader({ secret: SECRET, fetchImpl: world.fetchImpl, putImpl: world.putImpl, lookup: publicLookup }));
  try {
    const res = await call(srv.url, { video_url: "https://cdn.example.com/a.mp4" }, "wrong-secret-value-1");
    assert.equal(res.status, 401);
    assert.equal(res.body.source, "uploader");
    assert.equal((await fetch(`${srv.url}/health`)).status, 200);
  } finally { await srv.close(); }
});

test("streams the video to YouTube resumable upload and returns the video id", async () => {
  const world = fakeWorld();
  const srv = await serve(createUploader({ secret: SECRET, fetchImpl: world.fetchImpl, putImpl: world.putImpl, lookup: publicLookup }));
  try {
    const res = await call(srv.url, { video_url: "https://cdn.example.com/a.mp4", access_token: "at-1", metadata });
    assert.deepEqual(res, { status: 200, body: { video_id: "vid_999" } });
    assert.equal(world.seen.init.headers.Authorization, "Bearer at-1");
    assert.equal(world.seen.init.headers["X-Upload-Content-Length"], String(video.length));
    assert.deepEqual(world.seen.init.body, metadata);
    assert.equal(world.seen.putBytes, video.length);
    assert.equal(world.seen.put.headers["Content-Length"], String(video.length));
  } finally { await srv.close(); }
});

test("blocks private/internal video URLs (SSRF) and non-https", async () => {
  assert.ok(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"].every(isPrivateAddress));
  assert.ok(!isPrivateAddress("93.184.216.34"));
  await assert.rejects(() => assertPublicHttpsUrl("http://cdn.example.com/a.mp4", publicLookup), /https/);
  await assert.rejects(() => assertPublicHttpsUrl("https://169.254.169.254/latest", publicLookup), /nội bộ/);
  await assert.rejects(() => assertPublicHttpsUrl("https://evil.example.com/a", async () => [{ address: "10.0.0.5" }]), /nội bộ/);
  const world = fakeWorld({ cdn: { redirectTo: "https://internal.example.com/x.mp4" } });
  const lookup = async (host) => [{ address: host === "internal.example.com" ? "10.0.0.9" : "93.184.216.34" }];
  const srv = await serve(createUploader({ secret: SECRET, fetchImpl: world.fetchImpl, lookup }));
  try {
    const res = await call(srv.url, { video_url: "https://cdn.example.com/redir.mp4", access_token: "at", metadata });
    assert.equal(res.status, 422);
    assert.match(res.body.error, /nội bộ/);
    assert.equal(world.seen.init, null, "must not reach YouTube");
  } finally { await srv.close(); }
});

test("rejects non-video content, missing length and oversize files before touching YouTube", async () => {
  for (const [cdn, max, pattern, status] of [[{ type: "text/html" }, undefined, /không phải video/, 422], [{ noLength: true }, undefined, /Content-Length/, 422], [{}, 1000, /vượt giới hạn/, 413]]) {
    const world = fakeWorld({ cdn });
    const srv = await serve(createUploader({ secret: SECRET, fetchImpl: world.fetchImpl, putImpl: world.putImpl, lookup: publicLookup, maxBytes: max }));
    try {
      const res = await call(srv.url, { video_url: "https://cdn.example.com/a.mp4", access_token: "at", metadata });
      assert.equal(res.status, status);
      assert.match(res.body.error, pattern);
      assert.equal(world.seen.init, null);
    } finally { await srv.close(); }
  }
});

test("passes YouTube errors through with their status and reason", async () => {
  const world = fakeWorld({ youtube: { initStatus: 403, initMessage: "quota", initReason: "quotaExceeded" } });
  const srv = await serve(createUploader({ secret: SECRET, fetchImpl: world.fetchImpl, putImpl: world.putImpl, lookup: publicLookup }));
  try {
    const res = await call(srv.url, { video_url: "https://cdn.example.com/a.mp4", access_token: "at", metadata });
    assert.deepEqual(res, { status: 403, body: { error: "quota", reason: "quotaExceeded", source: "google" } });
  } finally { await srv.close(); }
});

test("limits concurrent uploads and validates the body", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const world = fakeWorld();
  const slowFetch = async (input, init) => { if (String(input).includes("googleapis.com/upload")) await gate; return world.fetchImpl(input, init); };
  const srv = await serve(createUploader({ secret: SECRET, fetchImpl: slowFetch, putImpl: world.putImpl, lookup: publicLookup, maxConcurrent: 1 }));
  try {
    const first = call(srv.url, { video_url: "https://cdn.example.com/a.mp4", access_token: "at", metadata });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const busy = await call(srv.url, { video_url: "https://cdn.example.com/b.mp4", access_token: "at", metadata });
    assert.equal(busy.status, 429);
    release();
    assert.equal((await first).status, 200);
    assert.equal((await call(srv.url, { video_url: "https://cdn.example.com/a.mp4", metadata })).status, 400);
    assert.equal((await call(srv.url, { video_url: "https://cdn.example.com/a.mp4", access_token: "at", metadata: {} })).status, 400);
  } finally { await srv.close(); }
});

test("refuses to start with a weak secret", () => {
  assert.throws(() => createUploader({ secret: "short" }), /16/);
});

test("real network: streams a large body over real HTTP connections without buffering it all", async () => {
  const size = 600 * 1024 * 1024;
  let received = 0;
  const cdn = await serve((req, res) => {
    res.writeHead(200, { "content-type": "video/mp4", "content-length": String(size) });
    const chunk = Buffer.alloc(1024 * 1024, 1);
    let sent = 0;
    const pump = () => { while (sent < size) { sent += chunk.length; if (!res.write(chunk)) return res.once("drain", pump); } res.end(); };
    pump();
  });
  const yt = await serve(async (req, res) => {
    if (req.method === "POST") { res.writeHead(200, { location: `${yt.url}/session` }); return res.end(); }
    if (req.url !== "/session") { res.writeHead(404); return res.end(); }
    for await (const chunk of req) received += chunk.length;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "big_1" }));
  });
  const fetchImpl = (input, init) => {
    const url = String(input);
    if (url.startsWith("https://cdn.example.com")) return fetch(cdn.url + new URL(url).pathname, init);
    return fetch(`${yt.url}/init`, init);
  };
  const srv = await serve(createUploader({ secret: SECRET, fetchImpl, lookup: publicLookup }));
  try {
    const rssBefore = process.memoryUsage().rss;
    const res = await call(srv.url, { video_url: "https://cdn.example.com/big.mp4", access_token: "at", metadata });
    assert.deepEqual(res, { status: 200, body: { video_id: "big_1" } });
    assert.equal(received, size);
    assert.ok(process.memoryUsage().rss - rssBefore < 200 * 1024 * 1024, "body must be streamed, not held in memory");
  } finally { await srv.close(); await cdn.close(); await yt.close(); }
});

test("jobs run in the background and the same key never uploads twice", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const world = fakeWorld();
  let inits = 0;
  const slowFetch = async (input, init) => { if (String(input).includes("googleapis.com/upload")) { inits++; await gate; } return world.fetchImpl(input, init); };
  const srv = await serve(createUploader({ secret: SECRET, fetchImpl: slowFetch, putImpl: world.putImpl, lookup: publicLookup, maxConcurrent: 1 }));
  const headers = { Authorization: `Bearer ${SECRET}`, "content-type": "application/json" };
  const post = (body) => fetch(`${srv.url}/upload`, { method: "POST", headers, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const payload = { video_url: "https://cdn.example.com/a.mp4", access_token: "at", metadata, key: "post1:UC1" };
  try {
    const first = await post(payload);
    assert.equal(first.status, 202);
    assert.equal(first.body.status, "running");
    const again = await post(payload); // retry của Worker khi job còn chạy: không phải 429, không up thêm
    assert.deepEqual([again.status, again.body.job_id], [202, first.body.job_id]);
    assert.equal((await post({ ...payload, key: "other" })).status, 429);
    release();
    let job;
    for (let i = 0; i < 200 && job?.status !== "done"; i++) { await new Promise((r) => setTimeout(r, 10)); job = await (await fetch(`${srv.url}/jobs/${first.body.job_id}`, { headers })).json(); }
    assert.deepEqual(job, { job_id: first.body.job_id, status: "done", video_id: "vid_999" });
    const after = await post(payload); // đã đăng xong: trả kết quả cũ, không đăng trùng
    assert.equal(after.body.video_id, "vid_999");
    assert.equal(inits, 1, "YouTube must be called exactly once");
  } finally { release(); await srv.close(); }
});

test("a failed job is not remembered, so retrying the same key uploads again", async () => {
  let fail = true;
  const world = fakeWorld();
  const fetchImpl = async (input, init) => (String(input).includes("googleapis.com/upload") && fail ? Response.json({ error: { message: "backend", errors: [{ reason: "backendError" }] } }, { status: 503 }) : world.fetchImpl(input, init));
  const srv = await serve(createUploader({ secret: SECRET, fetchImpl, putImpl: world.putImpl, lookup: publicLookup }));
  try {
    const body = { video_url: "https://cdn.example.com/a.mp4", access_token: "at", metadata, key: "k1" };
    assert.deepEqual(await call(srv.url, body), { status: 503, body: { error: "backend", reason: "backendError", source: "google" } });
    fail = false;
    assert.deepEqual(await call(srv.url, body), { status: 200, body: { video_id: "vid_999" } });
  } finally { await srv.close(); }
});

test("job endpoint needs the secret and unknown jobs are reported as lost", async () => {
  const srv = await serve(createUploader({ secret: SECRET, lookup: publicLookup }));
  try {
    const id = "00000000-0000-4000-8000-000000000000";
    assert.equal((await fetch(`${srv.url}/jobs/${id}`)).status, 401);
    const lost = await fetch(`${srv.url}/jobs/${id}`, { headers: { Authorization: `Bearer ${SECRET}` } });
    assert.equal(lost.status, 404);
    assert.equal((await lost.json()).reason, "job_lost");
  } finally { await srv.close(); }
});
