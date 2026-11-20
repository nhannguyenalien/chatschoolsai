// Nhắc lịch gửi KHÁCH trước giờ hẹn (mặc định 120 phút), qua đúng kênh khách đã nhắn (Messenger/Instagram).
// Meta chỉ cho gửi tin chủ động trong 24 giờ kể từ tin cuối của khách, nên:
//   - còn trong cửa sổ 24h  -> gửi nhắc cho khách;
//   - ngoài cửa sổ / kênh khác (web, Telegram...) / gửi lỗi -> KHÔNG ép gửi, báo chủ cơ sở nhắc tay kèm số điện thoại.
// Mỗi lịch chỉ xử lý một lần (đánh dấu trong extra_json.reminder) nên job chạy lặp hay container khởi động lại cũng không gửi trùng.
import { pbTime } from "../pb.js";

const GRAPH = "https://graph.facebook.com/v19.0"; // cùng phiên bản với Worker
const WINDOW_MS = 24 * 60 * 60 * 1000;
const q = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const LANGS = ["vi", "en", "ja", "es", "fr", "ko", "zh"];

// vi|en|ja|es|fr|ko|zh — cùng thứ tự với domain/booking/i18n.js của Worker.
const TEXT = "Nhắc lịch: {name} có lịch {service} lúc {time} ngày {date}. Hẹn gặp bạn! Cần đổi hoặc huỷ, bạn cứ nhắn lại nhé.|" +
  "Reminder: {name}, you have {service} at {time} on {date}. See you soon! Reply here if you need to change or cancel.|" +
  "リマインド：{name}様、{date} {time} に {service} のご予約があります。変更・キャンセルはこのままご返信ください。|" +
  "Recordatorio: {name}, tienes {service} a las {time} el {date}. ¡Te esperamos! Responde aquí si necesitas cambiarlo o cancelarlo.|" +
  "Rappel : {name}, vous avez {service} à {time} le {date}. À bientôt ! Répondez ici pour modifier ou annuler.|" +
  "예약 알림: {name}님, {date} {time}에 {service} 예약이 있습니다. 변경·취소는 이 대화로 답장해 주세요.|" +
  "预约提醒：{name}，您预约了 {service}，时间 {date} {time}。如需更改或取消，请直接回复。";

export function pickLang(value) {
  const v = String(value || "").trim().toLowerCase().slice(0, 2);
  return LANGS.includes(v) ? v : "vi"; // "auto"/trống -> tiếng Việt (ngôn ngữ mặc định của hệ thống)
}

export function localParts(iso, tzOffsetMin) {
  const d = new Date(new Date(iso.replace(" ", "T")).getTime() + tzOffsetMin * 60000).toISOString();
  return { time: d.slice(11, 16), date: `${d.slice(8, 10)}/${d.slice(5, 7)}` };
}

export function reminderText(booking, lang, tzOffsetMin) {
  const { time, date } = localParts(booking.start, tzOffsetMin);
  const template = TEXT.split("|")[LANGS.indexOf(lang)] || TEXT.split("|")[0];
  return template
    .replace("{name}", booking.customer_name || (lang === "vi" ? "bạn" : "you"))
    .replace("{service}", booking.service_name || (lang === "vi" ? "dịch vụ" : "your appointment"))
    .replace("{time}", time).replace("{date}", date);
}

