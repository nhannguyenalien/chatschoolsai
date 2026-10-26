import assert from "node:assert/strict";
import test from "node:test";

import { BOOKING_TEMPLATES, checkSlot, findFreeTimes, findService, normalizePhone, normalizeSettings, parseLocal, slotWindow } from "../src/domain/booking/availability.js";
import { buildIcs, feedToken, verifyFeedToken } from "../src/domain/booking/ics.js";
import { createBookingTools } from "../src/workflows/booking/bookingTools.js";

const NOW = new Date("2026-10-26T01:00:00Z"); // 08:00 giờ VN
const iso = (date, time) => parseLocal(date, time, 420).toISOString();

function fakeRepo({ settings = {}, services = [], resources = [], bookings = [] } = {}) {
  const rows = [...bookings];
  return {
    rows,
    getSettings: async () => settings,
    listServices: async () => services,
    listResources: async () => resources,
    listBookings: async () => rows.filter((b) => b.status !== "cancelled"),
    listUpcomingByPhone: async (_t, phone) => rows.filter((b) => b.phone === phone && ["pending", "confirmed"].includes(b.status)),
    findByIdempotencyKey: async (_t, key) => rows.find((b) => b.idempotency_key === key) || null,
    createBooking: async (record) => { const row = { id: `rec${String(rows.length + 1).padStart(9, "0")}`, ...record }; rows.push(row); return row; },
    updateBooking: async (id, patch) => Object.assign(rows.find((b) => b.id === id), patch),
  };
}

const spa = BOOKING_TEMPLATES.spa;
const spaServices = spa.services.map((s, i) => ({ id: `s${i}`, ...s }));
const spaResources = spa.resources.map((r, i) => ({ id: `r${i}`, ...r }));
const spaSettings = { ...spa.settings };

test("parseLocal đổi giờ cơ sở sang UTC và từ chối ngày không có thật", () => {
  assert.equal(parseLocal("2026-10-27", "10:00", 420).toISOString(), "2026-10-27T03:00:00.000Z");
  assert.equal(parseLocal("2026-02-31", "10:00", 420), null);
  assert.equal(parseLocal("2026-10-27", "25:00", 420), null);
});

test("findService khớp không dấu, dịch vụ mặc định khi chưa khai báo", () => {
  const settings = normalizeSettings({});
  assert.equal(findService(spaServices, "cham soc da", settings).service.name, "Chăm sóc da mặt");
  assert.equal(findService(spaServices, "", settings).error, "service_required");
  assert.equal(findService(spaServices, "xe ôm", settings).error, "service_not_found");
  assert.equal(findService([], "", settings).service.name, "Đặt chỗ");
});

test("normalizePhone gộp +84 và 0", () => {
  assert.equal(normalizePhone("+84 912 345 678"), "0912345678");
  assert.equal(normalizePhone("0912.345.678"), "0912345678");
});

test("sức chứa 1: kỹ thuật viên bận thì gán người còn lại, hết người thì full", () => {
  const settings = normalizeSettings(spaSettings);
  const service = spaServices[0];
  const win = slotWindow(service, "2026-10-27", "10:00", 1, settings);
  const busy = (resource_id) => ({ status: "confirmed", resource_id, party_size: 1, start: iso("2026-10-27", "10:30"), end: iso("2026-10-27", "11:30") });
  const base = { service, resources: spaResources, settings, ...win, now: NOW };
  assert.equal(checkSlot({ ...base, bookings: [] }).resource.id, "r0");
  assert.equal(checkSlot({ ...base, bookings: [busy("r0")] }).resource.id, "r1");
  assert.equal(checkSlot({ ...base, bookings: [busy("r0"), busy("r1")] }).reason, "full");
  const adjacent = { status: "confirmed", resource_id: "r0", party_size: 1, start: iso("2026-10-27", "09:00"), end: iso("2026-10-27", "10:00") };
  assert.equal(checkSlot({ ...base, bookings: [adjacent] }).resource.id, "r0");
});

