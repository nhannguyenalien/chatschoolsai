import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMetaMessageText,
  hasPendingHumanHandoff,
  normalizeMetaAttachments,
  parseMessageClientMeta,
  validateAdminMessagePayload
} from "../src/index.js";

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

test("normalizes Messenger media and renders accessible chat content", () => {
  const attachments = normalizeMetaAttachments([
    { type: "image", payload: { url: "https://cdn.example/photo.jpg" } },
    { type: "audio", payload: { url: "https://cdn.example/note.mp3" } },
    { type: "image", payload: { url: "https://cdn.example/sticker.png", sticker_id: 123 } }
  ]);
  assert.deepEqual(attachments.map(({ type }) => type), ["image", "audio", "sticker"]);
  assert.match(formatMetaMessageText("Xem giúp tôi", attachments), /!\[Ảnh\]\(https:\/\/cdn\.example\/photo\.jpg\)/);
  assert.match(formatMetaMessageText("", attachments), /\[Âm thanh\]\(https:\/\/cdn\.example\/note\.mp3\)/);
  assert.match(formatMetaMessageText("", attachments), /!\[Sticker\]/);
});

test("reads client metadata from PocketBase JSON fields", () => {
  assert.deepEqual(parseMessageClientMeta('{"platform":"facebook","page_id":"p1"}'), { platform: "facebook", page_id: "p1" });
  assert.deepEqual(parseMessageClientMeta("not-json"), {});
});

test("pauses Meta AI while a human handoff is unresolved", () => {
  assert.equal(hasPendingHumanHandoff([
    { needs_human: true, escalation_resolved: false }
  ]), true);
  assert.equal(hasPendingHumanHandoff([
    { needs_human: true, escalation_resolved: true },
    { needs_human: false, escalation_resolved: false }
  ]), false);
  assert.equal(hasPendingHumanHandoff([]), false);
});
