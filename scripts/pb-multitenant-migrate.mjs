#!/usr/bin/env node
/**
 * Additive multi-tenant migration for the dashboard.
 *
 * Dry-run (default): node scripts/pb-multitenant-migrate.mjs
 * Apply:
 *   PB_URL=https://... PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... \
 *   node scripts/pb-multitenant-migrate.mjs --apply
 *
 * Existing `tenants.tenant` values remain the default workspace. Public API
 * keys and existing data are not changed.
 */

const apply = process.argv.includes("--apply");
const baseUrl = String(process.env.PB_URL || "").replace(/\/$/, "");
const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASS;

const membershipRead = '(@collection.tenant_memberships.account ?= @request.auth.id && @collection.tenant_memberships.tenant ?= tenant && @collection.tenant_memberships.status ?= "active")';
const membershipWrite = `(${membershipRead} && (@collection.tenant_memberships.role ?= "owner" || @collection.tenant_memberships.role ?= "admin" || @collection.tenant_memberships.role ?= "editor"))`;
const legacy = '(tenant = @request.auth.tenant)';
const authenticated = '@request.auth.id != ""';
const rules = {
  listRule: `${authenticated} && (${legacy} || ${membershipRead})`,
  viewRule: `${authenticated} && (${legacy} || ${membershipRead})`,
  createRule: `${authenticated} && (${legacy} || ${membershipWrite})`,
  updateRule: `${authenticated} && (${legacy} || ${membershipWrite})`,
  deleteRule: `${authenticated} && (${legacy} || ${membershipWrite})`,
};

if (!apply) {
  console.log("DRY RUN — chưa thay đổi PocketBase.");
  console.log("Sẽ tạo tenant_memberships, backfill tenant cũ và cập nhật rule cho collection tenant đang mở cho dashboard.");
  console.log("Chạy lại với --apply và PB_URL/PB_ADMIN_EMAIL/PB_ADMIN_PASS sau khi backup.");
  process.exit(0);
}
if (!baseUrl || !email || !password) throw new Error("--apply cần PB_URL, PB_ADMIN_EMAIL và PB_ADMIN_PASS.");
if (process.env.PB_BACKUP_CONFIRMED !== "yes") throw new Error("Từ chối migration: hãy backup PocketBase rồi đặt PB_BACKUP_CONFIRMED=yes.");

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} (${response.status}): ${JSON.stringify(data)}`);
  return data;
}

async function authenticate() {
  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    try {
      const data = await jsonRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: email, password }),
      });
      if (data.token) return { token: data.token, modern: path.includes("_superusers") };
    } catch (error) {
      if (!String(error.message).includes("(404)")) throw error;
    }
  }
  throw new Error("Không đăng nhập được PocketBase superuser.");
}

async function getAll(path, headers) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const data = await jsonRequest(`${path}${separator}page=${page}&perPage=200`, { headers });
    items.push(...(data.items || []));
    if (page >= (data.totalPages || 1)) return items;
  }
}

function fieldsOf(collection) {
  return collection.fields || collection.schema || [];
}

function modernField(field) {
  const { options = {}, ...base } = field;
  return { ...base, ...options };
}

function membershipDefinition(accountCollectionId, modern) {
  const fields = [
    { name: "account", type: "relation", required: true, options: { collectionId: accountCollectionId, cascadeDelete: true, maxSelect: 1, minSelect: 1 } },
    { name: "tenant", type: "text", required: true, options: { min: 1, max: 120, pattern: "" } },
    { name: "role", type: "select", required: true, options: { maxSelect: 1, values: ["owner", "admin", "editor", "viewer"] } },
    { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["active", "inactive", "pending"] } },
    { name: "is_default", type: "bool", required: false, options: {} },
  ];
  return {
    name: "tenant_memberships",
    type: "base",
    [modern ? "fields" : "schema"]: modern ? fields.map(modernField) : fields,
    indexes: ['CREATE UNIQUE INDEX `idx_tenant_membership_unique` ON `tenant_memberships` (`account`, `tenant`)'],
    listRule: '@request.auth.id != "" && account = @request.auth.id',
    viewRule: '@request.auth.id != "" && account = @request.auth.id',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  };
}

const { token, modern } = await authenticate();
const headers = { Authorization: token, "Content-Type": "application/json" };
const collections = await getAll("/api/collections", headers);
const accounts = collections.find((collection) => collection.name === "tenants");
if (!accounts) throw new Error('Không tìm thấy auth collection "tenants".');

let memberships = collections.find((collection) => collection.name === "tenant_memberships");
if (!memberships) {
  memberships = await jsonRequest("/api/collections", {
    method: "POST",
    headers,
    body: JSON.stringify(membershipDefinition(accounts.id, modern)),
  });
  console.log("+ Đã tạo tenant_memberships");
} else {
  console.log("= tenant_memberships đã tồn tại");
}

const accountRecords = await getAll(`/api/collections/${accounts.id}/records?filter=${encodeURIComponent('tenant != ""')}`, headers);
const existingMemberships = await getAll(`/api/collections/${memberships.id}/records`, headers);
const existingKeys = new Set(existingMemberships.map((record) => `${record.account}:${record.tenant}`));
let backfilled = 0;
for (const account of accountRecords) {
  const key = `${account.id}:${account.tenant}`;
  if (existingKeys.has(key)) continue;
  await jsonRequest(`/api/collections/${memberships.id}/records`, {
    method: "POST",
    headers,
    body: JSON.stringify({ account: account.id, tenant: account.tenant, role: "owner", status: "active", is_default: true }),
  });
  backfilled += 1;
}
console.log(`+ Backfill ${backfilled} membership; ${accountRecords.length - backfilled} đã có sẵn`);

let patched = 0;
const failed = [];
const nameCounts = new Map();
for (const collection of collections) nameCounts.set(collection.name.toLowerCase(), (nameCounts.get(collection.name.toLowerCase()) || 0) + 1);
for (const collection of collections) {
  if (collection.name === "tenant_memberships" || collection.name === "tenants") continue;
  if (!fieldsOf(collection).some((field) => field.name === "tenant")) continue;
  // Rule null là "superuser only". Giữ nguyên từng rule bị khóa, kể cả khi
  // các thao tác khác của cùng collection đang mở cho dashboard.
  const rulePatch = Object.fromEntries(
    Object.entries(rules).filter(([key]) => collection[key] !== null),
  );
  if (Object.keys(rulePatch).length === 0) continue;
  try {
    await jsonRequest(`/api/collections/${collection.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(rulePatch),
    });
    patched += 1;
    console.log(`  ✓ ${collection.name}`);
  } catch (error) {
    // Một collection lỗi (vd trùng tên không phân biệt hoa thường) không được chặn các collection còn lại.
    failed.push(collection.name);
    console.error(`  ✗ ${collection.name} (${collection.id})${nameCounts.get(collection.name.toLowerCase()) > 1 ? " — TRÙNG TÊN với collection khác" : ""}: ${error.message}`);
  }
}
console.log(`+ Đã bật multi-tenant có kiểm soát cho ${patched} collection dashboard`);
if (failed.length) console.error(`Chưa sửa được ${failed.length} collection: ${failed.join(", ")}`);
console.log("Hoàn tất. Tenant/API key/dữ liệu cũ không bị thay đổi.");
