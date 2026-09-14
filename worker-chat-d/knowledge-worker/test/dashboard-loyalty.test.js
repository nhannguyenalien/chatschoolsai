import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardUrl = new URL("../../../dash-tabler/loyalty.html", import.meta.url);
const sidebarUrl = new URL("../../../dash-tabler/_shared/sidebar.js", import.meta.url);
const workerUrl = new URL("../src/index.js", import.meta.url);
const schemaUrl = new URL("../../../scripts/pb-loyalty-schema.mjs", import.meta.url);
const rewardAdminUrl = new URL("../../../dash-tabler/reward-world-admin.html", import.meta.url);

test("dashboard supports manual loyalty setup, sale and account lookup", async () => {
  const html = await readFile(dashboardUrl, "utf8");
  assert.match(html, /\/api\/v1\/loyalty\/program/);
  assert.match(html, /\/api\/v1\/loyalty\/sales/);
  assert.match(html, /\/api\/v1\/loyalty\/account\?customer_ref=/);
  assert.match(html, /\/api\/v1\/loyalty\/reward-world\/campaigns/);
  assert.match(html, /\/api\/v1\/loyalty\/reward-world\/spins/);
  assert.match(html, /\/api\/v1\/loyalty\/reward-world\/rewards/);
  assert.match(html, /\/claim/);
  assert.match(html, /idempotency_key:`manual:\$\{receipt\}`/);
  assert.match(html, /encodeURIComponent\(customerRef\)/);
  assert.match(html, /id="spin-wheel"/);
  assert.match(html, /animateSpinResult/);
  assert.match(html, /Kết quả được máy chủ quyết định/);
  assert.match(html, /loyaltyApiKeyPromise/);

  const sidebar = await readFile(sidebarUrl, "utf8");
  assert.match(sidebar, /href: 'loyalty\.html'/);

  const worker = await readFile(workerUrl, "utf8");
  assert.match(worker, /"GET, POST, PUT, PATCH, DELETE, OPTIONS"/);
  assert.match(worker, /ensureLoyaltySchema\(env, pbToken\)/);
  assert.match(worker, /ensureLoyaltySchema\(env2, pbToken\)/);
  const schema = await readFile(schemaUrl, "utf8");
  assert.match(schema, /reward_catalog_items/);
  assert.match(schema, /reward_fulfillments/);
});

test("reward world admin uses isolated PocketBase superuser auth and global collections", async () => {
  const html = await readFile(rewardAdminUrl, "utf8");
  assert.match(html, /reward_world_admin_auth/);
  assert.match(html, /admins\?\.authWithPassword/);
  assert.match(html, /collection\('_superusers'\)/);
  assert.match(html, /collection\('reward_campaigns'\)/);
  assert.match(html, /collection\('reward_campaign_prizes'\)/);
  assert.match(html, /collection\('reward_spin_results'\)/);
  assert.doesNotMatch(html, /X-Admin-Secret/);
});
