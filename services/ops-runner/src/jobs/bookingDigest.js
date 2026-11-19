// Mỗi sáng gửi chủ từng cơ sở danh sách lịch hôm nay và ngày mai, kèm số lịch đang chờ xác nhận.
// (Nhắc khách trực tiếp cần kênh gửi chủ động — Messenger giới hạn cửa sổ 24h — nên để bước sau.)
import { pbTime } from "../pb.js";

const q = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

// Mốc 00:00 theo giờ địa phương của ngày chứa nowMs, đổi về UTC ms.
export function localDayStart(nowMs, tzOffsetMin) {
  const local = new Date(nowMs + tzOffsetMin * 60000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - tzOffsetMin * 60000;
}

export function formatDigest({ tenant, bookings, tzOffsetMin, dayStartMs }) {
  const tomorrowStart = dayStartMs + 86400000;
  const hhmm = (iso) => new Date(new Date(iso.replace(" ", "T")).getTime() + tzOffsetMin * 60000).toISOString().slice(11, 16);
  const line = (b) => `• ${hhmm(b.start)} ${b.customer_name || "Khách"}${b.party_size ? ` (${b.party_size})` : ""} — ${b.service_name || "?"}${b.phone ? ` — ${b.phone}` : ""}${b.status === "pending" ? " ⏳chờ xác nhận" : ""}`;
  const startOf = (b) => new Date(b.start.replace(" ", "T")).getTime();
  const today = bookings.filter((b) => startOf(b) < tomorrowStart);
  const tomorrow = bookings.filter((b) => startOf(b) >= tomorrowStart);
  const pending = bookings.filter((b) => b.status === "pending").length;
  return [
    `📅 Lịch đặt — ${tenant}`,
    `Hôm nay (${today.length}):`, ...(today.length ? today.map(line) : ["• Không có"]),
    `Ngày mai (${tomorrow.length}):`, ...(tomorrow.length ? tomorrow.map(line) : ["• Không có"]),
    ...(pending ? [`\n⚠️ ${pending} lịch đang chờ bạn xác nhận.`] : []),
  ].join("\n");
}

export const bookingDigestJob = {
  name: "booking-digest",
  at: { hour: 7, minute: 0 },
  async run({ pb, telegram, config, now = Date.now }) {
    const tenants = await pb.list("bot_configs", { filter: "owner_telegram_chat_id != ''", fields: "tenant,owner_telegram_chat_id" });
    const dayStartMs = localDayStart(now(), config.tzOffsetMin);
    let sent = 0;
    for (const t of tenants) {
      const bookings = await pb.list("bookings", {
        filter: `tenant='${q(t.tenant)}' && (status='confirmed' || status='pending') && start >= '${pbTime(dayStartMs)}' && start < '${pbTime(dayStartMs + 2 * 86400000)}'`,
        sort: "start",
        fields: "start,customer_name,party_size,service_name,phone,status",
      });
      if (!bookings.length) continue; // không có lịch thì không làm phiền
      try {
        await telegram.send(t.owner_telegram_chat_id, formatDigest({ tenant: t.tenant, bookings, tzOffsetMin: config.tzOffsetMin, dayStartMs }));
        sent++;
      } catch (err) {
        console.error(`[booking-digest] ${t.tenant}: ${err.message}`); // một tenant lỗi không chặn các tenant khác
      }
    }
    return { tenants: tenants.length, sent };
  },
};
