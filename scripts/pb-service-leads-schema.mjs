#!/usr/bin/env node
// Prepares PocketBase for the landing-page lead form of the done-for-you setup service:
//  - creates the collection service_leads (contact details, market, plan, status, order_id)
//  - no public API rules at all: only the Worker (admin token) and admins can read or write it
// Dry run by default; pass --apply to write.
//   PB=https://... PB_EMAIL=admin PB_PASS=secret node scripts/pb-service-leads-schema.mjs [--apply]
const apply = process.argv.includes("--apply");
const PB = (process.env.PB || "").replace(/\/+$/, "");
if (!PB || !process.env.PB_EMAIL || !process.env.PB_PASS) {
  console.error("Thiếu PB, PB_EMAIL hoặc PB_PASS");
  process.exit(1);
}
const call = async (method, path, body, token, allow404 = false) => {
  const res = await fetch(PB + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (allow404 && res.status === 404) return null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
};
const { token } = await call("POST", "/api/admins/auth-with-password", { identity: process.env.PB_EMAIL, password: process.env.PB_PASS });

const TEXT = ["market", "name", "email", "phone", "business_name", "business_type", "city", "plan_interest",
  "message", "lang", "source", "tenant", "status", "order_id"];
const existing = await call("GET", "/api/collections/service_leads", null, token, true);
if (existing) {
  const key = Array.isArray(existing.fields) ? "fields" : "schema";
  const names = (existing[key] || []).map((f) => f.name);
  const missing = [...TEXT, "consent"].filter((n) => !names.includes(n));
  console.log("service_leads đã có. Field thiếu:", missing.join(", ") || "(không)");
  console.log("Rule hiện tại:", JSON.stringify({ listRule: existing.listRule, viewRule: existing.viewRule, createRule: existing.createRule, updateRule: existing.updateRule, deleteRule: existing.deleteRule }));
  const open = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"].filter((k) => existing[k] !== null);
  if (!missing.length && !open.length) { console.log("Không có gì để đổi."); process.exit(0); }
  if (!apply) { console.log("\n(dry-run) Chạy lại với --apply để ghi."); process.exit(0); }
  const patch = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
  if (missing.length) {
    patch[key] = [...(existing[key] || []), ...missing.map((name) => key === "fields"
      ? { name, type: name === "consent" ? "bool" : "text", required: false }
      : { name, type: name === "consent" ? "bool" : "text", required: false, options: {} })];
  }
  await call("PATCH", "/api/collections/service_leads", patch, token);
  console.log("Đã cập nhật service_leads.");
  process.exit(0);
}

// Detect the PocketBase generation from a collection that must exist.
const probe = await call("GET", "/api/collections/bot_configs", null, token);
const fieldsStyle = Array.isArray(probe.fields);
const columns = [...TEXT.map((name) => ({ name, type: "text", required: false })), { name: "consent", type: "bool", required: false }];
const body = {
  name: "service_leads", type: "base",
  listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
  ...(fieldsStyle
    ? { fields: [...columns,
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }] }
    : { schema: columns.map((c) => ({ ...c, options: {} })) })
};
console.log("service_leads chưa có. Sẽ tạo với", columns.length, "field, API rule đều null (chỉ admin/Worker).");
if (!apply) { console.log("\n(dry-run) Chạy lại với --apply để ghi."); process.exit(0); }
await call("POST", "/api/collections", body, token);
console.log("Đã tạo service_leads.");
