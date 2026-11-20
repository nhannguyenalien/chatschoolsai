// Test tích hợp: chạy server thật (HTTP + xác thực + bộ hẹn giờ + job + client PocketBase thật qua mạng loopback)
// với PocketBase giả. Telegram và Meta được chặn ở tầng fetch nên không gửi gì ra ngoài.
// Giới hạn: PocketBase giả KHÔNG hiểu cú pháp filter (trả dữ liệu cố định), nên test này kiểm tra đường đi,
// mã hoá URL, xác thực, tên backup hợp lệ, đánh dấu chống gửi lặp — không kiểm tra ngữ nghĩa lọc của PocketBase.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "./server.js";
import { createPb } from "./pb.js";
import { createTelegram } from "./telegram.js";
import { createScheduler } from "./scheduler.js";
import { backupJob } from "./jobs/backup.js";
import { bookingDigestJob } from "./jobs/bookingDigest.js";
import { bookingReminderJob } from "./jobs/bookingReminder.js";
import { weeklyReportJob } from "./jobs/weeklyReport.js";
import { watchdogJob } from "./jobs/watchdog.js";

const listen = (server) => new Promise((r) => server.listen(0, "127.0.0.1", () => r(server.address().port)));
const iso = (ms) => new Date(ms).toISOString().replace("T", " ");

function startFakePb(data) {
  const requests = [], backups = new Map();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const body = await new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
    const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(obj === null ? "" : JSON.stringify(obj)); };
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
    if (url.pathname === "/api/health") return send(200, { code: 200 });
    if (url.pathname === "/api/collections/_superusers/auth-with-password") {
      const { identity, password } = JSON.parse(body);
      return identity === "admin@x.io" && password === "pw" ? send(200, { token: "T" }) : send(400, { message: "bad creds" });
    }
    if (req.headers.authorization !== "T") return send(401, { message: "unauthorized" });
    let m;
    if ((m = url.pathname.match(/^\/api\/collections\/(\w+)\/records$/)) && req.method === "GET") {
      const items = data[m[1]] || [];
      return send(200, { page: 1, perPage: Number(url.searchParams.get("perPage")), totalItems: data.__counts?.[m[1]] ?? items.length, items });
    }
    if ((m = url.pathname.match(/^\/api\/collections\/bookings\/records\/(\w+)$/)) && req.method === "PATCH") {
      const rec = data.bookings.find((b) => b.id === m[1]);
      Object.assign(rec, JSON.parse(body));
      return send(200, rec);
    }
    if (url.pathname === "/api/backups" && req.method === "POST") {
      const { name } = JSON.parse(body);
      if (!/^[a-z0-9_-]+\.zip$/.test(name)) return send(400, { message: "Invalid backup name" }); // quy tắc thật của PocketBase
      backups.set(name, Buffer.alloc(4096, 1));
      return send(204, null);
    }
    if (url.pathname === "/api/files/token" && req.method === "POST") return send(200, { token: "FT" });
    if ((m = url.pathname.match(/^\/api\/backups\/([^/]+)$/))) {
      const name = decodeURIComponent(m[1]);
      if (req.method === "DELETE") { backups.delete(name); return send(204, null); }
      if (url.searchParams.get("token") !== "FT" || !backups.has(name)) return send(404, { message: "nope" });
      res.writeHead(200, { "Content-Type": "application/zip" });
      return res.end(backups.get(name));
    }
    send(404, { message: `unhandled ${req.method} ${url.pathname}` });
  });
  return { server, requests, backups, data };
}

