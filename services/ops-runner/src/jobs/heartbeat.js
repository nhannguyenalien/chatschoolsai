// Báo "tôi còn sống" ra ngoài: gọi HEARTBEAT_URL (ví dụ link ping của healthchecks.io) mỗi 5 phút.
// Dịch vụ bên ngoài báo bạn khi runner im lặng — kể cả lúc cả Coolify/máy Dell sập, lúc mà watchdog trong runner
// không thể tự báo. Chỉ cần kết nối RA ngoài, không cần tên miền công khai.
// Lỗi mạng chỉ ghi log (không báo Telegram) vì chính việc mất ping mới là tín hiệu cảnh báo.
export const heartbeatJob = {
  name: "heartbeat",
  every: 5 * 60 * 1000,
  async run({ config, fetchImpl = fetch }) {
    if (!config.heartbeatUrl) return { skipped: "chưa đặt HEARTBEAT_URL" };
    try {
      const res = await fetchImpl(config.heartbeatUrl, { signal: AbortSignal.timeout(15000) });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      console.warn(`[heartbeat] không gọi được: ${err.message}`);
      return { ok: false, error: err.message };
    }
  },
};
