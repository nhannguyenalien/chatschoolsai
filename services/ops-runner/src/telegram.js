// Gửi tin Telegram (văn bản thuần, tự cắt theo giới hạn 4096 ký tự của Telegram).
// Token lấy từ `token` nếu có, nếu không thì hỏi `getToken` (đọc system_config của PocketBase, giống Worker)
// và nhớ 5 phút, nên đổi token ở system-config.html là runner tự theo.
export function createTelegram({ token = "", getToken = async () => "", fetchImpl = fetch, now = Date.now }) {
  let cached = "", cachedAt = 0;
  async function resolveToken() {
    if (token) return token;
    if (!cached || now() - cachedAt > 5 * 60 * 1000) { cached = (await getToken()) || ""; cachedAt = now(); }
    return cached;
  }

  async function send(chatId, text) {
    if (!chatId) { console.warn(`[telegram] bỏ qua (không có chat id): ${String(text).slice(0, 120)}`); return; }
    const botToken = await resolveToken();
    if (!botToken) throw new Error("Chưa có TELEGRAM_BOT_TOKEN (env hoặc system_config.telegram_bot_token)");
    const chunks = [];
    for (let rest = String(text); rest.length; ) {
      chunks.push(rest.slice(0, 3900));
      rest = rest.slice(3900);
    }
    for (const chunk of chunks) {
      const res = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, disable_web_page_preview: true }),
      });
      if (!res.ok) throw new Error(`Telegram sendMessage -> ${res.status}`);
    }
  }
  return { send };
}
