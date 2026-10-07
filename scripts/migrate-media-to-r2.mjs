#!/usr/bin/env node
/**
 * Chuyển file cũ trong PocketBase `media_library` sang R2 và tính lại dung lượng đã dùng.
 *
 * Mỗi record chưa có `r2_key`:
 *   1. tải file từ PocketBase  2. đẩy lên R2 (key cố định `{tenant}/{yyyy-mm}/{id}.{ext}`, chạy lại vẫn an toàn)
 *   3. cập nhật media_library: url, r2_key, size_bytes  4. đổi url cũ trong collection `media` (ảnh/video gắn bài)
 * Cuối cùng ghi `tenants.storage_used` = tổng size_bytes của mọi workspace thuộc tài khoản đó.
 *
 * Mặc định chỉ chạy THỬ (không ghi gì). Thêm --apply để chạy thật. Upload dùng `wrangler r2 object put`
 * nên cần đã `wrangler login` (không cần API key R2). File gốc trong PocketBase được giữ lại,
 * trừ khi thêm --delete-original (chỉ nên dùng sau khi đã kiểm tra ảnh/video hiển thị bình thường).
 *
 *   PB_URL=https://nhannguyen123-chat.hf.space PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... \
 *   node scripts/migrate-media-to-r2.mjs --bucket dashpoc-media [--public-base https://media.example.com] \
 *        [--tenant slug] [--limit 50] [--apply] [--delete-original]
 *
 * Nếu bucket dùng Worker để phục vụ (không có MEDIA_PUBLIC_URL) thì --public-base mặc định
 * https://apic.schoolsai.work/media. Phải khớp với MEDIA_PUBLIC_URL của Worker.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);
const MB = 1024 * 1024;
export const STORAGE_LIMITS = { free: 100 * MB, pro: 2048 * MB };
const CONTENT_TYPES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};

export function extOf(filename) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

export function r2KeyFor(record) {
  const month = String(record.created || "").slice(0, 7);
  const ext = extOf(record.file);
  if (!/^\d{4}-\d{2}$/.test(month) || !CONTENT_TYPES[ext] || !record.tenant) return null;
  return `${record.tenant}/${month}/${record.id}.${ext}`;
}

export function contentTypeFor(filename) {
  return CONTENT_TYPES[extOf(filename)] || "application/octet-stream";
}

// Gom dung lượng theo tài khoản. resolveAccount(tenantSlug) -> account record | null.
export function sumByAccount(records, resolveAccount) {
  const totals = new Map();
  const orphans = new Set();
  for (const r of records) {
    const size = Number(r.size_bytes) || 0;
    if (!size) continue;
    const account = resolveAccount(r.tenant);
    if (!account) { orphans.add(r.tenant); continue; }
    totals.set(account.id, (totals.get(account.id) || 0) + size);
  }
  return { totals, orphans };
}

export function limitFor(account) {
  const o = Number(account.storage_limit_bytes);
  if (Number.isSafeInteger(o) && o > 0) return o; // 0/trống = mặc định theo gói
  return account.plan_id === "pro" ? STORAGE_LIMITS.pro : STORAGE_LIMITS.free;
}

function parseArgs(argv) {
  const args = { apply: false, deleteOriginal: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--delete-original") args.deleteOriginal = true;
    else if (["--bucket", "--public-base", "--tenant", "--limit"].includes(a)) args[a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[++i];
    else throw new Error(`Tham số không hợp lệ: ${a}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const PB_URL = (process.env.PB_URL || "").replace(/\/$/, "");
  if (!PB_URL || !process.env.PB_ADMIN_EMAIL || !process.env.PB_ADMIN_PASS) throw new Error("Thiếu PB_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASS");
  if (args.apply && !args.bucket) throw new Error("Thiếu --bucket");
  if (args.deleteOriginal && !args.apply) throw new Error("--delete-original chỉ dùng cùng --apply");
  const publicBase = (args.publicBase || process.env.MEDIA_PUBLIC_URL || "https://apic.schoolsai.work/media").replace(/\/$/, "");
  const limit = args.limit ? Number(args.limit) : Infinity;

  let token = "";
  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const res = await fetch(PB_URL + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASS }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) { token = data.token; break; }
    if (res.status !== 404) throw new Error(`Đăng nhập admin thất bại (${res.status})`);
  }
  if (!token) throw new Error("Đăng nhập admin thất bại");
  const pb = async (path, init = {}) => {
    const res = await fetch(PB_URL + path, { ...init, headers: { Authorization: token, ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init.headers } });
    if (!res.ok) throw new Error(`${init.method || "GET"} ${path} -> ${res.status} ${await res.text().catch(() => "")}`);
    return res.status === 204 ? null : res.json();
  };
  const all = async (collection, filter = "") => {
    const items = [];
    for (let page = 1; ; page++) {
      const data = await pb(`/api/collections/${collection}/records?perPage=200&page=${page}${filter ? `&filter=${encodeURIComponent(filter)}` : ""}`);
      items.push(...data.items);
      if (page >= data.totalPages) return items;
    }
  };

  const records = await all("media_library", args.tenant ? `tenant='${args.tenant.replace(/'/g, "")}'` : "");
  const todo = records.filter(r => r.file && !r.r2_key);
  console.log(`media_library: ${records.length} record, ${todo.length} chưa chuyển sang R2${args.apply ? "" : "  (CHẠY THỬ — thêm --apply để ghi thật)"}`);

  const tmp = await mkdtemp(join(tmpdir(), "media-r2-"));
  let migrated = 0, failed = 0, skipped = 0;
  try {
    for (const rec of todo.slice(0, limit)) {
      const key = r2KeyFor(rec);
      if (!key) { console.log(`  - bỏ qua ${rec.id}: không xác định được định dạng/tenant (${rec.file})`); skipped++; continue; }
      const oldUrl = `${PB_URL}/api/files/media_library/${rec.id}/${rec.file}`;
      try {
        const res = await fetch(oldUrl, { headers: { Authorization: token } });
        if (!res.ok) throw new Error(`tải file lỗi ${res.status}`);
        const bytes = Buffer.from(await res.arrayBuffer());
        const newUrl = `${publicBase}/${key}`;
        if (!args.apply) { console.log(`  · ${rec.id} ${(bytes.length / 1024).toFixed(0)} KB -> ${key}`); rec.size_bytes = bytes.length; migrated++; continue; }
        const local = join(tmp, rec.id);
        await writeFile(local, bytes);
        await run("npx", ["wrangler", "r2", "object", "put", `${args.bucket}/${key}`, `--file=${local}`, `--content-type=${contentTypeFor(rec.file)}`, "--remote"], { cwd: new URL("../worker-chat-d/knowledge-worker/", import.meta.url).pathname });
        await rm(local, { force: true });
        await pb(`/api/collections/media_library/records/${rec.id}`, { method: "PATCH", body: JSON.stringify({ url: newUrl, r2_key: key, size_bytes: bytes.length }) });
        Object.assign(rec, { url: newUrl, r2_key: key, size_bytes: bytes.length });
        // Bài đăng trỏ tới URL cũ (URL tuyệt đối do worker lưu trước đây).
        for (const m of await all("media", `url='${oldUrl.replace(/'/g, "")}'`)) {
          await pb(`/api/collections/media/records/${m.id}`, { method: "PATCH", body: JSON.stringify({ url: newUrl }) });
        }
        if (args.deleteOriginal) await pb(`/api/collections/media_library/records/${rec.id}`, { method: "PATCH", body: JSON.stringify({ file: null }) });
        console.log(`  ✓ ${rec.id} -> ${key}`);
        migrated++;
      } catch (err) {
        console.error(`  ✗ ${rec.id}: ${err.message}`);
        failed++;
      }
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  // Tính lại storage_used cho từng tài khoản (record chưa có size_bytes thì bỏ qua ở bước tổng).
  const accounts = await all("tenants");
  const memberships = await all("tenant_memberships", "status='active' && role='owner'").catch(() => []);
  const byId = new Map(accounts.map(a => [a.id, a]));
  const bySlug = new Map(accounts.filter(a => a.tenant).map(a => [a.tenant, a]));
  for (const m of memberships) if (!bySlug.has(m.tenant) && byId.has(m.account)) bySlug.set(m.tenant, byId.get(m.account));
  const { totals, orphans } = sumByAccount(records, slug => bySlug.get(slug));
  console.log("\nDung lượng theo tài khoản:");
  for (const acc of accounts) {
    const used = totals.get(acc.id) || 0;
    const cap = limitFor(acc);
    console.log(`  ${acc.email || acc.id}: ${(used / MB).toFixed(1)} MB / ${(cap / MB).toFixed(0)} MB${used > cap ? "  ⚠ vượt hạn mức (file cũ giữ nguyên, nhưng chưa upload thêm được)" : ""}`);
    if (args.apply && Number(acc.storage_used || 0) !== used) await pb(`/api/collections/tenants/records/${acc.id}`, { method: "PATCH", body: JSON.stringify({ storage_used: used }) });
  }
  if (orphans.size) console.log(`  ! tenant không tìm thấy tài khoản (không tính): ${[...orphans].join(", ")}`);
  console.log(`\nXong: ${migrated} ${args.apply ? "đã chuyển" : "sẽ chuyển"}, ${failed} lỗi, ${skipped} bỏ qua.`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error("\n❌ Lỗi:", err.message); process.exit(1); });
}
