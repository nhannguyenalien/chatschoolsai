import test from "node:test";
import assert from "node:assert/strict";
import { normalizePublishSchedule, zonedSlotISO, dayNameInZone, resolveRuleTimeZone, serializePublishSchedule } from "../src/domain/publishing/scheduleRules.js";

test("zonedSlotISO converts local wall time to UTC for several zones", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  assert.equal(zonedSlotISO(now, "UTC", 8, 0), "2026-10-13T08:00:00.000Z");
  assert.equal(zonedSlotISO(now, "Asia/Ho_Chi_Minh", 8, 0), "2026-10-13T01:00:00.000Z");
  assert.equal(zonedSlotISO(now, "Asia/Tokyo", 20, 30), "2026-10-13T11:30:00.000Z");
  assert.equal(zonedSlotISO(now, "America/New_York", 9, 0), "2026-10-13T13:00:00.000Z"); // EDT, UTC-4
});

test("zonedSlotISO uses the local calendar day, not the UTC day", () => {
  const now = new Date("2026-10-13T20:00:00Z"); // 03:00 on the 14th in Ho Chi Minh
  assert.equal(zonedSlotISO(now, "Asia/Ho_Chi_Minh", 8, 0), "2026-10-14T01:00:00.000Z");
  assert.equal(dayNameInZone(now, "Asia/Ho_Chi_Minh"), "wed");
  assert.equal(dayNameInZone(now, "UTC"), "tue");
});

test("zonedSlotISO is correct across a DST change", () => {
  assert.equal(zonedSlotISO(new Date("2026-03-08T12:00:00Z"), "America/New_York", 9, 0), "2026-03-08T13:00:00.000Z");
  assert.equal(zonedSlotISO(new Date("2026-03-07T12:00:00Z"), "America/New_York", 9, 0), "2026-03-07T14:00:00.000Z");
});

test("resolveRuleTimeZone prefers the rule, then the page, then UTC", () => {
  const page = { extra_config: JSON.stringify({ timezone: "Asia/Tokyo" }) };
  assert.equal(resolveRuleTimeZone({ timezone: "Europe/Paris" }, page), "Europe/Paris");
  assert.equal(resolveRuleTimeZone({}, page), "Asia/Tokyo");
  assert.equal(resolveRuleTimeZone({ timezone: "Not/AZone" }, { extra_config: "bad" }), "UTC");
  assert.equal(resolveRuleTimeZone({}, null), "UTC");
});

test("normalizePublishSchedule accepts page_id and timezone and rejects bad values", () => {
  const ok = normalizePublishSchedule({ content_type: "social", times: ["08:00"], page_id: "12345", timezone: "Asia/Ho_Chi_Minh" });
  assert.equal(ok.page_id, "12345");
  assert.equal(ok.timezone, "Asia/Ho_Chi_Minh");
  assert.equal(normalizePublishSchedule({ content_type: "social", times: ["08:00"] }).page_id, undefined);
  assert.throws(() => normalizePublishSchedule({ content_type: "social", times: ["08:00"], page_id: "a b'c" }), /page_id/);
  assert.throws(() => normalizePublishSchedule({ content_type: "social", times: ["08:00"], timezone: "Mars/Base" }), /timezone/);
  assert.throws(() => normalizePublishSchedule({ content_type: "blog", times: ["08:00"], page_id: "1" }), /blog/);
  assert.deepEqual(normalizePublishSchedule({ page_id: "" }, { partial: true }), { page_id: "" });
});

test("serializePublishSchedule exposes page_id and timezone", () => {
  assert.deepEqual(serializePublishSchedule({ id: "r", content_type: "social", days: '["mon"]', times: '["08:00"]', is_active: true, page_id: "9" }),
    { id: "r", content_type: "social", days: ["mon"], times: ["08:00"], is_active: true, page_id: "9", timezone: "" });
});
