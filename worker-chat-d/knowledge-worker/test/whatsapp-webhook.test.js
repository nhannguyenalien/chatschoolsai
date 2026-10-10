import assert from "node:assert/strict";
import test from "node:test";

import { extractWhatsAppMessages, isWhatsAppPayload, splitWhatsAppText, whatsAppPhoneNumberIds } from "../src/domain/chat/whatsappWebhook.js";

const payload = (messages, extra = {}) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "15550000000", phone_number_id: "PHONE1" }, contacts: [{ profile: { name: "An" }, wa_id: "84900000001" }], messages, ...extra } }] }]
});

test("isWhatsAppPayload chỉ nhận object whatsapp_business_account", () => {
  assert.equal(isWhatsAppPayload({ object: "whatsapp_business_account" }), true);
  assert.equal(isWhatsAppPayload({ object: "page" }), false);
  assert.equal(isWhatsAppPayload(null), false);
});

test("extractWhatsAppMessages đọc tin văn bản, nút bấm, tin kèm ảnh và bỏ qua trạng thái", () => {
  const body = payload([
    { from: "84900000001", id: "m1", type: "text", text: { body: " Xin chào " } },
    { from: "84900000001", id: "m2", type: "interactive", interactive: { button_reply: { id: "b", title: "Đặt lịch" } } },
    { from: "84900000001", id: "m3", type: "image", image: { id: "media1", caption: "ảnh lỗi" } },
    { from: "84900000001", id: "m4", type: "audio", audio: { id: "media2" } },
    { from: "", id: "m5", type: "text", text: { body: "không có người gửi" } }
  ], { statuses: [{ id: "s1", status: "delivered" }] });
  const messages = extractWhatsAppMessages(body);
  assert.deepEqual(messages.map((m) => m.text), ["Xin chào", "Đặt lịch", "[Khách gửi Ảnh] ảnh lỗi", "[Khách gửi Âm thanh]"]);
  assert.equal(messages[0].phoneNumberId, "PHONE1");
  assert.equal(messages[0].from, "84900000001");
  assert.equal(messages[0].name, "An");
});

test("extractWhatsAppMessages bỏ qua field khác messages và payload thiếu phone_number_id", () => {
  assert.deepEqual(extractWhatsAppMessages({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "account_update", value: {} }] }] }), []);
  assert.deepEqual(extractWhatsAppMessages({ entry: [{ changes: [{ field: "messages", value: { messages: [{ from: "1", type: "text", text: { body: "x" } }] } }] }] }), []);
  assert.deepEqual(extractWhatsAppMessages(null), []);
});

test("whatsAppPhoneNumberIds lấy các phone_number_id hợp lệ, không trùng", () => {
  assert.deepEqual(whatsAppPhoneNumberIds(payload([])), ["PHONE1"]);
  assert.deepEqual(whatsAppPhoneNumberIds({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "bad id!" } } }] }] }), []);
});

test("splitWhatsAppText giữ tin ngắn nguyên vẹn và cắt tin dài ở xuống dòng/dấu cách, không vượt giới hạn", () => {
  assert.deepEqual(splitWhatsAppText("  hi  "), ["hi"]);
  assert.deepEqual(splitWhatsAppText(""), []);
  const long = Array.from({ length: 50 }, (_, i) => `Dòng số ${i} ` + "x".repeat(150)).join("\n");
  const parts = splitWhatsAppText(long, 1000);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 1000));
  assert.equal(parts.join("\n").replace(/\s+/g, ""), long.replace(/\s+/g, ""));
  const noSpaces = "y".repeat(2500);
  assert.deepEqual(splitWhatsAppText(noSpaces, 1000).map((p) => p.length), [1000, 1000, 500]);
});
