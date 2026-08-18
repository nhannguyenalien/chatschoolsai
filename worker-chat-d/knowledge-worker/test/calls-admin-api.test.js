import assert from "node:assert/strict";
import test from "node:test";

import { validateAdminCallStartPayload, validateAdminCallJoinPayload } from "../src/index.js";

test("validates an admin call start payload", () => {
  assert.deepEqual(
    validateAdminCallStartPayload({ session: " sess-1 ", cf_session_id: " cf-abc ", track_name: " mic-1 " }),
    { session: "sess-1", cfSessionId: "cf-abc", trackName: "mic-1" }
  );
});

test("rejects admin call start without session or track info", () => {
  assert.equal(validateAdminCallStartPayload({}).error, "Thiếu session");
  assert.equal(
    validateAdminCallStartPayload({ session: "s" }).error,
    "Thiếu thông tin phiên gọi (cf_session_id/track_name)"
  );
});

test("validates an admin call accept payload", () => {
  assert.deepEqual(
    validateAdminCallJoinPayload({ call_id: " call-1 ", cf_session_id: " cf-abc ", track_name: " mic-1 " }),
    { callId: "call-1", cfSessionId: "cf-abc", trackName: "mic-1" }
  );
});

test("rejects admin call accept without call_id or track info", () => {
  assert.equal(validateAdminCallJoinPayload({}).error, "Thiếu call_id");
  assert.equal(
    validateAdminCallJoinPayload({ call_id: "c" }).error,
    "Thiếu thông tin phiên gọi (cf_session_id/track_name)"
  );
});
