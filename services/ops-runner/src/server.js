// Điểm vào của ops-runner: dựng client, đăng ký job, chạy bộ hẹn giờ, và mở 3 endpoint nhỏ:
//   GET  /health      — Coolify/uptime kiểm tra sống (không cần khoá)
//   GET  /status      — trạng thái lần chạy gần nhất của từng job (cần Bearer RUNNER_SECRET)
//   POST /run/:job    — chạy tay một job để thử (cần Bearer RUNNER_SECRET)
// CHỈ chạy 1 bản (replica) vì bộ hẹn giờ nằm trong tiến trình; muốn nhiều bản phải thêm khoá phân tán.
import http from "node:http";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createPb } from "./pb.js";
import { createTelegram } from "./telegram.js";
import { createScheduler } from "./scheduler.js";
import { backupJob } from "./jobs/backup.js";
import { watchdogJob } from "./jobs/watchdog.js";
import { bookingDigestJob } from "./jobs/bookingDigest.js";
import { weeklyReportJob } from "./jobs/weeklyReport.js";

export function authorized(header, secret) {
  const a = Buffer.from(String(header || "").replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp({ config, scheduler }) {
  return http.createServer(async (req, res) => {
    const send = (code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
    const { pathname } = new URL(req.url, "http://x");
    if (req.method === "GET" && pathname === "/health") return send(200, { ok: true });
    if (!authorized(req.headers.authorization, config.secret)) return send(401, { error: "unauthorized" });
    if (req.method === "GET" && pathname === "/status") return send(200, scheduler.status());
    const run = pathname.match(/^\/run\/([\w-]+)$/);
    if (req.method === "POST" && run) {
      try { return send(200, await scheduler.runJob(run[1], { manual: true })); } catch (err) { return send(404, { error: err.message }); }
    }
    send(404, { error: "not found" });
  });
}

async function main() {
  const config = loadConfig();
  const telegram = createTelegram({ token: config.telegramToken });
  const pb = createPb({ url: config.pbUrl, email: config.pbEmail, password: config.pbPassword });
  const jobs = [watchdogJob, backupJob, bookingDigestJob, weeklyReportJob];
  const ctx = { config, pb, telegram, memory: new Map() };
  const scheduler = createScheduler({
    jobs, ctx, tzOffsetMin: config.tzOffsetMin,
    statePath: path.join(config.dataDir, "state.json"),
    // Job lỗi (đặc biệt là backup) phải báo ngay, đừng để âm thầm.
    onError: (name, err) => telegram.send(config.alertChatId, `⚠️ ops-runner: job ${name} lỗi — ${err.message}`),
  });
  createApp({ config, scheduler }).listen(config.port, () => console.log(`ops-runner nghe cổng ${config.port}`));
  await scheduler.start();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
