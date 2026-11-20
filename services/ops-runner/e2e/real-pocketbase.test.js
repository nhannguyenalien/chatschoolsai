// End-to-end với PocketBase THẬT (tuỳ chọn, mặc định bỏ qua).
// Chạy:  POCKETBASE_BIN=/đường/dẫn/pocketbase npm run test:e2e
// Khởi động một PocketBase trống trong thư mục tạm, tạo collection đúng kiểu dữ liệu của dự án (json/bool/date/select),
// nạp dữ liệu — gồm cả bản ghi "mồi" (tenant khác, quá giờ, đã huỷ) — rồi chạy các job thật.
// Telegram và Meta bị chặn ở tầng fetch nên không gửi gì ra ngoài.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { mkdtemp, readdir, stat, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPb, pbTime } from "../src/pb.js";
import { createTelegram } from "../src/telegram.js";
import { createScheduler } from "../src/scheduler.js";
import { backupJob } from "../src/jobs/backup.js";
import { bookingDigestJob } from "../src/jobs/bookingDigest.js";
import { bookingReminderJob } from "../src/jobs/bookingReminder.js";
import { weeklyReportJob } from "../src/jobs/weeklyReport.js";
import { watchdogJob } from "../src/jobs/watchdog.js";

const BIN = process.env.POCKETBASE_BIN;
const skip = BIN ? false : "đặt POCKETBASE_BIN để chạy e2e với PocketBase thật";
const EMAIL = "admin@example.test", PASS = "test-password-123";

let proc, dir, pb, config, sent, scheduler, ctx;
const freePort = () => new Promise((r) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const text = (name) => ({ name, type: "text" });
const bool = (name) => ({ name, type: "bool" });
const num = (name) => ({ name, type: "number" });
const date = (name) => ({ name, type: "date" });
const json = (name) => ({ name, type: "json", maxSize: 2000000 });
const select = (name, values) => ({ name, type: "select", values, maxSelect: 1 });
const auto = [{ name: "created", type: "autodate", onCreate: true, onUpdate: false }, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }];
const priv = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };

