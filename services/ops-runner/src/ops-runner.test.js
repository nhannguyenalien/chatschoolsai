import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, utimes, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { dueSlot, createScheduler } from "./scheduler.js";
import { loadConfig } from "./config.js";
import { formatDigest, localDayStart } from "./jobs/bookingDigest.js";
import { formatWeekly } from "./jobs/weeklyReport.js";
import { pruneOld } from "./jobs/backup.js";
import { watchdogJob } from "./jobs/watchdog.js";
import { authorized } from "./server.js";

const VN = 420;
const utc = (s) => Date.parse(s);

test("loadConfig báo rõ biến thiếu và khoá ngắn", () => {
  assert.throws(() => loadConfig({}), /PB_URL/);
  const base = { PB_URL: "https://pb/", PB_ADMIN_EMAIL: "a", PB_ADMIN_PASS: "b", TELEGRAM_BOT_TOKEN: "t", ALERT_CHAT_ID: "1", RUNNER_SECRET: "short" };
  assert.throws(() => loadConfig(base), /16/);
  const cfg = loadConfig({ ...base, RUNNER_SECRET: "x".repeat(16) });
  assert.equal(cfg.pbUrl, "https://pb");
  assert.equal(cfg.tzOffsetMin, 420);
});

test("dueSlot: job hằng ngày chỉ đến hạn sau giờ hẹn và trong cửa sổ bù 3 tiếng", () => {
  const job = { at: { hour: 7, minute: 0 } };
  assert.equal(dueSlot(job, utc("2026-11-18T23:59:00Z"), VN), null); // 06:59 VN
  assert.equal(dueSlot(job, utc("2026-11-19T00:00:00Z"), VN), "2026-11-19"); // 07:00 VN
  assert.equal(dueSlot(job, utc("2026-11-19T02:59:00Z"), VN), "2026-11-19");
  assert.equal(dueSlot(job, utc("2026-11-19T03:01:00Z"), VN), null); // quá 3 tiếng
});

test("dueSlot: báo cáo tuần chỉ chạy đúng thứ Hai theo giờ địa phương", () => {
  const job = { at: { hour: 8, minute: 0, weekday: 1 } };
  assert.equal(dueSlot(job, utc("2026-11-16T01:00:00Z"), VN), "2026-11-16"); // thứ Hai 08:00 VN
  assert.equal(dueSlot(job, utc("2026-11-17T01:00:00Z"), VN), null); // thứ Ba
});

test("dueSlot: job every chia khe theo thời gian", () => {
  const job = { every: 300000 };
  assert.equal(dueSlot(job, 600000, VN), dueSlot(job, 899999, VN));
  assert.notEqual(dueSlot(job, 600000, VN), dueSlot(job, 900000, VN));
});

test("scheduler: mỗi khe chạy một lần, lỗi được báo và không chạy lặp", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "opsrun-"));
  let t = utc("2026-11-19T00:00:00Z"), runs = 0;
  const errors = [];
  const jobs = [
    { name: "daily", at: { hour: 7, minute: 0 }, run: async () => { runs++; } },
    { name: "boom", every: 60000, run: async () => { throw new Error("hỏng"); } },
  ];
  const s = createScheduler({ jobs, ctx: {}, tzOffsetMin: VN, statePath: path.join(dir, "s.json"), now: () => t, onError: (n, e) => errors.push(`${n}:${e.message}`), log: () => {} });
  await s.tick(); await s.tick();
  assert.equal(runs, 1);
  assert.deepEqual(errors, ["boom:hỏng"]);
  // khởi động lại: trạng thái lưu ra file nên daily không chạy lặp
  const s2 = createScheduler({ jobs, ctx: {}, tzOffsetMin: VN, statePath: path.join(dir, "s.json"), now: () => t, log: () => {}, onError: () => {} });
  await s2.start(1e9); s2.stop();
  assert.equal(runs, 1);
  t += 86400000;
  await s2.tick();
  assert.equal(runs, 2);
});

