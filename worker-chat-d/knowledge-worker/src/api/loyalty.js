import { configureLoyaltyProgram } from "../workflows/loyalty/configureProgram.js";
import { recordLoyaltySale } from "../workflows/loyalty/recordSale.js";
import { getLoyaltyAccount } from "../workflows/loyalty/getAccount.js";
import { redeemLoyaltyPoints } from "../workflows/loyalty/redeemPoints.js";
import { LoyaltyConflictError, LoyaltyNotFoundError, LoyaltyValidationError } from "../domain/loyalty/errors.js";
import { claimReward, joinRewardCampaign, listCustomerRewards, listRewardWorld, spinRewardWorld } from "../workflows/loyalty/rewardWorld.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...JSON_HEADERS } });

async function readJson(request) {
  try { return await request.json(); }
  catch { throw new LoyaltyValidationError("Request body must be valid JSON."); }
}

function positivePage(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value || fallback);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export function createLoyaltyApi({ repository, fulfillmentService }) {
  if (!repository) throw new Error("Loyalty API requires a repository.");
  return async function handleLoyalty(request, context) {
    const tenant = context?.tenant;
    const responseHeaders = context?.responseHeaders;
    if (!tenant) return json(401, { error: "Authentication is required." }, responseHeaders);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    try {
      if (request.method === "GET" && path === "/api/v1/loyalty/program") {
        return json(200, { program: await repository.getActiveProgram(tenant) }, responseHeaders);
      }
      if (request.method === "PUT" && path === "/api/v1/loyalty/program") {
        return json(200, await configureLoyaltyProgram({ repository, tenant, input: await readJson(request) }), responseHeaders);
      }
      if (request.method === "POST" && path === "/api/v1/loyalty/sales") {
        const result = await recordLoyaltySale({ repository, tenant, input: await readJson(request) });
        return json(result.replayed ? 200 : 201, result, responseHeaders);
      }
      if (request.method === "POST" && path === "/api/v1/loyalty/redemptions") {
        const result = await redeemLoyaltyPoints({ repository, tenant, input: await readJson(request) });
        return json(result.replayed ? 200 : 201, result, responseHeaders);
      }
      if (request.method === "GET" && path === "/api/v1/loyalty/account") {
        const result = await getLoyaltyAccount({
          repository, tenant, customerRef: url.searchParams.get("customer_ref"),
          page: positivePage(url.searchParams.get("page"), 1),
          perPage: positivePage(url.searchParams.get("per_page"), 100, 500),
        });
        return json(200, result, responseHeaders);
      }
      if (request.method === "GET" && path === "/api/v1/loyalty/reward-world/campaigns") {
        return json(200, await listRewardWorld({ repository, tenant }), responseHeaders);
      }
      const joinMatch = path.match(/^\/api\/v1\/loyalty\/reward-world\/campaigns\/([^/]+)\/join$/);
      if (request.method === "POST" && joinMatch) {
        return json(200, await joinRewardCampaign({ repository, tenant, campaignId: decodeURIComponent(joinMatch[1]) }), responseHeaders);
      }
      if (request.method === "POST" && path === "/api/v1/loyalty/reward-world/spins") {
        const result = await spinRewardWorld({ repository, tenant, input: await readJson(request) });
        return json(result.replayed ? 200 : 201, result, responseHeaders);
      }
      if (request.method === "GET" && path === "/api/v1/loyalty/reward-world/rewards") {
        return json(200, await listCustomerRewards({ repository, tenant, customerRef: url.searchParams.get("customer_ref") }), responseHeaders);
      }
      const claimMatch = path.match(/^\/api\/v1\/loyalty\/reward-world\/results\/([^/]+)\/claim$/);
      if (request.method === "POST" && claimMatch) {
        const result = await claimReward({ repository, tenant, resultId: decodeURIComponent(claimMatch[1]), input: await readJson(request), fulfillmentService });
        return json(result.replayed ? 200 : 201, result, responseHeaders);
      }
      return null;
    } catch (error) {
      if (error instanceof LoyaltyValidationError) return json(400, { error: error.message }, responseHeaders);
      if (error instanceof LoyaltyNotFoundError) return json(404, { error: error.message }, responseHeaders);
      if (error instanceof LoyaltyConflictError) return json(409, { error: error.message }, responseHeaders);
      throw error;
    }
  };
}