test("giờ phục vụ, ngày nghỉ, đặt quá sát giờ và booking bị huỷ", () => {
  const clinic = BOOKING_TEMPLATES.clinic;
  const settings = normalizeSettings(clinic.settings);
  const service = { id: "c", ...clinic.services[0] };
  const resources = [{ id: "d", ...clinic.resources[0] }];
  const check = (date, time, bookings = []) => checkSlot({ service, resources, bookings, settings, ...slotWindow(service, date, time, 1, settings), now: NOW });
  assert.equal(check("2026-10-27", "07:00").reason, "outside_hours");
  assert.equal(check("2026-10-27", "16:50").reason, "outside_hours");
  assert.equal(check("2026-11-01", "09:00").reason, "closed_day"); // Chủ nhật
  assert.equal(check("2026-10-26", "08:30").reason, "too_soon");
  assert.equal(check("2026-10-27", "09:00", [{ status: "cancelled", resource_id: "d", party_size: 1, start: iso("2026-10-27", "09:00"), end: iso("2026-10-27", "09:20") }]).ok, true);
});

test("nhà hàng cộng dồn số khách theo sức chứa", () => {
  const r = BOOKING_TEMPLATES.restaurant;
  const settings = normalizeSettings(r.settings);
  const service = { id: "t", ...r.services[0] };
  const resources = [{ id: "main", ...r.resources[0] }];
  const at = (qty, party) => checkSlot({ service, resources, settings, quantity: qty, now: NOW, ...slotWindow(service, "2026-10-27", "19:00", 1, settings),
    bookings: [{ status: "confirmed", resource_id: "main", party_size: party, start: iso("2026-10-27", "19:30"), end: iso("2026-10-27", "21:00") }] });
  assert.equal(at(10, 30).ok, true);
  assert.equal(at(11, 30).reason, "full");
  assert.equal(at(41, 0).reason, "too_large");
});

test("khách sạn theo đêm: trả phòng 12:00 không đụng nhận phòng 14:00, blocked chặn cả loại phòng", () => {
  const h = BOOKING_TEMPLATES.hotel;
  const settings = normalizeSettings(h.settings);
  const service = { id: "p", ...h.services[0] };
  const resources = [{ id: "std", name: "Standard", group: "Standard", capacity: 2 }];
  const stay = (nights) => slotWindow(service, "2026-10-28", "", nights, settings);
  const existing = [{ status: "confirmed", resource_id: "std", party_size: 2, start: iso("2026-10-26", "14:00"), end: iso("2026-10-28", "12:00") }];
  assert.equal(checkSlot({ service, resources, settings, bookings: existing, ...stay(2), now: NOW }).ok, true);
  const overlap = [{ status: "confirmed", resource_id: "std", party_size: 2, start: iso("2026-10-28", "14:00"), end: iso("2026-10-29", "12:00") }];
  assert.equal(checkSlot({ service, resources, settings, bookings: overlap, ...stay(2), now: NOW }).reason, "full");
  const blocked = [{ status: "blocked", resource_id: "", start: iso("2026-10-29", "00:00"), end: iso("2026-10-30", "00:00") }];
  assert.equal(checkSlot({ service, resources, settings, bookings: blocked, ...stay(2), now: NOW }).reason, "full");
});

test("findFreeTimes bỏ giờ đã kín", () => {
  const settings = normalizeSettings(spaSettings);
  const service = spaServices[0];
  const full = (id) => ({ status: "confirmed", resource_id: id, party_size: 1, start: iso("2026-10-27", "09:00"), end: iso("2026-10-27", "10:00") });
  const times = findFreeTimes({ service, resources: spaResources, bookings: [full("r0"), full("r1")], settings, dateStr: "2026-10-27", now: NOW });
  assert.ok(!times.includes("09:00") && !times.includes("09:30"));
  assert.equal(times[0], "10:00");
});

