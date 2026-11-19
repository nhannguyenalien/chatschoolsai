// Bộ hẹn giờ không phụ thuộc thư viện. Mỗi job khai báo hoặc `every` (ms) hoặc `at` (giờ:phút theo giờ địa phương,
// tuỳ chọn `weekday` 0=CN..6=T7). Mỗi "khe" chỉ chạy đúng một lần, và trạng thái được lưu ra file để container
// khởi động lại không làm job hằng ngày gửi lặp.
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";

const CATCH_UP_MS = 3 * 60 * 60 * 1000; // lỡ giờ quá 3 tiếng thì bỏ qua tới lần sau, không chạy muộn

// Trả về khoá của khe đang đến hạn, hoặc null nếu chưa tới/đã quá hạn bù.
export function dueSlot(job, nowMs, tzOffsetMin) {
  if (job.every) return String(Math.floor(nowMs / job.every));
  const local = new Date(nowMs + tzOffsetMin * 60000);
  if (job.at.weekday !== undefined && local.getUTCDay() !== job.at.weekday) return null;
  const minutesIntoDay = local.getUTCHours() * 60 + local.getUTCMinutes();
  const target = job.at.hour * 60 + job.at.minute;
  const late = minutesIntoDay - target;
  if (late < 0 || late * 60000 > CATCH_UP_MS) return null;
  return local.toISOString().slice(0, 10);
}

export function createScheduler({ jobs, ctx, tzOffsetMin, statePath, now = Date.now, onError = () => {}, log = console.log }) {
  const byName = new Map(jobs.map((j) => [j.name, j]));
  let state = {};
  const running = new Set();
  let timer = null;

  async function load() {
    try { state = JSON.parse(await readFile(statePath, "utf8")); } catch { state = {}; }
  }
  async function save() {
    await mkdir(path.dirname(statePath), { recursive: true });
    const tmp = `${statePath}.tmp`;
    await writeFile(tmp, JSON.stringify(state));
    await rename(tmp, statePath);
  }

  async function runJob(name, { manual = false } = {}) {
    const job = byName.get(name);
    if (!job) throw new Error(`Không có job ${name}`);
    if (running.has(name)) return { skipped: "đang chạy" };
    running.add(name);
    const startedAt = now();
    try {
      const result = await job.run(ctx);
      state[name] = { ...(state[name] || {}), ok: true, at: startedAt, ms: now() - startedAt, result: result ?? null, manual };
      log(`[job ${name}] xong trong ${now() - startedAt}ms`);
      return { ok: true, result };
    } catch (err) {
      state[name] = { ...(state[name] || {}), ok: false, at: startedAt, error: err.message, manual };
      log(`[job ${name}] LỖI: ${err.message}`);
      await Promise.resolve(onError(name, err)).catch(() => {});
      return { ok: false, error: err.message };
    } finally {
      running.delete(name);
      await save().catch((e) => log(`Không lưu được state: ${e.message}`));
    }
  }

  async function tick() {
    for (const job of jobs) {
      const slot = dueSlot(job, now(), tzOffsetMin);
      if (slot === null || state[job.name]?.slot === slot || running.has(job.name)) continue;
      state[job.name] = { ...(state[job.name] || {}), slot }; // đánh dấu trước để lỗi cũng không chạy lặp trong cùng khe
      await runJob(job.name);
    }
  }

  return {
    runJob,
    tick,
    status: () => state,
    async start(intervalMs = 20000) {
      await load();
      timer = setInterval(() => tick().catch((e) => log(`tick lỗi: ${e.message}`)), intervalMs);
      timer.unref?.();
      await tick();
    },
    stop: () => clearInterval(timer),
  };
}
