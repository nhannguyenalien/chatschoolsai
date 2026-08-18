import assert from "node:assert/strict";
import test from "node:test";

import { validateCallStatePayload } from "../src/index.js";

test("validates a call start payload", () => {
  assert.deepEqual(
    validateCallStatePayload({
      tenant: " bds ", session: " sess-1 ", action: "start",
      cf_session_id: " cf-abc ", track_name: " mic-1 "
    }),
    { tenant: "bds", session: "sess-1", action: "start", cfSessionId: "cf-abc", trackName: "mic-1", reason: "" }
  );
});

test("validates a call end payload without track info", () => {
  assert.deepEqual(
    validateCallStatePayload({ tenant: "bds", session: "sess-1", action: "end", reason: "hangup" }),
    { tenant: "bds", session: "sess-1", action: "end", cfSessionId: "", trackName: "", reason: "hangup" }
  );
});

test("rejects missing tenant/session and invalid action", () => {
  assert.equal(validateCallStatePayload({ session: "s", action: "start" }).error, "Thiếu tenant");
  assert.equal(validateCallStatePayload({ tenant: "t", action: "start" }).error, "Thiếu session");
  assert.equal(validateCallStatePayload({ tenant: "t", session: "s", action: "bogus" }).error, "Hành động không hợp lệ");
});

test("rejects start/join without cf_session_id or track_name", () => {
  assert.equal(
    validateCallStatePayload({ tenant: "t", session: "s", action: "start" }).error,
    "Thiếu thông tin phiên gọi (cf_session_id/track_name)"
  );
  assert.equal(
    validateCallStatePayload({ tenant: "t", session: "s", action: "join", cf_session_id: "x" }).error,
    "Thiếu thông tin phiên gọi (cf_session_id/track_name)"
  );
});