test("tool create_booking: đặt, chống đặt trùng, hết chỗ, huỷ, báo chủ", async () => {
  const repository = fakeRepo({ settings: spaSettings, services: spaServices, resources: [spaResources[0]] });
  const messages = [];
  const tools = createBookingTools({ repository, tenant: "t1", session: "sess", now: () => NOW, notifyOwner: async (m) => messages.push(m) });
  const run = async (name, args) => JSON.parse(await tools.execute(name, args));
  const args = { service: "massage", date: "2026-10-27", time: "10:00", customer_name: "Lan", phone: "0912345678" };

  assert.equal((await run("check_availability", { service: "massage", date: "2026-10-27" })).available, true);
  const booked = await run("create_booking", args);
  assert.equal(booked.booked, true);
  assert.equal(booked.status, "confirmed");
  assert.equal(repository.rows[0].resource_id, "r0");
  assert.equal(messages.length, 1);

  assert.equal((await run("create_booking", args)).duplicate, true);
  assert.equal(repository.rows.length, 1);

  const other = await run("create_booking", { ...args, phone: "0987654321", customer_name: "Mai" });
  assert.equal(other.booked, false);
  assert.equal(other.reason, "full");
  const alt = await run("check_availability", { service: "massage", date: "2026-10-27", time: "10:00" });
  assert.equal(alt.available, false);
  assert.ok(alt.suggested_times.includes("11:00"));

  assert.equal((await run("cancel_booking", { phone: "0000000000" })).cancelled, false);
  assert.equal((await run("cancel_booking", { phone: "+84912345678", code: booked.code })).cancelled, true);
  assert.equal(repository.rows[0].status, "cancelled");
  assert.equal((await run("create_booking", { ...args, phone: "0987654321", customer_name: "Mai" })).booked, true);
});

test("tool từ chối thông tin thiếu/sai và manual_confirm chuyển sang pending", async () => {
  const repository = fakeRepo({ settings: { ...spaSettings, manual_confirm: true }, services: spaServices, resources: spaResources });
  const tools = createBookingTools({ repository, tenant: "t1", now: () => NOW });
  const run = async (name, args) => JSON.parse(await tools.execute(name, args));
  assert.equal((await run("create_booking", { service: "massage", date: "2026-10-27", time: "10:00", customer_name: "", phone: "0912345678" })).error, "missing_name");
  assert.equal((await run("create_booking", { service: "massage", date: "2026-10-27", time: "10:00", customer_name: "A", phone: "12" })).error, "invalid_phone");
  assert.equal((await run("create_booking", { service: "massage", date: "2026-10-27", customer_name: "A", phone: "0912345678" })).error, "missing_time");
  assert.equal((await run("create_booking", { service: "xe ôm", date: "2026-10-27", time: "10:00", customer_name: "A", phone: "0912345678" })).error, "service_not_found");
  assert.equal((await run("create_booking", { service: "massage", date: "2026-10-27", time: "10:00", customer_name: "A", phone: "0912345678" })).status, "pending");
  assert.equal((await run("nope", {})).error, "unknown_tool");
});

test("ICS bỏ lịch huỷ, escape ký tự đặc biệt; token HMAC ổn định", async () => {
  const ics = buildIcs({ calendarName: "Spa", now: NOW, bookings: [
    { id: "a1", status: "confirmed", service_name: "Massage", customer_name: "Lan, Nguyễn", party_size: 2, phone: "0912345678", start: iso("2026-10-27", "10:00"), end: iso("2026-10-27", "11:00") },
    { id: "a2", status: "cancelled", start: iso("2026-10-27", "12:00"), end: iso("2026-10-27", "13:00") },
  ] });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20261027T030000Z/);
  assert.match(ics, /Lan\\, Nguy/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  const token = await feedToken("t1", "secret");
  assert.equal(await verifyFeedToken("t1", "secret", token), true);
  assert.equal(await verifyFeedToken("t2", "secret", token), false);
  assert.equal(await verifyFeedToken("t1", "secret", "bad"), false);
});

import { BookingAdminError, blockTime, createManual, loadOverview, setStatus, setupFromTemplate } from "../src/workflows/booking/bookingAdmin.js";

function adminRepo(initial = {}) {
  const base = fakeRepo(initial);
  const store = { settings: initial.settings ?? null, created: [] };
  return Object.assign(base, {
    store,
    getSettings: async () => store.settings,
    createRecord: async (collection, record) => { store.created.push([collection, record]); if (collection === "booking_settings") store.settings = record; return record; },
    getBooking: async (id) => { const row = base.rows.find((b) => b.id === id); if (!row) throw new Error("404"); return row; },
    listBookings: async () => base.rows,
  });
}

