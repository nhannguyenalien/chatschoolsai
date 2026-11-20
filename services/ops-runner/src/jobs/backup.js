// Sao lưu PocketBase (đang chạy trên HF Space, đĩa có thể mất) về volume của Coolify mỗi đêm.
// Dùng API backup có sẵn của PocketBase: ảnh chụp nhất quán, không cần dừng DB.
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

export async function pruneOld(dir, keepDays, nowMs = Date.now()) {
  const removed = [];
  for (const name of await readdir(dir)) {
    if (!/^ops-.*\.zip$/.test(name)) continue; // chỉ đụng file do job này tạo
    const info = await stat(path.join(dir, name));
    if (nowMs - info.mtimeMs > keepDays * 86400000) { await unlink(path.join(dir, name)); removed.push(name); }
  }
  return removed;
}

export const backupJob = {
  name: "pb-backup",
  at: { hour: 3, minute: 0 },
  async run({ pb, config, now = Date.now }) {
    const dir = path.join(config.dataDir, "backups");
    await mkdir(dir, { recursive: true });
    // PocketBase chỉ chấp nhận tên dạng ^[a-z0-9_-]+\.zip$ (chữ thường) nên không dùng thẳng chuỗi ISO có T/Z hoa.
    const name = `ops-${new Date(now()).toISOString().replace(/[:.]/g, "-").toLowerCase()}.zip`;

    await pb.json("/api/backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    try {
      const { token } = await pb.json("/api/files/token", { method: "POST" });
      const res = await pb.request(`/api/backups/${encodeURIComponent(name)}?token=${encodeURIComponent(token)}`);
      if (!res.ok || !res.body) throw new Error(`Tải backup thất bại (${res.status})`);
      const file = path.join(dir, name);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
      const { size } = await stat(file);
      if (size < 1024) { await unlink(file); throw new Error(`File backup quá nhỏ (${size} byte), coi như hỏng`); }
      const removed = await pruneOld(dir, config.backupKeepDays, now());
      return { file: name, bytes: size, pruned: removed.length };
    } finally {
      // Xoá bản trên HF Space để không đầy đĩa của nó; lỗi xoá không làm hỏng backup đã tải.
      await pb.request(`/api/backups/${encodeURIComponent(name)}`, { method: "DELETE" }).catch(() => {});
    }
  },
};
