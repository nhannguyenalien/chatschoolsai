#!/usr/bin/env node
// Prepares PocketBase for the one-time onboarding package ($300 / workspace):
//  - adds bot_configs.setup_status, setup_orders, setup_paid_at (text)
//  - forbids clients from writing them (only the Worker, with the admin token, may)
// Dry run by default; pass --apply to write.
//   PB=https://... PB_EMAIL=admin PB_PASS=secret node scripts/pb-setup-package-schema.mjs [--apply]
const apply = process.argv.includes("--apply");
const PB = (process.env.PB || "").replace(/\/+$/, "");
if (!PB || !process.env.PB_EMAIL || !process.env.PB_PASS) {
  console.error("Thiếu PB, PB_EMAIL hoặc PB_PASS");
  process.exit(1);
}
const call = async (method, path, body, token) => {
  const res = await fetch(PB + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
};
const { token } = await call("POST", "/api/admins/auth-with-password", { identity: process.env.PB_EMAIL, password: process.env.PB_PASS });
const collection = await call("GET", "/api/collections/bot_configs", null, token);

const FIELDS = ["setup_status", "setup_orders", "setup_paid_at"];
const fieldsKey = Array.isArray(collection.fields) ? "fields" : "schema";
const existing = collection[fieldsKey] || [];
const missing = FIELDS.filter((name) => !existing.some((f) => f.name === name));
const guard = FIELDS.map((name) => `@request.data.${name}:isset = false`).join(" && ");
const guarded = (rule) => (rule && !rule.includes("setup_status:isset") ? `${rule} && ${guard}` : rule);

const patch = {};
if (missing.length) {
  patch[fieldsKey] = [...existing, ...missing.map((name) =>
    fieldsKey === "fields" ? { name, type: "text", required: false } : { name, type: "text", required: false, options: {} })];
}
for (const key of ["createRule", "updateRule"]) {
  const next = guarded(collection[key]);
  if (next !== collection[key]) patch[key] = next;
}

console.log("Field thiếu:", missing.join(", ") || "(không)");
console.log("Rule cần siết:", ["createRule", "updateRule"].filter((k) => patch[k]).join(", ") || "(không)");
console.log("Rule cũ (để hoàn tác):", JSON.stringify({ createRule: collection.createRule, updateRule: collection.updateRule }));
if (!Object.keys(patch).length) { console.log("Không có gì để đổi."); process.exit(0); }
if (!apply) { console.log("\n(dry-run) Chạy lại với --apply để ghi."); process.exit(0); }
const updated = await call("PATCH", "/api/collections/bot_configs", patch, token);
const names = (updated[fieldsKey] || []).map((f) => f.name);
console.log("\nĐã ghi. Field có đủ:", FIELDS.every((n) => names.includes(n)), "| rule đã siết:", ["createRule", "updateRule"].every((k) => (updated[k] || "").includes("setup_status:isset")));