test("setupFromTemplate điền sẵn cấu hình theo ngành và không ghi đè lần hai", async () => {
  const repo = adminRepo();
  assert.deepEqual(await setupFromTemplate(repo, "t1", "hotel"), { created: true });
  assert.deepEqual(repo.store.created.map((c) => c[0]), ["booking_settings", "booking_services", "booking_resources"]);
  assert.deepEqual(await setupFromTemplate(repo, "t1", "hotel"), { created: false });
  assert.equal(repo.store.created.length, 3);
  await assert.rejects(() => setupFromTemplate(repo, "t1", "casino"), BookingAdminError);
});

test("loadOverview báo enabled=false khi chưa bật và giới hạn khoảng xem", async () => {
  assert.deepEqual(await loadOverview(adminRepo(), "t1", "2026-10-26T00:00:00Z", "2026-11-02T00:00:00Z"), { enabled: false });
  const repo = adminRepo({ settings: spaSettings, services: spaServices, resources: spaResources });
  const overview = await loadOverview(repo, "t1", "2026-10-26T00:00:00Z", "2026-11-02T00:00:00Z");
  assert.equal(overview.enabled, true);
  assert.equal(overview.services.length, 2);
  await assert.rejects(() => loadOverview(repo, "t1", "2026-01-01T00:00:00Z", "2026-12-01T00:00:00Z"), /62/);
  await assert.rejects(() => loadOverview(repo, "t1", "nope", "2026-12-01T00:00:00Z"), BookingAdminError);
});

test("thêm tay dùng chung luật sức chứa, chặn lịch làm hết chỗ, huỷ chỉ trong đúng tenant", async () => {
  const repo = adminRepo({ settings: spaSettings, services: spaServices, resources: [spaResources[0]] });
  const now = () => NOW;
  const input = { service: "massage", date: "2026-10-27", time: "10:00", customer_name: "Lan", phone: "0912345678" };
  const made = await createManual(repo, "t1", input, now);
  assert.equal(made.booked, true);
  assert.equal(repo.rows[0].source, "dashboard");
  await assert.rejects(() => createManual(repo, "t1", { ...input, phone: "0987654321" }, now), (e) => e.status === 409);

  const block = await blockTime(repo, "t1", { date: "2026-10-27", time_from: "13:00", time_to: "15:00", note: "Nghỉ" });
  assert.equal(repo.rows.at(-1).status, "blocked");
  assert.equal(block.date, "2026-10-27");
  await assert.rejects(() => createManual(repo, "t1", { ...input, time: "13:30", phone: "0900000000" }, now), (e) => /chỗ/.test(e.message));
  await assert.rejects(() => blockTime(repo, "t1", { date: "2026-10-27", time_from: "15:00", time_to: "13:00" }), BookingAdminError);
  await assert.rejects(() => blockTime(repo, "t1", { date: "2026-10-27", resource_id: "nope" }), (e) => e.status === 404);

  const id = repo.rows[0].id;
  repo.rows[0].tenant = "t1";
  await assert.rejects(() => setStatus(repo, "other", id, "cancelled"), (e) => e.status === 404);
  await assert.rejects(() => setStatus(repo, "t1", id, "blocked"), BookingAdminError);
  assert.deepEqual(await setStatus(repo, "t1", id, "cancelled"), { id, status: "cancelled" });
  assert.equal(repo.rows[0].status, "cancelled");
});

test("PocketBase lưu number chưa nhập thành 0: cấu hình 0 dùng mặc định, mẫu ngành ghi đủ giá trị", () => {
  const fromPb = normalizeSettings({ tz_offset_min: 0, min_notice_min: 0, slot_step_min: 0, default_capacity: 0, default_duration_min: 0, open_time: "09:00", close_time: "21:00" });
  assert.equal(fromPb.tz_offset_min, 420);
  assert.equal(fromPb.min_notice_min, 60);
  assert.equal(fromPb.slot_step_min, 30);
  assert.equal(fromPb.default_capacity, 1);
  for (const [name, template] of Object.entries(BOOKING_TEMPLATES)) {
    for (const key of ["tz_offset_min", "min_notice_min", "slot_step_min", "default_capacity", "default_duration_min", "open_time", "close_time"]) {
      assert.ok(template.settings[key], `${name}.${key}`);
    }
  }
});

