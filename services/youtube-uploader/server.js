// Service upload YouTube chạy trên VPS (Coolify). Worker Cloudflare không tải nổi video lớn (giới hạn RAM/thời gian),
// nên nó giao cho service này: nhận {video_url, access_token, metadata}, stream video từ URL sang YouTube bằng
// resumable upload (không giữ cả file trong RAM) và trả về {video_id}. Không phụ thuộc thư viện ngoài (Node 20+).
import http from "node:http";
import net from "node:net";
import dns from "node:dns/promises";
import https from "node:https";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const YT_INIT = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const MAX_REDIRECTS = 3;

export function isPrivateAddress(address) {
  if (net.isIPv6(address)) {
    const a = address.toLowerCase();
    if (a === "::1" || a === "::" || a.startsWith("fe80") || a.startsWith("fc") || a.startsWith("fd")) return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

// Chặn SSRF: chỉ https, và host không được trỏ vào mạng nội bộ của VPS.
export async function assertPublicHttpsUrl(value, lookup = dns.lookup) {
  let url;
  try { url = new URL(value); } catch { throw httpError(422, "video_url không hợp lệ"); }
  if (url.protocol !== "https:") throw httpError(422, "video_url phải là https");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw httpError(422, "Không phân giải được tên miền của video_url"); });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw httpError(422, "video_url trỏ vào địa chỉ nội bộ, bị chặn");
  return url;
}

function httpError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

function secretMatches(provided, expected) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw httpError(413, "Body quá lớn");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw httpError(400, "Body không phải JSON"); }
}

// PUT có backpressure thật: fetch() của Node đọc body stream nhanh hơn tốc độ ghi nên RAM phình theo cỡ file,
// còn pipeline() vào http(s).request thì chỉ đọc khi socket còn chỗ.
export function streamPut(url, { headers, body, timeoutMs }) {
  const target = new URL(url);
  const client = target.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(target, { method: "PUT", headers, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        let data = {};
        try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Upload sang YouTube quá thời gian")));
    req.on("error", reject);
    pipeline(body, req).catch(reject);
  });
}