// client_meta là field JSON của PocketBase nên API trả về object; vẫn nhận chuỗi JSON cho chắc.
export function parseMeta(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  try { const v = JSON.parse(value || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
}

export function parseExtra(raw) {
  try { const v = JSON.parse(raw || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
}

// Quyết định kênh gửi cho một lịch. Trả về { via, recipientId, pageId } hoặc { via: null, reason }.
export function planChannel({ session, lastCustomerMsgAt, nowMs }) {
  const m = String(session || "").match(/^(facebook|instagram):(?!comment:)(.+)$/);
  if (!m) return { via: null, reason: "kênh không hỗ trợ nhắc tự động" };
  if (!lastCustomerMsgAt) return { via: null, reason: "không có tin nhắn khách" };
  const age = nowMs - new Date(String(lastCustomerMsgAt).replace(" ", "T")).getTime();
  if (!(age >= 0 && age < WINDOW_MS)) return { via: null, reason: "ngoài cửa sổ 24h của Meta" };
  return { via: m[1], recipientId: m[2] };
}

async function sendMeta(fetchImpl, token, recipientId, text) {
  const res = await fetchImpl(`${GRAPH}/me/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text }, messaging_type: "RESPONSE" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `Meta HTTP ${res.status}`);
  }
}

export const bookingReminderJob = {
  name: "booking-reminder",
  every: 10 * 60 * 1000,
  async run({ pb, telegram, config, fetchImpl = fetch, now = Date.now }) {
    const lead = config.reminderLeadMin * 60000;
    const bookings = await pb.list("bookings", {
      filter: `status='confirmed' && start > '${pbTime(now())}' && start <= '${pbTime(now() + lead)}'`,
      sort: "start",
      fields: "id,tenant,start,customer_name,phone,service_name,session,extra_json,party_size",
    });
    const todo = bookings.filter((b) => !parseExtra(b.extra_json).reminder);
    if (!todo.length) return { due: 0, sent: 0, manual: 0 };

    const cfgCache = new Map();
    const tenantCfg = async (tenant) => {
      if (!cfgCache.has(tenant)) {
        const [bot] = await pb.list("bot_configs", { filter: `tenant='${q(tenant)}'`, fields: "owner_telegram_chat_id,response_language", perPage: 1, maxPages: 1 });
        cfgCache.set(tenant, bot || {});
      }
      return cfgCache.get(tenant);
    };

    const manual = new Map(); // tenant -> dòng cần nhắc tay
    let sent = 0;
    for (const b of todo) {
      let outcome = { status: "manual", reason: "" };
      try {
        const [last] = b.session ? await pb.list("messages", {
          filter: `tenant='${q(b.tenant)}' && session='${q(b.session)}' && is_bot=false`, sort: "-created", fields: "created,client_meta", perPage: 1, maxPages: 1,
        }) : [];
        const plan = planChannel({ session: b.session, lastCustomerMsgAt: last?.created, nowMs: now() });
        if (plan.via) {
          const meta = parseMeta(last.client_meta);
          const pages = await pb.list("pages_config", { filter: `tenant='${q(b.tenant)}' && platform='${plan.via}' && is_active=true`, fields: "page_id,access_token", perPage: 20, maxPages: 1 });
          const page = pages.find((p) => String(p.page_id) === String(meta.page_id)) || pages[0];
          if (!page?.access_token || page.access_token === "pending") throw new Error("chưa cấu hình kênh gửi");
          const lang = pickLang((await tenantCfg(b.tenant)).response_language);
          await sendMeta(fetchImpl, page.access_token, plan.recipientId, reminderText(b, lang, config.tzOffsetMin));
          outcome = { status: "sent", via: plan.via };
          sent++;
        } else {
          outcome.reason = plan.reason;
        }
      } catch (err) {
        outcome = { status: "manual", reason: `gửi lỗi: ${err.message}` };
      }
      // Đánh dấu TRƯỚC khi báo chủ để lỗi mạng khi báo cũng không làm lịch này bị xử lý lại.
      const extra = { ...parseExtra(b.extra_json), reminder: { ...outcome, at: new Date(now()).toISOString() } };
      await pb.json(`/api/collections/bookings/records/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extra_json: JSON.stringify(extra) }) });
      if (outcome.status === "manual") {
        const { time } = localParts(b.start, config.tzOffsetMin);
        const line = `• ${time} ${b.customer_name || "Khách"}${b.phone ? ` — ${b.phone}` : " — (không có SĐT)"} — ${b.service_name || "?"} (${outcome.reason})`;
        manual.set(b.tenant, [...(manual.get(b.tenant) || []), line]);
      }
    }

    for (const [tenant, lines] of manual) {
      const chatId = (await tenantCfg(tenant)).owner_telegram_chat_id;
      if (!chatId) continue;
      await telegram.send(chatId, `📞 Cần nhắc khách bằng tay — ${tenant}\n${lines.join("\n")}`).catch((e) => console.error(`[booking-reminder] ${tenant}: ${e.message}`));
    }
    return { due: todo.length, sent, manual: [...manual.values()].flat().length };
  },
};