before(async () => {
  if (skip) return;
  dir = await mkdtemp(path.join(os.tmpdir(), "ops-e2e-"));
  const args = [`--dir=${dir}/pb_data`, `--migrationsDir=${dir}/migrations`, `--hooksDir=${dir}/hooks`];
  const up = spawnSync(BIN, ["superuser", "upsert", EMAIL, PASS, ...args], { encoding: "utf8" });
  assert.equal(up.status, 0, up.stderr);
  const port = await freePort();
  proc = spawn(BIN, ["serve", `--http=127.0.0.1:${port}`, ...args], { stdio: "ignore" });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${url}/api/health`)).ok) break; } catch { /* chưa lên */ } await new Promise((r) => setTimeout(r, 100)); }
  pb = createPb({ url, email: EMAIL, password: PASS });

  const mk = (name, fields) => pb.json("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, type: "base", fields: [...fields, ...auto], ...priv }) });
  await mk("bot_configs", [text("tenant"), text("owner_telegram_chat_id"), text("response_language")]);
  await mk("bookings", [text("tenant"), text("service_name"), text("customer_name"), text("phone"), text("session"), text("extra_json"), date("start"), date("end"), num("party_size"), select("status", ["pending", "confirmed", "cancelled", "blocked"])]);
  await mk("messages", [text("tenant"), text("session"), text("username"), text("text"), bool("is_bot"), json("client_meta")]);
  await mk("pages_config", [text("tenant"), text("platform"), text("page_id"), text("access_token"), bool("is_active")]);
  await mk("post_targets", [text("tenant"), text("platform"), select("status", ["pending", "approved", "scheduled", "published", "error"])]);
  await mk("system_config", [text("telegram_bot_token")]);

  config = { pbUrl: url, pbEmail: EMAIL, pbPassword: PASS, secret: "s".repeat(24), dataDir: dir, tzOffsetMin: 420, backupKeepDays: 14, reminderLeadMin: 120, alertChatId: "ALERT", healthUrls: [], heartbeatUrl: "" };
  sent = { telegram: [], meta: [] };
  const intercept = async (u, init) => {
    if (String(u).startsWith("https://api.telegram.org/")) { sent.telegram.push({ url: String(u), body: JSON.parse(init.body) }); return { ok: true, status: 200 }; }
    if (String(u).startsWith("https://graph.facebook.com/")) { sent.meta.push({ auth: init.headers.Authorization, body: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({}) }; }
    return fetch(u, init);
  };
  // Telegram không có token trong env -> bắt buộc đọc từ system_config thật, đúng như khi chạy trên Coolify.
  const telegram = createTelegram({ getToken: async () => (await pb.list("system_config", { fields: "telegram_bot_token", perPage: 1, maxPages: 1 }))[0]?.telegram_bot_token, fetchImpl: intercept });
  ctx = { config, pb, telegram, fetchImpl: intercept, memory: new Map() };
  scheduler = createScheduler({ jobs: [watchdogJob, backupJob, bookingDigestJob, bookingReminderJob, weeklyReportJob], ctx, tzOffsetMin: 420, statePath: path.join(dir, "state.json"), log: () => {}, onError: () => {} });
});

after(async () => { if (proc) proc.kill(); if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {}); });

const create = (collection, body) => pb.json(`/api/collections/${collection}/records`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const at = (offsetMin) => pbTime(Date.now() + offsetMin * 60000);

test("seed + watchdog + Telegram lấy token từ system_config thật", { skip }, async () => {
  await create("system_config", { telegram_bot_token: "BOT_FROM_PB" });
  await create("bot_configs", { tenant: "spa1", owner_telegram_chat_id: "OWNER1", response_language: "en" });
  await create("bot_configs", { tenant: "spa2", owner_telegram_chat_id: "", response_language: "vi" }); // không có chat id -> bị bỏ qua
  const r = await scheduler.runJob("watchdog");
  assert.equal(r.ok, true);
  await ctx.telegram.send("X", "ping");
  assert.match(sent.telegram.at(-1).url, /botBOT_FROM_PB\/sendMessage/);
  sent.telegram.length = 0;
});

test("booking-digest: bộ lọc thật chỉ lấy đúng tenant, đúng trạng thái, đúng khung thời gian", { skip }, async () => {
  const mkB = (o) => create("bookings", { tenant: "spa1", service_name: "Massage", customer_name: "X", phone: "0900", start: at(90), end: at(150), party_size: 1, status: "confirmed", ...o });
  await mkB({ customer_name: "Lan" });
  await mkB({ customer_name: "Mai", status: "pending", start: at(60 * 20), end: at(60 * 21) });
  await mkB({ customer_name: "HuyDon", status: "cancelled" });
  await mkB({ customer_name: "XaNgay", start: at(60 * 24 * 6), end: at(60 * 24 * 6 + 60) });
  await mkB({ customer_name: "KhachTenantKhac", tenant: "spa2" });
  const r = await scheduler.runJob("booking-digest");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.result, { tenants: 1, sent: 1 }); // spa2 không có chat id nên bị loại
  const text = sent.telegram.at(-1).body.text;
  assert.equal(sent.telegram.at(-1).body.chat_id, "OWNER1");
  assert.match(text, /Lan/);
  for (const loai of ["HuyDon", "XaNgay", "KhachTenantKhac"]) assert.doesNotMatch(text, new RegExp(loai), `${loai} không được xuất hiện`);
  sent.telegram.length = 0;
});

test("booking-reminder: lọc theo cửa sổ thời gian thật, JSON client_meta thật, đánh dấu và không gửi trùng", { skip }, async () => {
  await create("pages_config", { tenant: "spa1", platform: "facebook", page_id: "PAGE_A", access_token: "TOKEN_A", is_active: true });
  await create("pages_config", { tenant: "spa1", platform: "facebook", page_id: "PAGE_B", access_token: "TOKEN_B", is_active: true });
  await create("pages_config", { tenant: "spa1", platform: "facebook", page_id: "PAGE_OFF", access_token: "TOKEN_OFF", is_active: false });
  await create("messages", { tenant: "spa1", session: "facebook:CUS1", username: "CUS1", text: "đặt lịch giúp mình", is_bot: false, client_meta: { page_id: "PAGE_B" } });
  await create("messages", { tenant: "spa1", session: "facebook:CUS1", username: "bot", text: "đã đặt", is_bot: true, client_meta: { page_id: "PAGE_A" } }); // tin của bot không được dùng để tính cửa sổ 24h
  const mk = (o) => create("bookings", { tenant: "spa1", service_name: "Gội đầu", customer_name: "An", phone: "0911", start: at(45), end: at(100), status: "confirmed", session: "facebook:CUS1", ...o });
  const due = await mk({});
  await mk({ customer_name: "QuaXa", start: at(60 * 10), end: at(60 * 11) }); // ngoài cửa sổ 120 phút
  await mk({ customer_name: "ChoXacNhan", status: "pending" });
  await mk({ customer_name: "DaQua", start: at(-60), end: at(-10) });
  const first = await scheduler.runJob("booking-reminder");
  assert.equal(first.ok, true, JSON.stringify(first));
  // Trong cửa sổ 120 phút có 3 lịch confirmed (cả của test trước): An (nhắn được), Lan và khách tenant khác (không có kênh -> chủ nhắc tay).
  assert.deepEqual(first.result, { due: 3, sent: 1, manual: 2 });
  assert.equal(sent.meta.length, 1);
  assert.equal(sent.meta[0].auth, "Bearer TOKEN_B"); // đúng trang theo client_meta.page_id, không phải trang tắt hay trang đầu
  assert.equal(sent.meta[0].body.recipient.id, "CUS1");
  assert.match(sent.meta[0].body.message.text, /^Reminder: An/);
  const saved = await pb.json(`/api/collections/bookings/records/${due.id}`);
  assert.equal(JSON.parse(saved.extra_json).reminder.status, "sent");
  // Bản ghi mồi (quá xa, chờ xác nhận, đã qua, đã huỷ) không bị đụng tới: không có dấu reminder.
  const all = await pb.list("bookings", { filter: "tenant='spa1' || tenant='spa2'", fields: "customer_name,extra_json" });
  const reminded = all.filter((b) => b.extra_json && JSON.parse(b.extra_json).reminder).map((b) => b.customer_name).sort();
  assert.deepEqual(reminded, ["An", "KhachTenantKhac", "Lan"]);
  const second = await scheduler.runJob("booking-reminder");
  assert.deepEqual(second.result, { due: 0, sent: 0, manual: 0 });
  assert.equal(sent.meta.length, 1);
  sent.telegram.length = 0;
});

test("weekly-report: đếm thật bằng totalItems, tách đúng theo tenant", { skip }, async () => {
  await create("post_targets", { tenant: "spa1", platform: "facebook", status: "published" });
  await create("post_targets", { tenant: "spa1", platform: "facebook", status: "published" });
  await create("post_targets", { tenant: "spa1", platform: "facebook", status: "error" });
  await create("post_targets", { tenant: "spa2", platform: "facebook", status: "published" });
  sent.telegram.length = 0;
  const r = await scheduler.runJob("weekly-report");
  assert.equal(r.ok, true, JSON.stringify(r));
  const text = sent.telegram.at(-1).body.text;
  assert.match(text, /Tin nhắn: 2/); // 2 tin vừa tạo của spa1
  assert.match(text, /2 đã đăng, 1 lỗi/);
  // 8 lịch của spa1 trong 7 ngày: 5 xác nhận (Lan, XaNgay, An, QuaXa, DaQua), 2 chờ (Mai, ChoXacNhan), 1 huỷ (HuyDon);
  // khách của spa2 không được tính.
  assert.match(text, /Lịch đặt mới: 8 \(xác nhận 5, chờ 2, huỷ 1\)/);
});

test("pb-backup: API backup thật chấp nhận tên, file tải về là zip hợp lệ, bản trên PocketBase được dọn", { skip }, async () => {
  const r = await scheduler.runJob("pb-backup");
  assert.equal(r.ok, true, JSON.stringify(r));
  const files = await readdir(path.join(dir, "backups"));
  assert.equal(files.length, 1);
  const file = path.join(dir, "backups", files[0]);
  assert.ok((await stat(file)).size > 1024);
  const head = await readFile(file);
  assert.equal(head.subarray(0, 2).toString(), "PK"); // chữ ký file zip
  const remote = await pb.json("/api/backups");
  assert.equal(remote.filter((b) => b.key.startsWith("ops-")).length, 0);
});
