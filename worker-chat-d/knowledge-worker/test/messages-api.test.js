import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMetaMessageText,
  formatOutboundMessageText,
  hasPendingHumanHandoff,
  normalizeOutboundMedia,
  normalizeMetaAttachments,
  parseMessageClientMeta,
  validateAdminMessagePayload
} from "../src/index.js";

test("validates and normalizes an admin reply", () => {
  assert.deepEqual(
    validateAdminMessagePayload({ session: " session-1 ", text: " Xin chào " }),
    { session: "session-1", text: "Xin chào", media: [] }
  );
});

test("rejects blank and oversized admin replies", () => {
  assert.equal(validateAdminMessagePayload({ session: "s", text: "  " }).error, "Nội dung phản hồi hoặc media không được để trống");
  assert.equal(validateAdminMessagePayload({ session: "", text: "ok" }).error, "Thiếu session");
  assert.equal(validateAdminMessagePayload({ session: "s", text: "x".repeat(10001) }).error, "Nội dung phản hồi quá dài");
});

test("accepts media-only replies and formats them for chat history", () => {
  const result = validateAdminMessagePayload({
    session: "whatsapp:84901234567",
    media: [{ type: "video", url: "https://cdn.example/demo.mp4", caption: "Demo" }]
  });
  assert.equal(result.error, undefined);
  assert.equal(result.media[0].type, "video");
  assert.equal(formatOutboundMessageText("", result.media), "[Demo](https://cdn.example/demo.mp4)");
});

test("rejects unsafe outbound media URLs", () => {
  const result = validateAdminMessagePayload({ session: "s", media: [{ type: "image", url: "http://127.0.0.1/private.jpg" }] });
  assert.match(result.error, /Media không hợp lệ/);
  assert.throws(() => normalizeOutboundMedia(Array.from({ length: 11 }, (_, i) => `https://cdn.example/${i}.jpg`)), /tối đa 10/);
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

test("lastResponderOf: AI mặc định, nhân viên chỉ chiếm phiên khi họ là người lên tiếng gần nhất", async () => {
  const { lastResponderOf } = await import("../src/index.js");
  const customer = { is_bot: false, username: "123" };
  const ai = { is_bot: true, username: "Alien Bot", needs_human: true, escalation_resolved: false };
  const staff = { is_bot: true, username: "Admin" };
  assert.equal(lastResponderOf([]), "none");
  assert.equal(lastResponderOf([customer, ai]), "ai");
  assert.equal(lastResponderOf([customer, staff, customer, ai]), "staff");
  assert.equal(lastResponderOf([customer, staff, ai, customer]), "staff");
  assert.equal(lastResponderOf([ai, staff]), "ai");
});
