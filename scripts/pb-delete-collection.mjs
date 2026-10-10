#!/usr/bin/env node
// Xoá 1 collection PocketBase theo ID (dùng để gỡ bản trùng tên mà Admin UI không hiện).
// Chỉ chạy khi có --yes. In tên + số record trước khi xoá.
// PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... node scripts/pb-delete-collection.mjs <collectionId> --yes
const { PB_URL: u, PB_ADMIN_EMAIL: identity, PB_ADMIN_PASS: password } = process.env;
const id = process.argv[2];
if (!id || id.startsWith("--")) { console.error("Thiếu collection ID"); process.exit(1); }
let token = "";
for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
  const res = await fetch(u + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity, password }) });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.token) { token = data.token; break; }
  if (res.status !== 404) { console.error(`Đăng nhập lỗi ${res.status}:`, JSON.stringify(data)); process.exit(1); }
}
if (!token) { console.error("Không đăng nhập được"); process.exit(1); }
const headers = { Authorization: token };
const info = await fetch(`${u}/api/collections/${id}`, { headers });
if (!info.ok) { console.error("Không tìm thấy collection", id, info.status); process.exit(1); }
const col = await info.json();
const rec = await (await fetch(`${u}/api/collections/${id}/records?perPage=1`, { headers })).json().catch(() => ({}));
console.log(`Collection ${col.id} "${col.name}" — ${rec.totalItems ?? "?"} record`);
if (!process.argv.includes("--yes")) { console.log("Chưa xoá. Thêm --yes để xoá thật."); process.exit(0); }
const del = await fetch(`${u}/api/collections/${id}`, { method: "DELETE", headers });
console.log(del.status === 204 ? "Đã xoá." : `Xoá lỗi ${del.status}: ${await del.text()}`);
