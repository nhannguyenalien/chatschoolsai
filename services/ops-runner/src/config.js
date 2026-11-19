// Đọc cấu hình từ biến môi trường và kiểm tra ngay khi khởi động: thiếu gì thì dừng với thông báo rõ,
// thay vì chạy lên rồi âm thầm không làm gì.
export function loadConfig(env = process.env) {
  const missing = ["PB_URL", "PB_ADMIN_EMAIL", "PB_ADMIN_PASS", "TELEGRAM_BOT_TOKEN", "ALERT_CHAT_ID", "RUNNER_SECRET"].filter((k) => !env[k]);
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(", ")}`);
  if (env.RUNNER_SECRET.length < 16) throw new Error("RUNNER_SECRET phải từ 16 ký tự");
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);
  return {
    pbUrl: env.PB_URL.replace(/\/+$/, ""),
    pbEmail: env.PB_ADMIN_EMAIL,
    pbPassword: env.PB_ADMIN_PASS,
    telegramToken: env.TELEGRAM_BOT_TOKEN,
    alertChatId: env.ALERT_CHAT_ID,
    secret: env.RUNNER_SECRET,
    port: num(env.RUNNER_PORT, 3000),
    dataDir: env.DATA_DIR || "/data",
    tzOffsetMin: num(env.TZ_OFFSET_MIN, 420), // mặc định giờ Việt Nam (UTC+7)
    backupKeepDays: num(env.BACKUP_KEEP_DAYS, 14),
    healthUrls: (env.HEALTH_URLS || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}