async function setup(data) {
  const fake = startFakePb(data);
  const port = await listen(fake.server);
  const sent = { telegram: [], meta: [] };
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "ops-it-"));
  const config = { pbUrl: `http://127.0.0.1:${port}`, pbEmail: "admin@x.io", pbPassword: "pw", secret: "s".repeat(24), dataDir, tzOffsetMin: 420, backupKeepDays: 14, reminderLeadMin: 120, alertChatId: "ALERT", healthUrls: [], heartbeatUrl: "" };
  const pb = createPb({ url: config.pbUrl, email: config.pbEmail, password: config.pbPassword });
  const interceptFetch = async (url, init) => {
    if (String(url).startsWith("https://api.telegram.org/")) { sent.telegram.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, status: 200 }; }
    if (String(url).startsWith("https://graph.facebook.com/")) { sent.meta.push({ url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({}) }; }
    return fetch(url, init);
  };
  const telegram = createTelegram({ token: "BOT", fetchImpl: interceptFetch });
  const ctx = { config, pb, telegram, fetchImpl: interceptFetch, memory: new Map() };
  const jobs = [watchdogJob, backupJob, bookingDigestJob, bookingReminderJob, weeklyReportJob];
  const scheduler = createScheduler({ jobs, ctx, tzOffsetMin: 420, statePath: path.join(dataDir, "state.json"), log: () => {}, onError: () => {} });
  const app = createApp({ config, scheduler });
  const appPort = await listen(app);
  const run = (job, key = config.secret) => fetch(`http://127.0.0.1:${appPort}/run/${job}`, { method: "POST", headers: key ? { Authorization: `Bearer ${key}` } : {} });
  const close = () => { fake.server.close(); app.close(); };
  return { fake, sent, config, run, scheduler, appPort, dataDir, close };
}

