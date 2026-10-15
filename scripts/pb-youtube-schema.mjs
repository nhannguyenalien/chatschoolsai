#!/usr/bin/env node
// Thêm giá trị "youtube" vào select `platform` của pages_config và post_targets (cần để lưu kênh + bài đăng YouTube).
// Chỉ sửa danh sách giá trị của field platform, KHÔNG đụng quy tắc truy cập. Chạy lại nhiều lần an toàn.
//   PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... node scripts/pb-youtube-schema.mjs [--apply]
// Không có --apply: chỉ in ra thay đổi sẽ làm (dry-run).
const COLLECTIONS = ["pages_config", "post_targets"];

import { youtubePlatformPatch } from "../worker-chat-d/knowledge-worker/src/integrations/youtube.js";
export { youtubePlatformPatch };

async function main() {
  const { PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASS } = process.env;
  if (!PB_URL || !PB_ADMIN_EMAIL || !PB_ADMIN_PASS) throw new Error("Cần PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASS");
  const apply = process.argv.includes("--apply");
  const base = PB_URL.replace(/\/$/, "");
  let token = "";
  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASS }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) { token = data.token; break; }
    if (res.status !== 404) throw new Error(`Đăng nhập admin thất bại (${res.status})`);
  }
  if (!token) throw new Error("Đăng nhập admin thất bại");
  for (const name of COLLECTIONS) {
    const res = await fetch(`${base}/api/collections/${name}`, { headers: { Authorization: token } });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    const collection = await res.json();
    const patch = youtubePlatformPatch(collection);
    if (!patch) { console.log(`- ${name}: đã có "youtube" (hoặc platform không phải select), bỏ qua`); continue; }
    if (!apply) { console.log(`+ ${name}: sẽ thêm "youtube" (chạy lại với --apply)`); continue; }
    const out = await fetch(`${base}/api/collections/${collection.id}`, { method: "PATCH", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!out.ok) throw new Error(`${name}: patch thất bại ${out.status} ${await out.text()}`);
    console.log(`+ ${name}: đã thêm "youtube"`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error.message); process.exit(1); });