test("dateHint báo thứ/ngày/giờ hiện tại theo múi giờ cơ sở", async () => {
  const tools = createBookingTools({ repository: fakeRepo({ settings: spaSettings, services: spaServices }), tenant: "t1", now: () => NOW });
  const hint = await tools.dateHint();
  assert.match(hint, /Thứ hai, ngày 2026-10-26, 08:00 \(UTC\+7\)/);
});

import { TEMPLATE_KEYS, buildTemplate } from "../src/domain/booking/templates.js";
import { BOOKING_LANGS, cancelledNotice, newBookingNotice, pickLang, reasonText } from "../src/domain/booking/i18n.js";
import { applyBookingConfig, describeBookingConfig } from "../src/workflows/booking/bookingAdmin.js";

test("12 mẫu ngành đủ 6 ngôn ngữ, tên không để sót chỗ giữ {n} và nhóm nội bộ không bị dịch", () => {
  assert.equal(TEMPLATE_KEYS.length, 12);
  for (const key of TEMPLATE_KEYS) {
    const vi = buildTemplate(key, "vi");
    for (const lang of BOOKING_LANGS) {
      const t = buildTemplate(key, lang);
      assert.equal(t.services.length, vi.services.length);
      assert.equal(t.resources.length, vi.resources.length);
      for (const item of [...t.services, ...t.resources]) assert.ok(item.name && !item.name.includes("{n}") && !item.name.includes("|"), `${key}/${lang}: ${item.name}`);
      assert.deepEqual(t.resources.map((r) => r.group), vi.resources.map((r) => r.group));
      assert.deepEqual(t.services.map((s) => s.resource_group), vi.services.map((s) => s.resource_group));
    }
    assert.notEqual(buildTemplate(key, "ja").services[0].name, vi.services[0].name);
  }
  assert.deepEqual(buildTemplate("sports", "en").resources.map((r) => r.name), ["Court 1", "Court 2", "Court 3", "Court 4"]);
});

test("mỗi mẫu ngành chạy được thật: có chỗ trống trong giờ làm việc ở mọi ngôn ngữ", () => {
  for (const key of TEMPLATE_KEYS) {
    const t = buildTemplate(key, "en");
    const settings = normalizeSettings(t.settings);
    const resources = t.resources.map((r, i) => ({ id: `r${i}`, ...r }));
    for (const s of t.services) {
      const service = { id: s.name, ...s };
      if (service.unit === "night") {
        const win = slotWindow(service, "2026-11-10", "", 2, settings);
        assert.equal(checkSlot({ service, resources, bookings: [], settings, ...win, now: NOW }).ok, true, `${key}/${s.name}`);
      } else {
        assert.ok(findFreeTimes({ service, resources, bookings: [], settings, dateStr: "2026-11-10", now: NOW }).length > 0, `${key}/${s.name}`);
      }
    }
  }
});

