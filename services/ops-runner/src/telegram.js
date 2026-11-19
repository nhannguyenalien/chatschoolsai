// Gửi tin Telegram (văn bản thuần, tự cắt theo giới hạn 4096 ký tự của Telegram).
export function createTelegram({ token, fetchImpl = fetch }) {
  async function send(chatId, text) {
    const chunks = [];
    for (let rest = String(text); rest.length; ) {
      chunks.push(rest.slice(0, 3900));
      rest = rest.slice(3900);
    }
    for (const chunk of chunks) {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, disable_web_page_preview: true }),
      });
      if (!res.ok) throw new Error(`Telegram sendMessage -> ${res.status}`);
    }
  }
  return { send };
}
