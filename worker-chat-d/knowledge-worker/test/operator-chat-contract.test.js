import test from "node:test";
import assert from "node:assert/strict";
import { parseOperatorContentToolDirective, validateExactToolArgs, validateOperatorChatRequest } from "../src/index.js";

const requestId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

test("operator chat accepts the bounded request contract", () => {
  assert.deepEqual(validateOperatorChatRequest({
    request_id: requestId,
    session: "cameraai-operator-opaque-a-request-a",
    messages: [{ role: "user", content: "  Liệt kê camera  " }],
  }), {
    requestId,
    session: "cameraai-operator-opaque-a-request-a",
    messages: [{ role: "user", content: "Liệt kê camera" }],
  });
});

test("operator chat rejects invalid ids, oversized history, and oversized content", () => {
  assert.match(validateOperatorChatRequest({ request_id: "not-uuid", session: "s", messages: [{ role: "user", content: "x" }] }).error, /UUID/);
  assert.match(validateOperatorChatRequest({ request_id: requestId, session: "s", messages: Array.from({ length: 21 }, () => ({ role: "user", content: "x" })) }).error, /20/);
  assert.match(validateOperatorChatRequest({ request_id: requestId, session: "s", messages: [{ role: "user", content: "x".repeat(8001) }] }).error, /8\.000/);
});

test("tool args must match the catalog exactly", () => {
  const schema = {
    type: "object",
    properties: { camera_id: { type: "string" }, enabled: { type: "boolean" } },
    required: ["camera_id", "enabled"],
  };
  assert.equal(validateExactToolArgs(schema, { camera_id: "cam-1", enabled: true }), null);
  assert.match(validateExactToolArgs(schema, { camera_id: "cam-1" }), /thiếu/i);
  assert.match(validateExactToolArgs(schema, { camera_id: "cam-1", enabled: true, account_id: "injected" }), /không tồn tại/);
  assert.match(validateExactToolArgs(schema, { camera_id: "cam-1", enabled: "true" }), /sai kiểu/);
  assert.match(validateExactToolArgs({
    type: "object",
    properties: { rules: { type: "array", items: { type: "object", properties: { event: { type: "string" } }, required: ["event"] } } },
    required: ["rules"],
  }, { rules: [{ event: "person", url: "https://attacker.invalid" }] }), /args\.rules\[0\].*không tồn tại/);
});

test("JSON content tool directive is classified instead of returned as an answer", () => {
  assert.deepEqual(parseOperatorContentToolDirective('{"tool":"list_cameras","args":{}}'), {
    directive: { name: "list_cameras", args: {} },
  });
  assert.deepEqual(parseOperatorContentToolDirective('{"name":"set_recording","args":{"camera_id":"cam-1","enabled":true}}'), {
    directive: { name: "set_recording", args: { camera_id: "cam-1", enabled: true } },
  });
});

test("content directive parser rejects malformed or augmented directives", () => {
  assert.match(parseOperatorContentToolDirective('{"tool":"list_cameras"').error, /JSON hợp lệ/);
  assert.match(parseOperatorContentToolDirective('{"tool":"list_cameras","args":{},"url":"https://attacker.invalid"}').error, /trường không hợp lệ/);
  assert.match(parseOperatorContentToolDirective('{"tool":"list_cameras","name":"set_recording","args":{}}').error, /không khớp/);
  assert.deepEqual(parseOperatorContentToolDirective("Câu trả lời bình thường"), { directive: null });
});