test("thông báo và lỗi có đủ 6 ngôn ngữ, ngôn ngữ lạ/auto rơi về mặc định", () => {
  assert.equal(pickLang("auto"), "en");
  assert.equal(pickLang("ja-JP"), "ja");
  assert.equal(pickLang("xx", "vi"), "vi");
  for (const lang of BOOKING_LANGS) {
    for (const reason of ["invalid_time", "past", "too_soon", "closed_day", "outside_hours", "too_large", "full"]) assert.ok(reasonText(reason, lang).length > 3, `${lang}/${reason}`);
    assert.doesNotMatch(newBookingNotice(lang, { status: "confirmed", service: "S", when: "d t", qty: 2, name: "N", phone: "P", code: "C" }), /\{|undefined/);
    assert.doesNotMatch(cancelledNotice(lang, { service: "S", when: "w", code: "C" }), /\{|undefined/);
  }
  assert.match(newBookingNotice("ja", { status: "pending", service: "S", when: "w", qty: 1, name: "N", phone: "P", code: "C" }), /確認待ち/);
  assert.match(reasonText("full", "fr"), /Complet/);
});

test("tool trả văn bản theo ngôn ngữ cấu hình và báo chủ theo ngôn ngữ chủ", async () => {
  const repository = fakeRepo({ settings: spaSettings, services: spaServices, resources: [spaResources[0]] });
  const notes = [];
  const tools = createBookingTools({ repository, tenant: "t1", session: "s", lang: "es", ownerLang: "ko", now: () => NOW, notifyOwner: async (m) => notes.push(m) });
  const run = async (name, args) => JSON.parse(await tools.execute(name, args));
  const args = { service: "massage", date: "2026-10-27", time: "10:00", customer_name: "Ana", phone: "0912345678" };
  assert.match((await run("create_booking", args)).message, /con éxito/);
  assert.match(notes[0], /새 예약/);
  assert.match((await run("create_booking", { ...args, phone: "0900000009" })).message, /Completo/);
  assert.match((await run("create_booking", { ...args, customer_name: "" })).message, /nombre/);
});

test("applyBookingConfig: cấu hình từ hội thoại, ghi đè theo tên không dấu, replace tắt mục cũ", async () => {
  const store = { settings: null, services: [], resources: [], seq: 0 };
  const repo = {
    getSettings: async () => store.settings,
    listServices: async () => store.services,
    listResources: async () => store.resources,
    createRecord: async (c, r) => { const row = { id: `x${++store.seq}`, ...r }; if (c === "booking_settings") store.settings = row; else store[c === "booking_services" ? "services" : "resources"].push(row); return row; },
    updateRecord: async (c, id, patch) => { const list = c === "booking_settings" ? [store.settings] : store[c === "booking_services" ? "services" : "resources"]; Object.assign(list.find((x) => x.id === id), patch); },
  };
  const first = await applyBookingConfig(repo, "t1", {
    business_type: "pickleball", open_time: "6:00", close_time: "22:00", slot_step_min: 60, closed_days: [0],
    services: [{ name: "Thuê sân 1 giờ", duration_min: 60, price_text: "150k", resource_group: "court" }],
    resources: [{ name: "Sân 1", group: "court" }, { name: "Sân 2", group: "court", capacity: 1 }],
  });
  assert.deepEqual(first.services, { created: 1, updated: 0, deactivated: 0 });
  assert.deepEqual(first.resources, { created: 2, updated: 0, deactivated: 0 });
  assert.equal(store.settings.open_time, "06:00");
  assert.equal(store.settings.closed_days, "0");
  assert.equal(store.settings.tz_offset_min, 420);

  const second = await applyBookingConfig(repo, "t1", { default_capacity: 2, services: [{ name: "thue san 1 gio", duration_min: 90 }, { name: "Thuê sân 2 giờ", duration_min: 120, resource_group: "court" }], resources: [{ name: "Sân 1", group: "court" }], replace: true });
  assert.deepEqual(second.services, { created: 1, updated: 1, deactivated: 0 });
  assert.deepEqual(second.resources, { created: 0, updated: 1, deactivated: 1 });
  assert.equal(store.services[0].duration_min, 90);
  assert.equal(store.resources.find((r) => r.name === "Sân 2").status, "inactive");
  const snapshot = await describeBookingConfig(repo, "t1");
  assert.equal(snapshot.resources.length, 1);
  assert.equal(snapshot.settings.default_capacity, 2);

  const odd = await applyBookingConfig(repo, "t1", { open_time: "25:99", slot_step_min: 1, default_capacity: -3 });
  assert.deepEqual(odd, {});
  assert.equal(store.settings.open_time, "06:00");
  assert.equal(store.settings.slot_step_min, 60);
  const tpl = await applyBookingConfig({ ...repo, getSettings: async () => null }, "t2", { template: "salon" }, "ja");
  assert.equal(tpl.services.created, 3);
  assert.ok(store.services.some((s) => s.name === "ヘアカット"));
  await assert.rejects(() => applyBookingConfig(repo, "t1", { template: "casino" }), BookingAdminError);
});
