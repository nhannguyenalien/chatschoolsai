// WhatsApp Cloud API (Meta): đọc payload webhook và cắt tin trả lời — logic thuần, không gọi mạng.
// Payload: { object: "whatsapp_business_account", entry: [{ id: <WABA id>, changes: [{ field: "messages",
//   value: { metadata: { phone_number_id }, contacts: [...], messages: [...], statuses: [...] } }] }] }
// Kênh (pages_config) của WhatsApp lưu Phone Number ID trong page_id nên tra kênh theo metadata.phone_number_id.

export const WHATSAPP_TEXT_LIMIT = 4000; // giới hạn cứng 4096 ký tự/tin, chừa chỗ an toàn

export function isWhatsAppPayload(body) {
  return body?.object === "whatsapp_business_account";
}

const TYPE_LABELS = { image: "Ảnh", video: "Video", audio: "Âm thanh", document: "Tệp", sticker: "Sticker", location: "Vị trí", contacts: "Danh bạ", voice: "Tin nhắn thoại" };

function textOf(message) {
  switch (message.type) {
    case "text": return String(message.text?.body || "").trim();
    case "button": return String(message.button?.text || message.button?.payload || "").trim();
    case "interactive": {
      const reply = message.interactive?.button_reply || message.interactive?.list_reply;
      return String(reply?.title || "").trim();
    }
    default: {
      const caption = String(message[message.type]?.caption || "").trim();
      const label = TYPE_LABELS[message.type] || "Tệp đính kèm";
      return caption ? `[Khách gửi ${label}] ${caption}` : `[Khách gửi ${label}]`;
    }
  }
}

// Danh sách tin khách gửi đến (bỏ qua cập nhật trạng thái đã gửi/đã đọc).
export function extractWhatsAppMessages(body) {
  const out = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "messages") continue;
      const value = change.value || {};
      const phoneNumberId = String(value.metadata?.phone_number_id || "");
      if (!phoneNumberId) continue;
      const names = new Map((value.contacts || []).map((c) => [String(c?.wa_id || ""), String(c?.profile?.name || "")]));
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const from = String(message?.from || "");
        const text = textOf(message || {});
        if (!from || !text) continue;
        out.push({ phoneNumberId, from, id: String(message.id || ""), type: String(message.type || ""), text, name: names.get(from) || "" });
      }
    }
  }
  return out;
}

export function whatsAppPhoneNumberIds(body) {
  return [...new Set(extractWhatsAppMessagesLoose(body))];
}

function extractWhatsAppMessagesLoose(body) {
  const ids = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : [])
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const id = String(change?.value?.metadata?.phone_number_id || "");
      if (/^[0-9A-Za-z_.:-]{1,64}$/.test(id)) ids.push(id);
    }
  return ids;
}

// Cắt tin dài thành nhiều tin ≤ limit, ưu tiên ngắt ở xuống dòng, rồi dấu cách.
export function splitWhatsAppText(text, limit = WHATSAPP_TEXT_LIMIT) {
  const input = String(text || "").trim();
  if (!input) return [];
  const parts = [];
  let rest = input;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf(" ", limit);
    if (cut < limit * 0.5) cut = limit;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
