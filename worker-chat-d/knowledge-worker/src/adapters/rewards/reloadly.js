import { LoyaltyConflictError, LoyaltyValidationError } from "../../domain/loyalty/errors.js";

const API_VERSION = "application/com.reloadly.giftcards-v1+json";

export function createReloadlyRewardProvider({ clientId, clientSecret, sandbox = true, fetchImpl = fetch }) {
  const baseUrl = sandbox ? "https://giftcards-sandbox.reloadly.com" : "https://giftcards.reloadly.com";
  let token;
  let tokenExpiresAt = 0;

  async function accessToken() {
    if (!clientId || !clientSecret) throw new LoyaltyConflictError("Reloadly is not configured.");
    if (token && Date.now() < tokenExpiresAt - 60_000) return token;
    const response = await fetchImpl("https://auth.reloadly.com/oauth/token", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials", audience: baseUrl }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new LoyaltyConflictError(`Reloadly authentication failed (${response.status}).`);
    token = data.access_token;
    tokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
    return token;
  }

  async function request(path, options = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...options,
      headers: { accept: API_VERSION, authorization: `Bearer ${await accessToken()}`, ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new LoyaltyConflictError(`Reloadly request failed (${response.status}): ${data.message || data.errorCode || "provider error"}.`);
    return data;
  }

  return {
    async listCatalog({ countryCode, page = 1, perPage = 100 } = {}) {
      const query = new URLSearchParams({ page: String(page), size: String(perPage) });
      if (countryCode) query.set("countryCode", String(countryCode).toUpperCase());
      const data = await request(`/products?${query}`);
      return (data.content || data).map((item) => ({
        source_type: "external_api", provider: "reloadly", external_ref: String(item.productId),
        name: item.productName, stock_management: "provider_managed",
        cost_to_platform: 0, face_value: Number(item.fixedRecipientDenominations?.[0] || item.minRecipientDenomination || 0),
        currency: item.recipientCurrencyCode || item.senderCurrencyCode || "", country_code: item.country?.isoName || item.countryCode || "",
        image_url: item.logoUrls?.[0] || item.brand?.logoUrl || "", status: "active",
        source_config_json: JSON.stringify({ productId: item.productId, fixedRecipientDenominations: item.fixedRecipientDenominations || [], minRecipientDenomination: item.minRecipientDenomination, maxRecipientDenomination: item.maxRecipientDenomination }),
      }));
    },
    async fulfill({ catalogItem, fulfillmentId, recipient }) {
      if (!recipient?.email) throw new LoyaltyValidationError("recipient_email is required for Reloadly rewards.");
      const config = JSON.parse(catalogItem.source_config_json || "{}");
      const unitPrice = Number(catalogItem.face_value || config.unitPrice);
      if (!config.productId || !(unitPrice > 0)) throw new LoyaltyValidationError("Reloadly catalog item is missing productId or face_value.");
      const order = await request("/orders", { method: "POST", body: JSON.stringify({
        productId: Number(config.productId), countryCode: catalogItem.country_code,
        quantity: 1, unitPrice, customIdentifier: fulfillmentId,
        senderName: recipient.sender_name || "Reward World", recipientEmail: recipient.email,
      }) });
      return { provider_ref: String(order.transactionId), status: String(order.status || "PROCESSING").toUpperCase() === "SUCCESSFUL" ? "fulfilled" : "processing", delivery: { recipient_email: recipient.email, provider_status: order.status, custom_identifier: fulfillmentId } };
    },
  };
}
