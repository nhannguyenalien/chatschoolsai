// Plays a pre-encoded video to one or more RTMP(S) destinations with `ffmpeg -c copy`.
// Config (env): NAME, VIDEO_URL, OUTPUTS (comma-separated full rtmp(s) urls incl. key), SCHEDULE ("19:00,12:00"),
// TZ_OFFSET_MIN (default 420 = UTC+7), LOOP (true|false), RUN_NOW (true|false), CONTROL_TOKEN, LIVE_PORT, DATA_DIR.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, renameSync, statSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const env = (k, d = "") => process.env[k] ?? d;
const NAME = env("NAME", "live");
const VIDEO_URL = env("VIDEO_URL");
const OUTPUTS = env("OUTPUTS").split(",").map((s) => s.trim()).filter(Boolean);
const SCHEDULE = env("SCHEDULE").split(",").map((s) => s.trim()).filter(Boolean);
const TZ_OFFSET_MIN = Number(env("TZ_OFFSET_MIN", "420"));
const LOOP = env("LOOP", "false") === "true";
const SESSION_MAX_MIN = Number(env("SESSION_MAX_MIN", "0"));      // hard stop for looping sessions (0 = until end of video)
const DATA_DIR = env("DATA_DIR", "/data");
const PORT = Number(env("LIVE_PORT", "8080"));
const TOKEN = env("CONTROL_TOKEN");
const VIDEO = `${DATA_DIR}/video.mp4`;

const mask = (s) => s.replace(/([^/]{4})[^/]*$/, "$1…");
const log = (...a) => console.log(new Date().toISOString(), `[${NAME}]`, ...a);
const st = { state: "idle", startedAt: null, elapsed: 0, restarts: 0, lastExit: null, nextRun: null, lastError: null };
let proc = null, wantStop = false, running = false;

async function ensureVideo() {
  mkdirSync(DATA_DIR, { recursive: true });
  const head = await fetch(VIDEO_URL, { headers: { range: "bytes=0-0" } });
  const total = Number((head.headers.get("content-range") || "").split("/")[1]) || Number(head.headers.get("content-length")) || 0;
  if (existsSync(VIDEO) && total && statSync(VIDEO).size === total) return log("video cached", total);
  log("downloading video", VIDEO_URL);
  const r = await fetch(VIDEO_URL);
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(`${VIDEO}.part`));
  renameSync(`${VIDEO}.part`, VIDEO);
  log("video ready", statSync(VIDEO).size);
}

function ffArgs(skip) {
  const base = ["-hide_banner", "-loglevel", "warning", "-re"];
  if (LOOP) base.push("-stream_loop", "-1");
  if (skip > 0) base.push("-ss", String(skip));
  base.push("-i", VIDEO, "-c", "copy", "-flvflags", "no_duration_filesize");
  if (OUTPUTS.length === 1) return [...base, "-f", "flv", OUTPUTS[0]];
  return [...base, "-map", "0:v", "-map", "0:a", "-f", "tee", OUTPUTS.map((u) => `[f=flv:onfail=ignore]${u}`).join("|")];
}

async function session() {
  if (running) return log("session already running");
  running = true; wantStop = false; st.restarts = 0; st.startedAt = Date.now(); st.lastError = null;
  const hardStop = SESSION_MAX_MIN ? Date.now() + SESSION_MAX_MIN * 60000 : 0;
  try { await ensureVideo(); } catch (e) { st.lastError = String(e); running = false; st.state = "idle"; return log("video error", e.message); }
  let played = 0;                                                   // seconds of the video already pushed (for resume after a crash)
  while (!wantStop && (!hardStop || Date.now() < hardStop)) {
    st.state = "live";
    const t0 = Date.now();
    log("ffmpeg start, skip", played.toFixed(1), "→", OUTPUTS.map(mask).join(" , "));
    const code = await new Promise((res) => {
      proc = spawn("ffmpeg", ffArgs(played), { stdio: ["ignore", "ignore", "pipe"] });
      proc.stderr.on("data", (d) => { const s = d.toString().trim(); if (s) log("ffmpeg:", OUTPUTS.reduce((x, u) => x.split(u).join(mask(u)), s).slice(0, 400)); });
      proc.on("exit", (c) => res(c));
      proc.on("error", (e) => { st.lastError = String(e); res(-1); });
    });
    proc = null;
    const ran = (Date.now() - t0) / 1000; played += ran; st.lastExit = { code, ranSec: Math.round(ran), at: new Date().toISOString() };
    if (wantStop) break;
    if (code === 0 && !LOOP) { log("video finished"); break; }            // normal end of a single pass
    st.restarts++; st.state = "restarting";
    const wait = Math.min(30, 2 + st.restarts * 3);
    log(`ffmpeg exited code=${code} after ${Math.round(ran)}s, restart #${st.restarts} in ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  st.state = "idle"; running = false; log("session ended");
}
function stop() { wantStop = true; if (proc) proc.kill("SIGINT"); }

const nowLocal = () => new Date(Date.now() + TZ_OFFSET_MIN * 60000);
const hhmm = (d) => d.toISOString().slice(11, 16);
let lastFired = "";
function tick() {
  const d = nowLocal(), key = d.toISOString().slice(0, 16);
  const next = SCHEDULE.map((t) => { const [h, m] = t.split(":").map(Number); const x = new Date(d); x.setUTCHours(h, m, 0, 0); if (x <= d) x.setUTCDate(x.getUTCDate() + 1); return x; }).sort((a, b) => a - b)[0];
  st.nextRun = next ? new Date(next.getTime() - TZ_OFFSET_MIN * 60000).toISOString() : null;
  if (SCHEDULE.includes(hhmm(d)) && key !== lastFired) { lastFired = key; log("scheduled start", hhmm(d)); session(); }
}

createServer((req, res) => {
  const j = (c, o) => { res.writeHead(c, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (req.url === "/health") return j(200, { ok: true, state: st.state });
  if (req.url === "/status") return j(200, { name: NAME, ...st, elapsedSec: st.startedAt && running ? Math.round((Date.now() - st.startedAt) / 1000) : 0, outputs: OUTPUTS.map(mask), schedule: SCHEDULE, loop: LOOP });
  if (req.method === "POST" && (req.url === "/start" || req.url === "/stop")) {
    if (!TOKEN || req.headers["x-token"] !== TOKEN) return j(401, { error: "unauthorized" });
    if (req.url === "/start") session(); else stop();
    return j(200, { ok: true });
  }
  j(404, { error: "not found" });
}).listen(PORT, () => log("http on", PORT));

if (!OUTPUTS.length || !VIDEO_URL) { log("OUTPUTS and VIDEO_URL are required"); }
else {
  log("ready; schedule", SCHEDULE.join(",") || "(none)", "loop", LOOP);
  if (env("RUN_NOW") === "true") session();
  setInterval(tick, 15000); tick();
}
process.on("SIGTERM", () => { stop(); setTimeout(() => process.exit(0), 3000); });
