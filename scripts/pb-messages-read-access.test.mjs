import assert from "node:assert/strict";
import test from "node:test";
import { LEGACY_MESSAGE_READ, MEMBERSHIP_MESSAGE_READ, messageReadPatch, migrateMessagesReadAccess } from "./pb-messages-read-access.mjs";

test("only upgrades legacy read rules, never write permissions", () => {
  const collection = { listRule: LEGACY_MESSAGE_READ, viewRule: LEGACY_MESSAGE_READ, createRule: null, updateRule: "custom", deleteRule: null };
  assert.deepEqual(messageReadPatch(collection), { listRule: MEMBERSHIP_MESSAGE_READ, viewRule: MEMBERSHIP_MESSAGE_READ });
  assert.deepEqual(messageReadPatch({ ...collection, listRule: MEMBERSHIP_MESSAGE_READ, viewRule: MEMBERSHIP_MESSAGE_READ }), {});
});

test("refuses locked, public, or custom policies", () => {
  for (const rule of [null, "", "custom"]) {
    assert.throws(() => messageReadPatch({ listRule: rule, viewRule: LEGACY_MESSAGE_READ }), /review before migrating/);
  }
});

test("backs up before applying, checks write rules, and is idempotent", async () => {
  const originalFetch = globalThis.fetch;
  let stored = { id: "messages-id", listRule: LEGACY_MESSAGE_READ, viewRule: LEGACY_MESSAGE_READ, createRule: null, updateRule: "custom", deleteRule: null };
  let backedUp = false;
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === "PATCH") {
      assert.equal(backedUp, true);
      writes++;
      stored = { ...stored, ...JSON.parse(options.body) };
    }
    return Response.json(url.endsWith("tenant_memberships") ? { id: "memberships" } : stored);
  };
  try {
    const options = { pbUrl: "https://pb.example", token: "test", apply: true, backup: async (before) => { assert.equal(before.listRule, LEGACY_MESSAGE_READ); backedUp = true; } };
    assert.equal((await migrateMessagesReadAccess({ ...options, apply: false })).applied, false);
    assert.equal(writes, 0);
    assert.equal((await migrateMessagesReadAccess(options)).applied, true);
    assert.equal((await migrateMessagesReadAccess(options)).changed, false);
    assert.equal(writes, 1);
    assert.equal(stored.updateRule, "custom");
  } finally { globalThis.fetch = originalFetch; }
});
