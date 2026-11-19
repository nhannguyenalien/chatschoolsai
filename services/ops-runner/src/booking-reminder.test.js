import test from "node:test";
import assert from "node:assert/strict";
import { bookingReminderJob, planChannel, reminderText, pickLang, parseExtra } from "./jobs/bookingReminder.js";

const NOW = Date.parse("2026-11-19T03:00:00Z"); // 10:00 VN
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString().replace("T", " ");
const startIn = (min) => new Date(NOW + min * 60000).toISOString().replace("T", " ");

test("planChannel: chỉ Messenger/Instagram trong cửa sổ 24h mới được gửi tự động", () => {
  const ok = planChannel({ session: "facebook:123", lastCustomerMsgAt: hoursAgo(5), nowMs: NOW });
  assert.deepEqual(ok, { via: "facebook", recipientId: "123" });
  assert.equal(planChannel({ session: "instagram:9", lastCustomerMsgAt: hoursAgo(23), nowMs: NOW }).via, "instagram");
  assert.match(planChannel({ session: "facebook:123", lastCustomerMsgAt: hoursAgo(25), nowMs: NOW }).reason, /24h/);
  assert.equal(planChannel({ session: "facebook:comment:5", lastCustomerMsgAt: hoursAgo(1), nowMs: NOW }).via, null);
  assert.equal(planChannel({ session: "3f2a-uuid-web", lastCustomerMsgAt: hoursAgo(1), nowMs: NOW }).via, null);
  assert.equal(planChannel({ session: "facebook:123", lastCustomerMsgAt: undefined, nowMs: NOW }).via, null);
});

test("reminderText: điền tên, dịch vụ, giờ địa phương và đúng ngôn ngữ", () => {
  const b = { start: "2026-11-19 07:30:00.000Z", customer_name: "An", service_name: "Massage" };
  assert.equal(reminderText(b, "vi", 420), "Nhắc lịch: An có lịch Massage lúc 14:30 ngày 19/11. Hẹn gặp bạn! Cần đổi hoặc huỷ, bạn cứ nhắn lại nhé.");
  assert.match(reminderText(b, "en", 420), /^Reminder: An, you have Massage at 14:30 on 19\/11/);
  assert.match(reminderText(b, "ja", 420), /^リマインド/);
  assert.equal(pickLang("auto"), "vi");
  assert.equal(pickLang("EN-us"), "en");
});

test("parseExtra chịu được dữ liệu hỏng", () => {
  assert.deepEqual(parseExtra("không phải json"), {});
  assert.deepEqual(parseExtra("[1,2]"), {});
  assert.deepEqual(parseExtra('{"a":1}'), { a: 1 });
});

function setup({ metaOk = true } = {}) {
  const patched = [], sentMeta = [], telegram = [];
  const bookings = [
    { id: "b1", tenant: "spa", start: startIn(60), customer_name: "An", phone: "090", service_name: "Massage", session: "facebook:111", extra_json: '{"x":1}' },
    { id: "b2", tenant: "spa", start: startIn(30), customer_name: "Bình", phone: "091", service_name: "Gội", session: "web-uuid", extra_json: "" },
    { id: "b3", tenant: "spa", start: startIn(45), customer_name: "Chi", phone: "092", service_name: "Nail", session: "facebook:333", extra_json: '{"reminder":{"status":"sent"}}' },
    { id: "b4", tenant: "spa", start: startIn(50), customer_name: "Dũng", phone: "", service_name: "Spa", session: "facebook:444", extra_json: "" },
  ];
  const pb = {
    async list(collection, { filter = "" } = {}) {
      if (collection === "bookings") return bookings;
      if (collection === "bot_configs") return [{ owner_telegram_chat_id: "owner1", response_language: "en" }];
      if (collection === "pages_config") return [{ page_id: "P1", access_token: "PAGE_TOKEN" }];
      if (collection === "messages") {
        if (filter.includes("facebook:111")) return [{ created: hoursAgo(2), client_meta: '{"page_id":"P1"}' }];
        if (filter.includes("facebook:444")) return [{ created: hoursAgo(30), client_meta: "{}" }]; // ngoài 24h
        return [];
      }
      return [];
    },
    async json(path, init) { patched.push({ path, body: JSON.parse(init.body) }); return {}; },
  };
  const fetchImpl = async (url, init) => {
    sentMeta.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
    return metaOk ? { ok: true, json: async () => ({}) } : { ok: false, status: 400, json: async () => ({ error: { message: "outside window" } }) };
  };
  const ctx = { pb, fetchImpl, now: () => NOW, config: { reminderLeadMin: 120, tzOffsetMin: 420 }, telegram: { send: async (c, m) => telegram.push({ c, m }) } };
  return { ctx, patched, sentMeta, telegram };
}

test("job: gửi khách trong cửa sổ, báo chủ nhắc tay phần còn lại, bỏ qua lịch đã nhắc", async () => {
  const { ctx, patched, sentMeta, telegram } = setup();
  const result = await bookingReminderJob.run(ctx);
  assert.deepEqual(result, { due: 3, sent: 1, manual: 2 }); // b3 đã nhắc nên không tính
  assert.equal(sentMeta.length, 1);
  assert.equal(sentMeta[0].auth, "Bearer PAGE_TOKEN");
  assert.equal(sentMeta[0].body.recipient.id, "111");
  assert.equal(sentMeta[0].body.messaging_type, "RESPONSE");
  assert.match(sentMeta[0].body.message.text, /^Reminder: An, you have Massage at 11:00 on 19\/11/);
  // đánh dấu từng lịch, giữ nguyên trường cũ trong extra_json
  const byId = Object.fromEntries(patched.map((p) => [p.path.split("/").pop(), JSON.parse(p.body.extra_json)]));
  assert.equal(byId.b1.x, 1);
  assert.equal(byId.b1.reminder.status, "sent");
  assert.equal(byId.b2.reminder.status, "manual");
  assert.equal(byId.b4.reminder.status, "manual");
  assert.equal(patched.some((p) => p.path.endsWith("/b3")), false);
  // một tin duy nhất cho chủ, liệt kê 2 khách, có SĐT / không có SĐT
  assert.equal(telegram.length, 1);
  assert.equal(telegram[0].c, "owner1");
  assert.match(telegram[0].m, /Bình — 091/);
  assert.match(telegram[0].m, /Dũng — \(không có SĐT\)/);
  assert.doesNotMatch(telegram[0].m, /An —/);
});

test("job: Meta từ chối thì chuyển sang báo chủ, không bắn lỗi ra ngoài và vẫn đánh dấu để không gửi lại", async () => {
  const { ctx, patched, telegram } = setup({ metaOk: false });
  const result = await bookingReminderJob.run(ctx);
  assert.equal(result.sent, 0);
  assert.equal(result.manual, 3);
  assert.match(telegram[0].m, /gửi lỗi: outside window/);
  assert.equal(patched.length, 3);
});

test("job: không có lịch đến hạn thì không làm gì", async () => {
  const { ctx, patched, telegram } = setup();
  ctx.pb.list = async () => [];
  assert.deepEqual(await bookingReminderJob.run(ctx), { due: 0, sent: 0, manual: 0 });
  assert.equal(patched.length + telegram.length, 0);
});
