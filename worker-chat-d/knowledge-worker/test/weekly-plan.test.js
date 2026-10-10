import assert from "node:assert/strict";
import test from "node:test";

import {
  WeeklyPlanError, allocatePillarCounts, assertReadyForGeneration, buildWeeklyMessages, estimateWeeklyUnits,
  interleaveByPillar, isAutoRunDue, localDayAndHour, normalizePillars, normalizePlanConfig, parsePillars, parseWeeklyPosts, pickWeekSlots, serializePlanConfig
} from "../src/domain/content-plans/weeklyPlan.js";

test("normalizePlanConfig dùng mặc định hợp lý và loại giá trị sai", () => {
  const empty = normalizePlanConfig("");
  assert.deepEqual([empty.postsPerWeek, empty.platforms, empty.days, empty.times, empty.timezone], [7, ["facebook"], ["all"], ["09:00", "19:00"], "Asia/Ho_Chi_Minh"]);
  const cfg = normalizePlanConfig(JSON.stringify({
    posts_per_week: 99, platforms: ["facebook", "tiktok", "instagram"], days: ["mon", "xyz"], times: ["8:00", "20:30", "07:15"],
    timezone: "Not/AZone", notes: "x".repeat(900), pillars: [{ name: "Mẹo", weight: 40 }, { name: "mẹo", weight: 10 }, { name: "" }]
  }));
  assert.equal(cfg.postsPerWeek, 21);
  assert.deepEqual(cfg.platforms, ["facebook", "instagram"]);
  assert.deepEqual(cfg.days, ["mon"]);
  assert.deepEqual(cfg.times, ["07:15", "20:30"]);
  assert.equal(cfg.timezone, "Asia/Ho_Chi_Minh");
  assert.equal(cfg.notes.length, 600);
  assert.deepEqual(cfg.pillars.map((p) => p.name), ["Mẹo"]);
});

test("assertReadyForGeneration yêu cầu có nhóm nội dung", () => {
  assert.throws(() => assertReadyForGeneration(normalizePlanConfig({})), WeeklyPlanError);
  assert.doesNotThrow(() => assertReadyForGeneration(normalizePlanConfig({ pillars: [{ name: "A", weight: 1 }] })));
});

test("allocatePillarCounts chia đúng tổng theo trọng số", () => {
  const pillars = [{ weight: 40 }, { weight: 30 }, { weight: 20 }, { weight: 10 }];
  assert.deepEqual(allocatePillarCounts(pillars, 10), [4, 3, 2, 1]);
  assert.equal(allocatePillarCounts(pillars, 7).reduce((a, b) => a + b, 0), 7);
  assert.deepEqual(allocatePillarCounts([{ weight: 1 }, { weight: 1 }, { weight: 1 }], 4), [2, 1, 1]);
  assert.deepEqual(allocatePillarCounts([{ weight: 1 }], 5), [5]);
});

test("interleaveByPillar tránh để cùng nhóm đứng liền nhau khi còn lựa chọn", () => {
  const posts = ["A", "A", "A", "B", "B", "C"].map((pillar, i) => ({ pillar, i }));
  const order = interleaveByPillar(posts).map((p) => p.pillar);
  assert.equal(order.length, 6);
  for (let i = 1; i < order.length - 1; i += 1) assert.notEqual(order[i], order[i - 1]);
  assert.deepEqual([...order].sort(), ["A", "A", "A", "B", "B", "C"]);
});

test("pickWeekSlots lấy các khung giờ trong 7 ngày theo múi giờ và rải đều", () => {
  const config = normalizePlanConfig({ days: ["all"], times: ["09:00", "19:00"], timezone: "Asia/Ho_Chi_Minh" });
  const from = new Date("2026-10-12T00:00:00Z"); // 07:00 giờ VN thứ Hai
  const all = pickWeekSlots({ config, from, count: 99 });
  assert.equal(all.length, 14);
  assert.equal(all[0], "2026-10-12T02:00:00.000Z"); // 09:00 VN
  const seven = pickWeekSlots({ config, from, count: 7 });
  assert.equal(seven.length, 7);
  const days = new Set(seven.map((s) => s.slice(0, 10)));
  assert.ok(days.size >= 6, "7 bài phải trải trên ít nhất 6 ngày khác nhau");
  const weekdaysOnly = pickWeekSlots({ config: normalizePlanConfig({ days: ["mon", "wed"], times: ["10:00"] }), from, count: 5 });
  assert.equal(weekdaysOnly.length, 2);
});

test("estimateWeeklyUnits tính theo chế độ ảnh", () => {
  assert.deepEqual(estimateWeeklyUnits(7, "none"), { write: 14, min: 14, max: 14 });
  assert.deepEqual(estimateWeeklyUnits(7, "ai_only"), { write: 14, min: 70, max: 70 });
  assert.deepEqual(estimateWeeklyUnits(7, "library_first"), { write: 14, min: 21, max: 77 });
  assert.deepEqual(estimateWeeklyUnits(7, "library_only"), { write: 14, min: 21, max: 21 });
});

