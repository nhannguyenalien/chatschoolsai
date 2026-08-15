import test from "node:test";
import assert from "node:assert/strict";
import { buildCadenceSlots, parseCadence, SKILLGO_DAILY_BLOG_CADENCE } from "../src/domain/content-plans/cadence.js";

test("preserves Skillgo's daily 03:00 UTC blog cadence", () => {
  assert.deepEqual(buildCadenceSlots({
    cadence: SKILLGO_DAILY_BLOG_CADENCE, timeZone: "UTC",
    from: "2026-08-05T02:00:00.000Z", until: "2026-08-06T04:00:00.000Z",
  }), ["2026-08-05T03:00:00.000Z", "2026-08-06T03:00:00.000Z"]);
});

test("interprets cadence times in the plan timezone", () => {
  assert.deepEqual(buildCadenceSlots({
    cadence: { days: ["all"], times: ["09:00"] }, timeZone: "Asia/Ho_Chi_Minh",
    from: "2026-08-05T00:00:00.000Z", until: "2026-08-05T04:00:00.000Z",
  }), ["2026-08-05T02:00:00.000Z"]);
});

test("filters weekdays and skips a nonexistent daylight-saving local time", () => {
  assert.deepEqual(buildCadenceSlots({
    cadence: { days: ["sun"], times: ["02:30"] }, timeZone: "America/New_York",
    from: "2026-03-08T00:00:00.000Z", until: "2026-03-09T00:00:00.000Z",
  }), []);
});

test("rejects malformed cadence and timezone values", () => {
  assert.throws(() => parseCadence({ days: ["someday"], times: ["03:00"] }), /weekday/);
  assert.throws(() => parseCadence({ days: ["all"], times: ["25:00"] }), /HH:mm/);
  assert.throws(() => buildCadenceSlots({ cadence: SKILLGO_DAILY_BLOG_CADENCE, timeZone: "Mars/Base", from: new Date(), until: new Date() }), /timezone/);
});
