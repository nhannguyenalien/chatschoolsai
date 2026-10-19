import test from "node:test";
import assert from "node:assert/strict";
import { dueTargetsFilter, pbDateTime, stalePublishingFilter, upcomingTargetsFilter } from "../src/domain/publishing/pbDate.js";

// PocketBase compares date fields as strings, so emulate that: "scheduled_at <= 'X'" is a plain string comparison.
const stored = (iso) => iso.replace("T", " "); // how PocketBase returns/stores a date
const dueByStringCompare = (scheduledAtIso, filter) => {
  const cutoff = filter.match(/scheduled_at <= '([^']+)'/)[1];
  return stored(scheduledAtIso) <= cutoff;
};

test("pbDateTime uses PocketBase's space format", () => {
  assert.equal(pbDateTime(Date.UTC(2026, 9, 20, 0, 15, 0)), "2026-10-20 00:15:00.000Z");
});

test("a post scheduled for 21:00 is NOT due at 00:15 UTC the same day (regression: 00:15 burst)", () => {
  const filter = dueTargetsFilter(Date.UTC(2026, 9, 20, 0, 15, 0));
  assert.equal(dueByStringCompare("2026-10-20T21:00:00.000Z", filter), false);
  assert.equal(dueByStringCompare("2026-10-20T01:30:00.000Z", filter), false);
  assert.equal(dueByStringCompare("2026-10-19T21:00:00.000Z", filter), true); // yesterday's miss is still due
});

test("a post becomes due exactly when its time arrives", () => {
  const at = "2026-10-20T12:00:00.000Z";
  assert.equal(dueByStringCompare(at, dueTargetsFilter(Date.UTC(2026, 9, 20, 11, 59, 59))), false);
  assert.equal(dueByStringCompare(at, dueTargetsFilter(Date.UTC(2026, 9, 20, 12, 0, 0))), true);
  assert.equal(dueByStringCompare(at, dueTargetsFilter(Date.UTC(2026, 9, 20, 12, 15, 0))), true);
});

test("the old ISO-with-T filter is what caused the bug", () => {
  const oldCutoff = new Date(Date.UTC(2026, 9, 20, 0, 15, 0)).toISOString(); // "2026-10-20T00:15:00.000Z"
  assert.equal(stored("2026-10-20T21:00:00.000Z") <= oldCutoff, true); // wrongly due
});

test("filters never contain an ISO 'T' timestamp and keep the tenant clause and the empty scheduled_at guard", () => {
  const now = Date.UTC(2026, 9, 20, 5, 0, 0);
  const due = dueTargetsFilter(now, "tenant='chatschoolai'");
  assert.match(due, /^tenant='chatschoolai' && \(status='approved'/);
  assert.match(due, /scheduled_at != ''/);
  for (const f of [due, upcomingTargetsFilter(now, 60), stalePublishingFilter(now, 30 * 60 * 1000, "tenant='x'")]) {
    assert.doesNotMatch(f, /\d{4}-\d{2}-\d{2}T\d{2}:/);
  }
});

test("upcoming window and stale cutoff use the right bounds", () => {
  const now = Date.UTC(2026, 9, 20, 5, 0, 0);
  assert.equal(upcomingTargetsFilter(now, 60), "status='scheduled' && scheduled_at != '' && scheduled_at > '2026-10-20 05:00:00.000Z' && scheduled_at <= '2026-10-20 06:00:00.000Z'");
  assert.equal(stalePublishingFilter(now, 30 * 60 * 1000), "status='publishing' && updated <= '2026-10-20 04:30:00.000Z'");
});
