function endpoint(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function telegramRequest(fetchImpl, token, method, body) {
  const response = await fetchImpl(endpoint(token, method), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed: ${data.description || response.status}`);
  return data.result;
}

export function createTelegramClient({ token, fetchImpl = fetch }) {
  if (!token) throw new Error("Telegram bot token is required.");
  return {
    sendMessage(chatId, text, replyMarkup) {
      return telegramRequest(fetchImpl, token, "sendMessage", {
        chat_id: chatId, text, parse_mode: "HTML", ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
    },
    answerCallbackQuery(callbackQueryId, text) {
      return telegramRequest(fetchImpl, token, "answerCallbackQuery", {
        callback_query_id: callbackQueryId, ...(text ? { text } : {}),
      });
    },
    async downloadJsonDocument(fileId) {
      const file = await telegramRequest(fetchImpl, token, "getFile", { file_id: fileId });
      const response = await fetchImpl(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
      if (!response.ok) throw new Error(`Telegram file download failed (${response.status}).`);
      return response.text();
    },
  };
}