test("server: /health mở, còn /status và /run cần khoá", async () => {
  const t = await setup({});
  try {
    assert.equal((await fetch(`http://127.0.0.1:${t.appPort}/health`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${t.appPort}/status`)).status, 401);
    assert.equal((await t.run("pb-backup", "sai-khoa")).status, 401);
    assert.equal((await t.run("khong-co-job")).status, 404);
    assert.equal(t.fake.requests.some((r) => r.path.includes("/backups")), false); // không có khoá thì không chạm PocketBase
  } finally { t.close(); }
});

test("pb-backup: tên hợp lệ với PocketBase, tải file về volume, xoá bản trên PocketBase", async () => {
  const t = await setup({});
  try {
    const res = await (await t.run("pb-backup")).json();
    assert.equal(res.ok, true, JSON.stringify(res));
    const files = await readdir(path.join(t.dataDir, "backups"));
    assert.equal(files.length, 1);
    assert.match(files[0], /^ops-[a-z0-9_-]+\.zip$/);
    assert.equal((await stat(path.join(t.dataDir, "backups", files[0]))).size, 4096);
    assert.equal(t.fake.backups.size, 0); // đã dọn bên PocketBase
    const post = t.fake.requests.find((r) => r.method === "POST" && r.path === "/api/backups");
    assert.match(JSON.parse(post.body).name, /^[a-z0-9_-]+\.zip$/);
  } finally { t.close(); }
});

test("pb-backup: sai mật khẩu superuser thì báo lỗi rõ, không tạo file", async () => {
  const t = await setup({});
  try {
    t.config.pbPassword = "sai";
    const pb = createPb({ url: t.config.pbUrl, email: t.config.pbEmail, password: "sai" });
    await assert.rejects(() => pb.json("/api/backups"), /Không đăng nhập được PocketBase/);
  } finally { t.close(); }
});

test("booking-digest: gửi đúng chủ cơ sở, filter được mã hoá và có tenant", async () => {
  const soon = Date.now() + 3600000;
  const t = await setup({
    bot_configs: [{ tenant: "spa1", owner_telegram_chat_id: "OWNER1" }],
    bookings: [{ id: "b1", tenant: "spa1", start: iso(soon), customer_name: "Lan", service_name: "Massage", party_size: 2, phone: "090", status: "confirmed" }],
  });
  try {
    const res = await (await t.run("booking-digest")).json();
    assert.deepEqual(res.result, { tenants: 1, sent: 1 });
    assert.equal(t.sent.telegram.length, 1);
    assert.equal(t.sent.telegram[0].body.chat_id, "OWNER1");
    assert.match(t.sent.telegram[0].body.text, /spa1/);
    assert.match(t.sent.telegram[0].body.text, /Lan/);
    const q = t.fake.requests.find((r) => r.path.endsWith("/bookings/records"));
    assert.match(q.query.filter, /tenant='spa1'/);
    assert.match(q.query.filter, /status='confirmed' \|\| status='pending'/);
    assert.equal(q.query.sort, "start");
  } finally { t.close(); }
});

test("weekly-report: đếm bằng totalItems và không truyền fields cho truy vấn đếm", async () => {
  const t = await setup({ bot_configs: [{ tenant: "spa1", owner_telegram_chat_id: "OWNER1" }], __counts: { messages: 42, bookings: 5, post_targets: 3 } });
  try {
    const res = await (await t.run("weekly-report")).json();
    assert.deepEqual(res.result, { tenants: 1, sent: 1 });
    const text = t.sent.telegram[0].body.text;
    assert.match(text, /Tin nhắn: 42/);
    assert.match(text, /Lịch đặt mới: 5/);
    assert.match(text, /3 đã đăng/);
    const counts = t.fake.requests.filter((r) => r.path.endsWith("/messages/records") || r.path.endsWith("/post_targets/records"));
    assert.ok(counts.length >= 3 && counts.every((r) => r.query.fields === undefined && r.query.perPage === "1"));
  } finally { t.close(); }
});

test("booking-reminder: client_meta dạng JSON object chọn đúng fanpage, đánh dấu, chạy lại không gửi trùng", async () => {
  const soon = Date.now() + 60 * 60000;
  const data = {
    bot_configs: [{ owner_telegram_chat_id: "OWNER1", response_language: "en" }],
    bookings: [{ id: "bk1", tenant: "spa1", start: iso(soon), customer_name: "An", phone: "090", service_name: "Massage", session: "facebook:CUS1", extra_json: "" }],
    messages: [{ created: iso(Date.now() - 3600000), client_meta: { page_id: "PAGE_B" } }], // object, đúng như PocketBase trả về field JSON
    pages_config: [{ page_id: "PAGE_A", access_token: "TOKEN_A" }, { page_id: "PAGE_B", access_token: "TOKEN_B" }],
  };
  const t = await setup(data);
  try {
    const first = await (await t.run("booking-reminder")).json();
    assert.deepEqual(first.result, { due: 1, sent: 1, manual: 0 });
    assert.equal(t.sent.meta.length, 1);
    assert.equal(t.sent.meta[0].auth, "Bearer TOKEN_B"); // chọn đúng trang theo page_id, không lấy trang đầu tiên
    assert.equal(t.sent.meta[0].body.recipient.id, "CUS1");
    assert.match(t.sent.meta[0].body.message.text, /^Reminder: An/);
    assert.equal(JSON.parse(data.bookings[0].extra_json).reminder.status, "sent");
    const second = await (await t.run("booking-reminder")).json();
    assert.deepEqual(second.result, { due: 0, sent: 0, manual: 0 });
    assert.equal(t.sent.meta.length, 1); // không gửi lần hai
  } finally { t.close(); }
});

test("booking-reminder: khách ngoài cửa sổ 24h thì không gửi Meta, báo chủ nhắc tay", async () => {
  const soon = Date.now() + 30 * 60000;
  const t = await setup({
    bot_configs: [{ owner_telegram_chat_id: "OWNER1", response_language: "vi" }],
    bookings: [{ id: "bk2", tenant: "spa1", start: iso(soon), customer_name: "Bình", phone: "091", service_name: "Gội", session: "facebook:CUS2", extra_json: "" }],
    messages: [{ created: iso(Date.now() - 30 * 3600000), client_meta: {} }],
    pages_config: [{ page_id: "P", access_token: "TOK" }],
  });
  try {
    const res = await (await t.run("booking-reminder")).json();
    assert.deepEqual(res.result, { due: 1, sent: 0, manual: 1 });
    assert.equal(t.sent.meta.length, 0);
    assert.match(t.sent.telegram[0].body.text, /Bình — 091/);
    assert.equal(t.sent.telegram[0].body.chat_id, "OWNER1");
  } finally { t.close(); }
});

test("watchdog + /status: ghi lại kết quả lần chạy gần nhất", async () => {
  const t = await setup({});
  try {
    const res = await (await t.run("watchdog")).json();
    assert.equal(res.ok, true);
    assert.equal(Object.values(res.result)[0], true);
    const status = await (await fetch(`http://127.0.0.1:${t.appPort}/status`, { headers: { Authorization: `Bearer ${t.config.secret}` } })).json();
    assert.equal(status.watchdog.ok, true);
  } finally { t.close(); }
});
