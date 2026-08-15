#!/usr/bin/env node
import { LOYALTY_COLLECTIONS } from "./pb-loyalty-schema.mjs";

const apply = process.argv.includes("--apply");
const baseUrl = process.env.PB_URL?.replace(/\/$/, "");
const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASS;

if (!apply) {
  console.log("DRY RUN: no PocketBase changes will be made. Pass --apply after taking a backup.\n");
  for (const collection of LOYALTY_COLLECTIONS) {
    console.log(`CREATE/UPDATE: ${collection.name} (${collection.schema.length} fields, ${collection.indexes.length} indexes)`);
  }
  process.exit(0);
}
if (!baseUrl || !email || !password) throw new Error("--apply requires PB_URL, PB_ADMIN_EMAIL and PB_ADMIN_PASS.");
if (process.env.PB_BACKUP_CONFIRMED !== "yes") throw new Error("Set PB_BACKUP_CONFIRMED=yes after verifying a recoverable backup.");

async function authenticate() {
  const body = JSON.stringify({ identity: email, password });
  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.token) return { token: data.token, modern: path.includes("_superusers") };
    if (response.status !== 404) throw new Error(`PocketBase authentication failed: ${data.message || response.status}`);
  }
  throw new Error("No supported PocketBase superuser endpoint was found.");
}

const { token, modern } = await authenticate();
const headers = { Authorization: token, "Content-Type": "application/json" };
const auditFields = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];
function modernField(field) {
  const { options = {}, ...base } = field;
  if (field.type === "number") return { ...base, min: options.min, max: options.max, onlyInt: options.noDecimal };
  return { ...base, ...options };
}

for (const definition of LOYALTY_COLLECTIONS) {
  const inspected = await fetch(`${baseUrl}/api/collections/${definition.name}`, { headers });
  if (inspected.ok) {
    const current = await inspected.json();
    const key = modern ? "fields" : "schema";
    const currentFields = current[key] || [];
    const desired = modern ? [...definition.schema, ...auditFields] : definition.schema;
    const missing = desired.filter((field) => !currentFields.some((candidate) => candidate.name === field.name));
    const indexes = [...new Set([...(current.indexes || []), ...definition.indexes])];
    if (!missing.length && indexes.length === (current.indexes || []).length) { console.log(`SKIP: ${definition.name}`); continue; }
    const additions = modern ? missing.map(modernField) : missing;
    const response = await fetch(`${baseUrl}/api/collections/${current.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ [key]: [...currentFields, ...additions], indexes }),
    });
    if (!response.ok) throw new Error(`Cannot update ${definition.name}: ${await response.text()}`);
    console.log(`UPDATED: ${definition.name}`);
    continue;
  }
  if (inspected.status !== 404) throw new Error(`Cannot inspect ${definition.name}: HTTP ${inspected.status}`);
  const payload = modern
    ? { ...definition, fields: [...definition.schema, ...auditFields].map(modernField) }
    : { ...definition };
  if (modern) delete payload.schema;
  const response = await fetch(`${baseUrl}/api/collections`, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Cannot create ${definition.name}: ${await response.text()}`);
  console.log(`CREATED: ${definition.name}`);
}
