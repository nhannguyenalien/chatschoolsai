import assert from "node:assert/strict";
import test from "node:test";

import { validateAdminMessagePayload } from "../src/index.js";

test("validates and normalizes an admin reply", () => {
  assert.deepEqual(
    validateAdminMessagePayload({ session: " session-1 ", text: " Xin chào " }),
    { session: "session-1", text: "Xin chào" }
  );
});

test("rejects blank and oversized admin replies", () => {
  assert.equal(validateAdminMessagePayload({ session: "s", text: "  " }).error, "Nội dung phản hồi không được để trống");
  assert.equal(validateAdminMessagePayload({ session: "", text: "ok" }).error, "Thiếu session");
  assert.equal(validateAdminMessagePayload({ session: "s", text: "x".repeat(10001) }).error, "Nội dung phản hồi quá dài");
});
