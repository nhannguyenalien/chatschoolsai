import { LoyaltyConflictError, LoyaltyNotFoundError, LoyaltyValidationError } from "../domain/loyalty/errors.js";
import { createManagedCampaign, createManagedPrize, listManagedRewardWorld, updateManagedCampaign, updateManagedPrize } from "../workflows/loyalty/manageRewardWorld.js";
import { listRewardCatalog, syncRewardCatalog } from "../workflows/loyalty/rewardCatalog.js";

const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
async function body(request) {
  try { return await request.json(); } catch { throw new LoyaltyValidationError("Request body must be valid JSON."); }
}

export function createRewardWorldAdminApi({ repository, providers = {} }) {
  return async (request, context = {}) => {
    const headers = context.responseHeaders;
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    try {
      if (request.method === "GET" && path === "/api/v1/admin/reward-world/campaigns") return json(200, await listManagedRewardWorld({ repository }), headers);
      if (request.method === "GET" && path === "/api/v1/admin/reward-world/catalog") {
        const url = new URL(request.url);
        return json(200, await listRewardCatalog({ repository, provider: url.searchParams.get("provider") || undefined, status: url.searchParams.get("status") || "active" }), headers);
      }
      const sync = path.match(/^\/api\/v1\/admin\/reward-world\/catalog\/sync\/(reloadly|self)$/);
      if (request.method === "POST" && sync) {
        const provider = providers[sync[1]];
        if (!provider) throw new LoyaltyConflictError(`Reward provider ${sync[1]} is not configured.`);
        return json(200, await syncRewardCatalog({ repository, provider, providerName: sync[1], options: await body(request) }), headers);
      }
      if (request.method === "POST" && path === "/api/v1/admin/reward-world/campaigns") return json(201, await createManagedCampaign({ repository, input: await body(request) }), headers);
      const campaign = path.match(/^\/api\/v1\/admin\/reward-world\/campaigns\/([^/]+)$/);
      if (request.method === "PATCH" && campaign) return json(200, await updateManagedCampaign({ repository, campaignId: decodeURIComponent(campaign[1]), input: await body(request) }), headers);
      const prizes = path.match(/^\/api\/v1\/admin\/reward-world\/campaigns\/([^/]+)\/prizes$/);
      if (request.method === "POST" && prizes) return json(201, await createManagedPrize({ repository, campaignId: decodeURIComponent(prizes[1]), input: await body(request) }), headers);
      const prize = path.match(/^\/api\/v1\/admin\/reward-world\/prizes\/([^/]+)$/);
      if (request.method === "PATCH" && prize) return json(200, await updateManagedPrize({ repository, prizeId: decodeURIComponent(prize[1]), input: await body(request) }), headers);
      return null;
    } catch (error) {
      if (error instanceof LoyaltyValidationError) return json(400, { error: error.message }, headers);
      if (error instanceof LoyaltyNotFoundError) return json(404, { error: error.message }, headers);
      if (error instanceof LoyaltyConflictError) return json(409, { error: error.message }, headers);
      throw error;
    }
  };
}
