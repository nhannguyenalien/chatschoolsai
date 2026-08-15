import { LoyaltyConflictError, LoyaltyValidationError } from "../../domain/loyalty/errors.js";

export function createPosRewardProvider({ baseUrl, apiKey, fetchImpl = fetch }) {
  const request = async (path, options = {}) => {
    if (!baseUrl || !apiKey) throw new LoyaltyConflictError("POS reward source is not configured.");
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}${path}`, { ...options, headers: { authorization: `Bearer ${apiKey}`, ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new LoyaltyConflictError(`POS request failed (${response.status}): ${data.error || "provider error"}.`);
    return data;
  };
  return {
    async listCatalog() {
      const data = await request("/api/inventory/stock");
      return (data.items || data.stock || data || []).filter((item) => Number(item.qty) > 0).map((item) => ({
        source_type: "internal", provider: "self", external_ref: String(item.variant_id), name: item.product_name || item.sku,
        stock_management: "self_tracked", cost_to_platform: Number(item.last_cost || 0), face_value: Number(item.price || 0),
        currency: "VND", country_code: "VN", image_url: "", status: "active", available_stock: Number(item.qty),
        source_config_json: JSON.stringify({ variant_id: item.variant_id, sku: item.sku, product_id: item.product_id }),
      }));
    },
    async fulfill({ catalogItem, fulfillmentId }) {
      const config = JSON.parse(catalogItem.source_config_json || "{}");
      if (!config.variant_id) throw new LoyaltyValidationError("POS catalog item is missing variant_id.");
      const result = await request("/api/inventory", { method: "POST", body: JSON.stringify({ product_variant_id: config.variant_id, type: "OUT", quantity: 1, note: `Reward fulfillment ${fulfillmentId}` }) });
      return { provider_ref: String(result.id || result.transaction_id || fulfillmentId), status: "fulfilled", delivery: { fulfillment_method: "store_pickup", sku: config.sku || "" } };
    },
  };
}