test("parsePillars chuẩn hoá trọng số về tổng 100 và chịu được code fence", () => {
  const text = "```json\n" + JSON.stringify({ pillars: [{ name: "Mẹo hữu ích", weight: 50, description: "d" }, { name: "Sản phẩm", weight: 30 }, { name: "Tin ngành", weight: 30 }] }) + "\n```";
  const pillars = parsePillars(text);
  assert.equal(pillars.reduce((s, p) => s + p.weight, 0), 100);
  assert.equal(pillars.length, 3);
  assert.throws(() => parsePillars("không có json"), WeeklyPlanError);
  assert.throws(() => parsePillars('{"pillars":[]}'), WeeklyPlanError);
});

test("parseWeeklyPosts khớp tên nhóm, bỏ bài thiếu nội dung và giới hạn độ dài khi có Instagram", () => {
  const pillars = normalizePillars([{ name: "Mẹo hữu ích", weight: 1 }, { name: "Sản phẩm", weight: 1 }]);
  const text = JSON.stringify({ posts: [
    { pillar: "mẹo hữu ích", title: "T1", content: "x".repeat(3000), image_prompt: "a cozy desk" },
    { pillar: "Sản phẩm", title: "T2", content: "nội dung" },
    { pillar: "Sản phẩm", title: "", content: "thiếu tiêu đề" }
  ] });
  const posts = parseWeeklyPosts(text, { pillars, platforms: ["facebook", "instagram"] });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].pillar, "Mẹo hữu ích");
  assert.equal(posts[0].content.length, 2000);
  assert.equal(parseWeeklyPosts(text, { pillars, platforms: ["facebook"] })[0].content.length, 3000);
  assert.throws(() => parseWeeklyPosts('{"posts":[]}', { pillars }), WeeklyPlanError);
});

test("buildWeeklyMessages nêu số bài theo từng nhóm, quy tắc của chủ và danh sách bài đã đăng", () => {
  const config = normalizePlanConfig({ pillars: [{ name: "Mẹo", weight: 2 }, { name: "Khuyến mãi", weight: 1 }], notes: "Xưng 'mình', không dùng emoji", platforms: ["instagram"] });
  const messages = buildWeeklyMessages({ config, counts: [5, 2], businessContext: "Cửa hàng IT", kbTitles: ["Bảng giá"], recentTitles: ["Bài cũ"], languageName: "Vietnamese" });
  assert.match(messages[0].content, /exactly 7 posts/);
  assert.match(messages[0].content, /hashtags/);
  assert.match(messages[0].content, /never mention the knowledge base/);
  assert.match(messages[1].content, /"Mẹo" x 5/);
  assert.match(messages[1].content, /"Khuyến mãi" x 2/);
  assert.match(messages[1].content, /không dùng emoji/);
  assert.match(messages[1].content, /Bài cũ/);
});

test("normalizePlanConfig đọc cấu hình tự chạy hàng tuần với mặc định Chủ nhật 20:00, tắt", () => {
  const off = normalizePlanConfig({});
  assert.deepEqual([off.autoEnabled, off.autoDay, off.autoHour], [false, "sun", 20]);
  const on = normalizePlanConfig({ auto_enabled: true, auto_day: "fri", auto_hour: 7 });
  assert.deepEqual([on.autoEnabled, on.autoDay, on.autoHour], [true, "fri", 7]);
  const bad = normalizePlanConfig({ auto_enabled: "yes", auto_day: "xyz", auto_hour: 99 });
  assert.deepEqual([bad.autoEnabled, bad.autoDay, bad.autoHour], [false, "sun", 20]);
  assert.equal(normalizePlanConfig({ auto_hour: 0 }).autoHour, 0);
});

test("serializePlanConfig rồi normalize lại giữ nguyên cấu hình", () => {
  const original = normalizePlanConfig({ posts_per_week: 5, platforms: ["facebook"], pillars: [{ name: "A", weight: 3 }], auto_enabled: true, auto_day: "mon", auto_hour: 9, notes: "n" });
  const again = normalizePlanConfig(JSON.stringify(serializePlanConfig(original)));
  assert.deepEqual(again, original);
});

test("localDayAndHour và isAutoRunDue tính theo múi giờ của tenant", () => {
  const sundayEvening = new Date("2026-10-11T13:30:00Z"); // 20:30 Chủ nhật giờ VN
  assert.deepEqual(localDayAndHour(sundayEvening, "Asia/Ho_Chi_Minh"), { day: "sun", hour: 20 });
  assert.deepEqual(localDayAndHour(sundayEvening, "UTC"), { day: "sun", hour: 13 });
  const cfg = (extra) => normalizePlanConfig({ auto_enabled: true, auto_day: "sun", auto_hour: 20, timezone: "Asia/Ho_Chi_Minh", ...extra });
  assert.equal(isAutoRunDue(cfg(), sundayEvening), true);
  assert.equal(isAutoRunDue(cfg(), new Date("2026-10-11T12:59:00Z")), false); // 19:59 VN, chưa tới giờ
  assert.equal(isAutoRunDue(cfg(), new Date("2026-10-11T16:30:00Z")), true); // 23:30 VN, chạy bù cùng ngày
  assert.equal(isAutoRunDue(cfg(), new Date("2026-10-11T17:30:00Z")), false); // 00:30 thứ Hai VN
  assert.equal(isAutoRunDue(cfg({ auto_enabled: false }), sundayEvening), false);
  assert.equal(isAutoRunDue(cfg({ timezone: "UTC", auto_hour: 13 }), sundayEvening), true);
});
