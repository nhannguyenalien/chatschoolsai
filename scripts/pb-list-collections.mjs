#!/usr/bin/env node
// Liệt kê collection có tên liên quan tới agent/proposal để dò collection trùng tên.
// Thêm --count để in số record của từng collection.
// PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... node scripts/pb-list-collections.mjs [regex]
const { PB_URL: u, PB_ADMIN_EMAIL: identity, PB_ADMIN_PASS: password } = process.env;
const args = process.argv.slice(2);
const withCount = args.includes("--count");
const withRecords = args.includes("--records");
const pattern = new RegExp(args.find((a) => !a.startsWith("--")) || "agent|proposal", "i");
let token = "";
for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
  const res = await fetch(u + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity, password }) });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.token) { token = data.token; break; }
  if (res.status !== 404) { console.error(`Đăng nhập lỗi ${res.status}:`, JSON.stringify(data)); process.exit(1); }
}
if (!token) { console.error("Không đăng nhập được"); process.exit(1); }
const res = await fetch(u + "/api/collections?perPage=200", { headers: { Authorization: token } });
const data = await res.json();
if (!Array.isArray(data.items)) { console.error("Không đọc được danh sách:", res.status, JSON.stringify(data)); process.exit(1); }
for (const x of data.items) {
  if (!pattern.test(x.name)) continue;
  let count = "";
  if (withCount) {
    const r = await fetch(`${u}/api/collections/${x.id}/records?perPage=1`, { headers: { Authorization: token } });
    const d = await r.json().catch(() => ({}));
    count = r.ok ? `records=${d.totalItems}` : `đọc lỗi ${r.status}`;
  }
  console.log(x.id, x.name, x.type, count);
  if (withRecords) {
    const r = await fetch(`${u}/api/collections/${x.id}/records?perPage=50&sort=created`, { headers: { Authorization: token } });
    const d = await r.json().catch(() => ({}));
    for (const rec of d.items || []) console.log("   ", rec.id, rec.created, rec.tenant, rec.tool_name, rec.status);
  }
}
