import test from "node:test";
import assert from "node:assert/strict";
import { createReloadlyRewardProvider } from "../src/adapters/rewards/reloadly.js";
import { createPosRewardProvider } from "../src/adapters/rewards/pos.js";
import { fulfillClaim, syncRewardCatalog } from "../src/workflows/loyalty/rewardCatalog.js";

const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("Reloadly adapter authenticates and maps products into unified catalog", async () => {
  const calls = [];
  const provider = createReloadlyRewardProvider({ clientId: "id", clientSecret: "secret", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.includes("oauth/token")) return response({ access_token: "token", expires_in: 3600 });
    return response({ content: [{ productId: 10, productName: "Amazon US", fixedRecipientDenominations: [5], recipientCurrencyCode: "USD", country: { isoName: "US" } }] });
  } });
  const items = await provider.listCatalog({ countryCode: "us" });
  assert.equal(items[0].provider, "reloadly");
  assert.equal(items[0].external_ref, "10");
  assert.equal(items[0].face_value, 5);
  assert.match(calls[1].url, /countryCode=US/);
  assert.doesNotMatch(JSON.stringify(calls[1]), /secret/);
});

test("POS adapter maps stock and decrements the selected variant", async () => {
  const calls = [];
  const provider = createPosRewardProvider({ baseUrl: "https://pos.test/", apiKey: "key", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (!options?.method) return response({ items: [{ variant_id: "v1", sku: "CAFE", product_name: "Cafe 50K", qty: 3, price: 50000, last_cost: 45000 }] });
    return response({ transaction_id: "tx-1", new_qty: 2 }, 201);
  } });
  const [item] = await provider.listCatalog();
  assert.equal(item.source_type, "internal");
  assert.equal(item.available_stock, 3);
  const result = await provider.fulfill({ catalogItem: item, fulfillmentId: "ful-1" });
  assert.equal(result.provider_ref, "tx-1");
  assert.equal(JSON.parse(calls[1].options.body).product_variant_id, "v1");
});

test("catalog sync upserts by provider external reference", async () => {
  const records = [];
  const result = await syncRewardCatalog({ providerName: "self", provider: { async listCatalog() { return [{ external_ref: "v1" }, { external_ref: "v2" }]; } }, repository: { async upsertCatalogItem(record) { records.push(record); return { created: record.external_ref === "v1" }; } } });
  assert.deepEqual({ fetched: result.fetched, created: result.created, updated: result.updated }, { fetched: 2, created: 1, updated: 1 });
});

test("fulfillment is idempotent by claim and routes without exposing source above catalog", async () => {
  let providerCalls = 0; let saved;
  const repository = {
    async getCatalogItem() { return { id: "cat-1", provider: "self", source_type: "internal", status: "active", source_config_json: "{}" }; },
    async findFulfillmentByClaim() { return null; },
    async createRewardFulfillment(record) { return { id: "ful-1", ...record }; },
    async updateRewardFulfillment(id, patch) { saved = { id, ...patch }; return saved; },
  };
  const output = await fulfillClaim({ repository, providers: { self: { async fulfill() { providerCalls += 1; return { provider_ref: "tx-1", status: "fulfilled", delivery: {} }; } } }, tenant: "store", claim: { id: "claim" }, result: { id: "result", campaign_id: "campaign", prize_value_json: JSON.stringify({ catalog_item_id: "cat-1" }) } });
  assert.equal(providerCalls, 1);
  assert.equal(output.fulfillment.status, "fulfilled");
  assert.equal(saved.provider_ref, "tx-1");
});
