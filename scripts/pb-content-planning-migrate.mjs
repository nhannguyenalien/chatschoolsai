#!/usr/bin/env node
import { CONTENT_PLANNING_COLLECTIONS, CONTENT_PLANNING_COLLECTION_EXTENSIONS } from "./pb-content-planning-schema.mjs";

const apply = process.argv.includes("--apply");
const baseUrl = process.env.PB_URL?.replace(/\/$/, "");
const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASS;

if (!apply) {
  console.log("DRY RUN: no PocketBase changes will be made. Pass --apply with PB_URL/PB_ADMIN_EMAIL/PB_ADMIN_PASS after taking a backup.\n");
  for (const collection of CONTENT_PLANNING_COLLECTIONS) {
    console.log(`CREATE if missing: ${collection.name} (${collection.schema.length} fields, ${(collection.indexes || []).length} indexes)`);
  }
  for (const [name, fields] of Object.entries(CONTENT_PLANNING_COLLECTION_EXTENSIONS)) {
    console.log(`EXTEND if needed: ${name} (+${fields.map((field) => field.name).join(", ")})`);
  }
  process.exit(0);
}
if (!baseUrl || !email || !password) throw new Error("--apply requires PB_URL, PB_ADMIN_EMAIL and PB_ADMIN_PASS.");
if (process.env.PB_BACKUP_CONFIRMED !== "yes") throw new Error("Refusing migration: set PB_BACKUP_CONFIRMED=yes after verifying a recoverable PocketBase backup.");

async function authenticate() {
  const body = JSON.stringify({ identity: email, password });
  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.token) return { token: data.token, modernCollectionsApi: path.includes("/_superusers/") };
    if (response.status !== 404) throw new Error(`PocketBase admin authentication failed: ${data.message || response.status}`);
  }
  throw new Error("PocketBase admin authentication failed: no supported superuser endpoint was found.");
}

const { token, modernCollectionsApi } = await authenticate();
const headers = { Authorization: token, "Content-Type": "application/json" };

function modernField(field) {
  const { options = {}, ...base } = field;
  if (field.type === "number") return { ...base, min: options.min, max: options.max, onlyInt: options.noDecimal };
  return { ...base, ...options };
}

const MODERN_AUDIT_FIELDS = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

for (const [name, fields] of Object.entries(CONTENT_PLANNING_COLLECTION_EXTENSIONS)) {
  const response = await fetch(`${baseUrl}/api/collections/${name}`, { headers });
  if (!response.ok) throw new Error(`Cannot inspect required collection ${name}: HTTP ${response.status}`);
  const existing = await response.json();
  const key = modernCollectionsApi ? "fields" : "schema";
  const current = existing[key] || [];
  const missing = fields.filter((field) => !current.some((candidate) => candidate.name === field.name));
  if (!missing.length) {
    console.log(`SKIP extensions present: ${name}`);
    continue;
  }
  const additions = modernCollectionsApi ? missing.map(modernField) : missing;
  const patched = await fetch(`${baseUrl}/api/collections/${existing.id}`, {
    method: "PATCH", headers, body: JSON.stringify({ [key]: [...current, ...additions] }),
  });
  if (!patched.ok) throw new Error(`Cannot extend ${name}: ${await patched.text()}`);
  console.log(`EXTENDED: ${name} (+${missing.map((field) => field.name).join(", ")})`);
}

for (const definition of CONTENT_PLANNING_COLLECTIONS) {
  const existing = await fetch(`${baseUrl}/api/collections/${definition.name}`, { headers });
  if (existing.ok) {
    const currentDefinition = await existing.json();
    const key = modernCollectionsApi ? "fields" : "schema";
    const currentFields = currentDefinition[key] || [];
    const desiredFields = modernCollectionsApi ? [...definition.schema, ...MODERN_AUDIT_FIELDS] : definition.schema;
    const missing = desiredFields.filter((field) => !currentFields.some((candidate) => candidate.name === field.name));
    const desiredIndexes = [...new Set([...(currentDefinition.indexes || []), ...(definition.indexes || [])])];
    if (!missing.length && desiredIndexes.length === (currentDefinition.indexes || []).length) {
      console.log(`SKIP existing: ${definition.name}`);
      continue;
    }
    const additions = modernCollectionsApi ? missing.map(modernField) : missing;
    const patched = await fetch(`${baseUrl}/api/collections/${currentDefinition.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ [key]: [...currentFields, ...additions], indexes: desiredIndexes }),
    });
    if (!patched.ok) throw new Error(`Cannot update ${definition.name}: ${await patched.text()}`);
    console.log(`UPDATED: ${definition.name} (+${missing.map((field) => field.name).join(", ") || "indexes"})`);
    continue;
  }
  if (existing.status !== 404) throw new Error(`Cannot inspect ${definition.name}: HTTP ${existing.status}`);
  const payload = modernCollectionsApi
    ? { ...definition, fields: [...definition.schema, ...MODERN_AUDIT_FIELDS].map(modernField) }
    : { ...definition };
  if (modernCollectionsApi) delete payload.schema;
  const created = await fetch(`${baseUrl}/api/collections`, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!created.ok) throw new Error(`Cannot create ${definition.name}: ${await created.text()}`);
  console.log(`CREATED: ${definition.name}`);
}
