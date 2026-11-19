// Báo cáo tuần gửi chủ từng cơ sở vào sáng thứ Hai: số tin nhắn, lịch đặt, bài đăng của 7 ngày qua.
import { pbTime } from "../pb.js";

const q = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export function formatWeekly({ tenant, messages, bookings, posts }) {
  return [
    `📊 Báo cáo tuần — ${tenant}`,
    `💬 Tin nhắn: ${messages}`,
    `📅 Lịch đặt mới: ${bookings.total} (xác nhận ${bookings.confirmed}, chờ ${bookings.pending}, huỷ ${bookings.cancelled})`,
    `📝 Bài đăng: ${posts.published} đã đăng${posts.error ? `, ${posts.error} lỗi` : ""}`,
  ].join("\n");
}

export const weeklyReportJob = {
  name: "weekly-report",
  at: { hour: 8, minute: 0, weekday: 1 },
  async run({ pb, telegram, now = Date.now }) {
    const tenants = await pb.list("bot_configs", { filter: "owner_telegram_chat_id != ''", fields: "tenant,owner_telegram_chat_id" });
    const since = pbTime(now() - 7 * 86400000);
    let sent = 0;
    for (const t of tenants) {
      const tf = `tenant='${q(t.tenant)}'`;
      try {
        const [messages, total, confirmed, pending, cancelled, published, error] = await Promise.all([
          pb.count("messages", `${tf} && created >= '${since}'`),
          pb.count("bookings", `${tf} && created >= '${since}'`),
          pb.count("bookings", `${tf} && created >= '${since}' && status='confirmed'`),
          pb.count("bookings", `${tf} && created >= '${since}' && status='pending'`),
          pb.count("bookings", `${tf} && created >= '${since}' && status='cancelled'`),
          pb.count("post_targets", `${tf} && status='published' && updated >= '${since}'`),
          pb.count("post_targets", `${tf} && status='error' && updated >= '${since}'`),
        ]);
        await telegram.send(t.owner_telegram_chat_id, formatWeekly({ tenant: t.tenant, messages, bookings: { total, confirmed, pending, cancelled }, posts: { published, error } }));
        sent++;
      } catch (err) {
        console.error(`[weekly-report] ${t.tenant}: ${err.message}`);
      }
    }
    return { tenants: tenants.length, sent };
  },
};
