// Canh sống: gọi PocketBase (và các URL khác trong HEALTH_URLS) mỗi 5 phút. Báo Telegram khi hỏng 2 lần liên tiếp,
// báo lại khi hồi phục. Việc gọi đều đặn cũng giữ HF Space không ngủ.
export const watchdogJob = {
  name: "watchdog",
  every: 5 * 60 * 1000,
  async run({ config, telegram, fetchImpl = fetch, memory }) {
    const urls = [`${config.pbUrl}/api/health`, ...config.healthUrls];
    const results = {};
    for (const url of urls) {
      let ok = false;
      try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
        ok = res.ok;
      } catch { ok = false; }
      results[url] = ok;
      const prev = memory.get(url) || { fails: 0, alerted: false };
      if (ok) {
        if (prev.alerted) await telegram.send(config.alertChatId, `✅ Đã hoạt động lại: ${url}`);
        memory.set(url, { fails: 0, alerted: false });
      } else {
        const fails = prev.fails + 1;
        let alerted = prev.alerted;
        if (fails >= 2 && !alerted) {
          await telegram.send(config.alertChatId, `🚨 Không truy cập được: ${url} (${fails} lần liên tiếp)`);
          alerted = true;
        }
        memory.set(url, { fails, alerted });
      }
    }
    return results;
  },
};