test("bookingDigest: chia hôm nay/ngày mai theo giờ địa phương và nêu lịch chờ xác nhận", () => {
  const dayStartMs = localDayStart(utc("2026-11-19T00:30:00Z"), VN);
  assert.equal(new Date(dayStartMs).toISOString(), "2026-11-18T17:00:00.000Z");
  const text = formatDigest({
    tenant: "spa1", tzOffsetMin: VN, dayStartMs,
    bookings: [
      { start: "2026-11-19 03:00:00.000Z", customer_name: "An", service_name: "Massage", status: "confirmed", phone: "090" },
      { start: "2026-11-20 02:00:00.000Z", customer_name: "Bình", service_name: "Gội đầu", status: "pending" },
    ],
  });
  assert.match(text, /Hôm nay \(1\):\n• 10:00 An — Massage — 090/);
  assert.match(text, /Ngày mai \(1\):\n• 09:00 Bình.*chờ xác nhận/);
  assert.match(text, /1 lịch đang chờ/);
});

test("weeklyReport: định dạng đủ số liệu, ẩn dòng lỗi khi không có", () => {
  const text = formatWeekly({ tenant: "t", messages: 120, bookings: { total: 9, confirmed: 6, pending: 2, cancelled: 1 }, posts: { published: 5, error: 0 } });
  assert.match(text, /Tin nhắn: 120/);
  assert.match(text, /9 \(xác nhận 6, chờ 2, huỷ 1\)/);
  assert.doesNotMatch(text, /lỗi/);
});

test("pruneOld chỉ xoá file ops-*.zip quá hạn", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "opsbk-"));
  const old = new Date(Date.now() - 20 * 86400000);
  for (const n of ["ops-old.zip", "ops-new.zip", "khac.zip"]) await writeFile(path.join(dir, n), "x");
  await utimes(path.join(dir, "ops-old.zip"), old, old);
  await utimes(path.join(dir, "khac.zip"), old, old);
  assert.deepEqual(await pruneOld(dir, 14), ["ops-old.zip"]);
  assert.deepEqual((await readdir(dir)).sort(), ["khac.zip", "ops-new.zip"]);
});

test("watchdog: báo khi hỏng 2 lần liên tiếp, một lần duy nhất, và báo hồi phục", async () => {
  const sent = [];
  let up = false;
  const ctx = {
    config: { pbUrl: "https://pb", healthUrls: [], alertChatId: "1" },
    telegram: { send: async (_c, m) => sent.push(m) },
    fetchImpl: async () => ({ ok: up }),
    memory: new Map(),
  };
  await watchdogJob.run(ctx);
  assert.equal(sent.length, 0);
  await watchdogJob.run(ctx);
  await watchdogJob.run(ctx);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /Không truy cập được/);
  up = true;
  await watchdogJob.run(ctx);
  assert.equal(sent.length, 2);
  assert.match(sent[1], /hoạt động lại/);
});

test("authorized so khoá đúng, từ chối thiếu/sai", () => {
  const secret = "s".repeat(20);
  assert.equal(authorized(`Bearer ${secret}`, secret), true);
  assert.equal(authorized("Bearer sai", secret), false);
  assert.equal(authorized(undefined, secret), false);
});

import { createTelegram } from "./telegram.js";

test("config: TELEGRAM_BOT_TOKEN và ALERT_CHAT_ID không còn bắt buộc", () => {
  const cfg = loadConfig({ PB_URL: "https://pb", PB_ADMIN_EMAIL: "a", PB_ADMIN_PASS: "b", RUNNER_SECRET: "x".repeat(16) });
  assert.equal(cfg.telegramToken, "");
  assert.equal(cfg.alertChatId, "");
});

test("telegram: token lấy từ system_config, nhớ 5 phút, không có chat id thì chỉ bỏ qua", async () => {
  let lookups = 0, t = 0;
  const urls = [];
  const tg = createTelegram({
    getToken: async () => { lookups++; return "TOKEN_PB"; },
    fetchImpl: async (url) => { urls.push(url); return { ok: true }; },
    now: () => t,
  });
  await tg.send("", "không gửi"); // không chat id -> không gọi gì
  assert.equal(urls.length + lookups, 0);
  await tg.send("1", "a"); await tg.send("1", "b");
  assert.equal(lookups, 1);
  assert.match(urls[0], /botTOKEN_PB/);
  t += 6 * 60 * 1000;
  await tg.send("1", "c");
  assert.equal(lookups, 2);
  const none = createTelegram({ fetchImpl: async () => ({ ok: true }) });
  await assert.rejects(() => none.send("1", "x"), /Chưa có TELEGRAM_BOT_TOKEN/);
});
