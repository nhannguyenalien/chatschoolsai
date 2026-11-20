// Scoped repair for databases where the multi-workspace migration was followed
// by an older messages schema migration. Does not change write permissions.
export const LEGACY_MESSAGE_READ = '@request.auth.id != "" && tenant = @request.auth.tenant';
export const MEMBERSHIP_MESSAGE_READ = '@request.auth.id != "" && ((tenant = @request.auth.tenant) || (@collection.tenant_memberships.account ?= @request.auth.id && @collection.tenant_memberships.tenant ?= tenant && @collection.tenant_memberships.status ?= "active"))';

export function messageReadPatch(collection) {
  const patch = {};
  for (const key of ["listRule", "viewRule"]) {
    if (collection[key] === MEMBERSHIP_MESSAGE_READ) continue;
    // Do not silently unlock admin-only collections or replace custom policies.
    if (collection[key] !== LEGACY_MESSAGE_READ) throw new Error(`Unexpected messages.${key}; review before migrating.`);
    patch[key] = MEMBERSHIP_MESSAGE_READ;
  }
  return patch;
}

export async function migrateMessagesReadAccess({ pbUrl, token, apply = false, backup }) {
  const base = pbUrl.replace(/\/$/, "");
  async function request(path, options = {}) {
    const response = await fetch(`${base}/api/collections/${path}`, {
      ...options, headers: { Authorization: token, "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`PocketBase ${options.method || "GET"} ${path}: ${response.status}`);
    return response.json();
  }
  await request("tenant_memberships");
  const before = await request("messages");
  const patch = messageReadPatch(before);
  const changed = Object.keys(patch).length > 0;
  if (!apply || !changed) return { applied: false, changed, patch };
  if (typeof backup !== "function") throw new Error("A rules backup callback is required before applying.");
  await backup(before);
  await request(before.id, { method: "PATCH", body: JSON.stringify(patch) });
  const after = await request("messages");
  for (const key of ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]) {
    if (after[key] !== (patch[key] ?? before[key])) throw new Error(`Post-migration verification failed: ${key}`);
  }
  return { applied: true, changed, patch };
}
