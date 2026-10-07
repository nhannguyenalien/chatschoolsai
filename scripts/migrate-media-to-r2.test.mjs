import test from "node:test";
import assert from "node:assert/strict";
import { r2KeyFor, contentTypeFor, sumByAccount, limitFor, STORAGE_LIMITS } from "./migrate-media-to-r2.mjs";

test("r2KeyFor builds the same key shape as the worker", () => {
  assert.equal(r2KeyFor({ id: "abc123", tenant: "shop", created: "2026-09-27 10:00:00.000Z", file: "ai_171_x7.PNG" }), "shop/2026-09/abc123.png");
  assert.equal(r2KeyFor({ id: "a", tenant: "shop", created: "2026-09-27", file: "x.exe" }), null);
  assert.equal(r2KeyFor({ id: "a", tenant: "", created: "2026-09-27", file: "x.png" }), null);
  assert.equal(contentTypeFor("clip.mp4"), "video/mp4");
});

test("sumByAccount pools workspaces and reports orphans", () => {
  const a = { id: "A" };
  const map = { s1: a, s2: a };
  const { totals, orphans } = sumByAccount(
    [{ tenant: "s1", size_bytes: 10 }, { tenant: "s2", size_bytes: 5 }, { tenant: "gone", size_bytes: 9 }, { tenant: "s1" }],
    t => map[t]
  );
  assert.equal(totals.get("A"), 15);
  assert.deepEqual([...orphans], ["gone"]);
});

test("limitFor matches the worker", () => {
  assert.equal(limitFor({ plan_id: "free" }), STORAGE_LIMITS.free);
  assert.equal(limitFor({ plan_id: "pro" }), 2 * 1024 * 1024 * 1024);
  assert.equal(limitFor({ plan_id: "free", storage_limit_bytes: 7 }), 7);
});