export function createUploader({ secret, fetchImpl = fetch, putImpl = streamPut, lookup = dns.lookup, maxBytes = 5 * 1024 ** 3, maxConcurrent = 2, timeoutMs = 12 * 60 * 1000 } = {}) {
  if (!secret || secret.length < 16) throw new Error("UPLOADER_SECRET phải có ít nhất 16 ký tự");
  let active = 0;

  async function openSource(videoUrl) {
    let url = await assertPublicHttpsUrl(videoUrl, lookup);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        await res.body?.cancel();
        url = await assertPublicHttpsUrl(new URL(res.headers.get("location"), url).href, lookup);
        continue;
      }
      if (!res.ok) throw httpError(502, `Không tải được video nguồn (HTTP ${res.status})`);
      return res;
    }
    throw httpError(422, "video_url chuyển hướng quá nhiều lần");
  }

  async function upload({ video_url: videoUrl, access_token: accessToken, metadata }) {
    if (!accessToken || typeof accessToken !== "string") throw httpError(400, "Thiếu access_token");
    if (!metadata?.snippet?.title) throw httpError(400, "Thiếu metadata.snippet.title");
    const source = await openSource(videoUrl);
    const length = Number(source.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0) { await source.body?.cancel(); throw httpError(422, "Video nguồn không báo dung lượng (thiếu Content-Length)"); }
    if (length > maxBytes) { await source.body?.cancel(); throw httpError(413, `Video ${Math.round(length / 1048576)}MB vượt giới hạn ${Math.round(maxBytes / 1048576)}MB`); }
    const type = (source.headers.get("content-type") || "").split(";")[0].trim();
    if (type && !/^video\//.test(type) && type !== "application/octet-stream") { await source.body?.cancel(); throw httpError(422, `video_url không phải video (${type})`); }

    const init = await fetchImpl(YT_INIT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(length), "X-Upload-Content-Type": type && type !== "application/octet-stream" ? type : "video/*"
      },
      body: JSON.stringify(metadata), signal: AbortSignal.timeout(60_000)
    });
    if (!init.ok) { await source.body?.cancel(); throw await googleFailure(init); }
    const sessionUrl = init.headers.get("location");
    if (!sessionUrl) { await source.body?.cancel(); throw httpError(502, "YouTube không trả địa chỉ upload"); }

    const put = await putImpl(sessionUrl, {
      headers: { "Content-Length": String(length), "Content-Type": type || "video/*" },
      body: Readable.fromWeb(source.body), timeoutMs
    });
    if (!put.ok) throw httpError(put.status, put.data?.error?.message || `YouTube HTTP ${put.status}`, { reason: put.data?.error?.errors?.[0]?.reason || put.data?.error?.status || "", source: "google" });
    const data = put.data || {};
    if (!data.id) throw httpError(502, "YouTube không trả videoId");
    return { video_id: data.id };
  }

  async function googleFailure(res) {
    const data = await res.json().catch(() => ({}));
    return httpError(res.status, data.error?.message || `YouTube HTTP ${res.status}`, { reason: data.error?.errors?.[0]?.reason || data.error?.status || "", source: "google" });
  }

  // Upload chạy nền: POST /upload trả ngay job_id, Worker hỏi GET /jobs/:id. Lý do: Cloudflare proxy cắt mọi request
  // im lặng quá ~100s, còn upload video có thể kéo dài nhiều phút.
  // `key` (idempotency) chống đăng trùng: gọi lại cùng key khi job đang chạy/đã xong thì trả job cũ thay vì up lần nữa.
  // Job lỗi không được nhớ -> gọi lại với cùng key sẽ thử upload lại.
  const jobs = new Map();
  const byKey = new Map();
  const JOB_TTL_MS = 24 * 60 * 60 * 1000;

  function sweep(now = Date.now()) {
    for (const [id, job] of jobs) {
      if (job.status !== "running" && now - job.finishedAt > JOB_TTL_MS) { jobs.delete(id); if (byKey.get(job.key) === id) byKey.delete(job.key); }
    }
  }

  function startJob(payload) {
    sweep();
    const key = typeof payload.key === "string" ? payload.key.slice(0, 200) : "";
    const existing = key && jobs.get(byKey.get(key));
    if (existing && existing.status !== "error") return existing;
    const job = { id: randomUUID(), key, status: "running", startedAt: Date.now() };
    jobs.set(job.id, job);
    if (key) byKey.set(key, job.id);
    active++;
    upload(payload).then((result) => Object.assign(job, { status: "done", ...result }), (error) => {
      if (!error.status) console.error("[uploader]", error);
      Object.assign(job, { status: "error", http_status: error.status >= 400 && error.status < 600 ? error.status : 502, error: error.message, reason: error.reason || "", source: error.source || "uploader" });
      if (key && byKey.get(key) === job.id) byKey.delete(key);
    }).finally(() => { active--; job.finishedAt = Date.now(); });
    return job;
  }

  const publicJob = (job) => job.status === "done" ? { job_id: job.id, status: "done", video_id: job.video_id }
    : job.status === "error" ? { job_id: job.id, status: "error", http_status: job.http_status, error: job.error, reason: job.reason, source: job.source }
    : { job_id: job.id, status: "running" };

  return async function handler(req, res) {
    const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
    try {
      const path = new URL(req.url, "http://x").pathname;
      if (req.method === "GET" && path === "/health") return send(200, { ok: true, active });
      const jobMatch = path.match(/^\/jobs\/([0-9a-f-]{36})$/);
      const isUpload = req.method === "POST" && path === "/upload";
      if (!isUpload && !(req.method === "GET" && jobMatch)) return send(404, { error: "Not found", source: "uploader" });
      const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!secretMatches(auth, secret)) return send(401, { error: "unauthorized", source: "uploader" });
      if (jobMatch) {
        const job = jobs.get(jobMatch[1]);
        return job ? send(200, publicJob(job)) : send(404, { error: "Job không tồn tại (uploader có thể đã khởi động lại)", reason: "job_lost", source: "uploader" });
      }
      const payload = await readJson(req);
      const existing = typeof payload.key === "string" && payload.key && jobs.get(byKey.get(payload.key.slice(0, 200)));
      if (!existing && active >= maxConcurrent) return send(429, { error: "Uploader đang bận, thử lại sau", reason: "busy", source: "uploader" });
      send(202, publicJob(startJob(payload)));
    } catch (error) {
      const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
      if (!error.status) console.error("[uploader]", error);
      if (!res.headersSent) send(status, { error: error.message, reason: error.reason || "", source: error.source || "uploader" });
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const handler = createUploader({ secret: process.env.UPLOADER_SECRET, maxBytes: Number(process.env.MAX_VIDEO_BYTES) || undefined });
  const port = Number(process.env.UPLOADER_PORT) || 3000;
  const server = http.createServer(handler);
  server.requestTimeout = 0;
  server.listen(port, () => console.log(`youtube-uploader lắng nghe cổng ${port}`));
}
