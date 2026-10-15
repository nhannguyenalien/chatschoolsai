import test from "node:test";
import assert from "node:assert/strict";
import { youtubePlatformPatch } from "./pb-youtube-schema.mjs";

test("adds youtube to a legacy schema select without touching other fields", () => {
  const col = { name: "pages_config", schema: [{ name: "tenant", type: "text" }, { name: "platform", type: "select", options: { maxSelect: 1, values: ["facebook"] } }] };
  const patch = youtubePlatformPatch(col);
  assert.deepEqual(patch.schema[1].options, { maxSelect: 1, values: ["facebook", "youtube"] });
  assert.deepEqual(patch.schema[0], col.schema[0]);
});

test("supports the PocketBase 0.23+ fields layout", () => {
  const col = { name: "post_targets", fields: [{ name: "platform", type: "select", maxSelect: 1, values: ["facebook"] }] };
  assert.deepEqual(youtubePlatformPatch(col).fields[0].values, ["facebook", "youtube"]);
});

test("is idempotent and ignores text platform fields", () => {
  assert.equal(youtubePlatformPatch({ name: "x", schema: [{ name: "platform", type: "select", options: { values: ["youtube"] } }] }), null);
  assert.equal(youtubePlatformPatch({ name: "x", schema: [{ name: "platform", type: "text" }] }), null);
  assert.throws(() => youtubePlatformPatch({ name: "x", schema: [] }), /platform/);
});
