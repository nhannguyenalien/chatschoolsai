import { escapePocketBaseFilter } from "./client.js";
import { LoyaltyConflictError } from "../../domain/loyalty/errors.js";

const COLLECTIONS = {
  programs: "loyalty_programs", customers: "loyalty_customers", ledger: "loyalty_ledger",
  campaigns: "reward_campaigns", prizes: "reward_campaign_prizes", joins: "reward_store_joins",
  entitlements: "reward_spin_entitlements", results: "reward_spin_results",
  claims: "reward_claims",
  catalog: "reward_catalog_items", fulfillments: "reward_fulfillments",
};
const equal = (field, value) => `${field}='${escapePocketBaseFilter(value)}'`;
const tenantScope = (tenant) => equal("tenant", tenant);

export function createLoyaltyRepository(client) {
  return {
    async getActiveProgram(tenant) {
      const result = await client.list(COLLECTIONS.programs, {
        filter: `${tenantScope(tenant)} && status='active'`, sort: "-version", perPage: 1,
      });
      return result.items?.[0] || null;
    },
    async nextProgramVersion(tenant) {
      const result = await client.list(COLLECTIONS.programs, { filter: tenantScope(tenant), sort: "-version", perPage: 1 });
      return Number(result.items?.[0]?.version || 0) + 1;
    },
    createProgram(program) { return client.create(COLLECTIONS.programs, program); },
    updateProgram(id, patch) { return client.update(COLLECTIONS.programs, id, patch); },
    async archiveActivePrograms(tenant, exceptProgramId = null) {
      const result = await client.list(COLLECTIONS.programs, {
        filter: `${tenantScope(tenant)} && status='active'`, perPage: 100,
      });
      await Promise.all((result.items || [])
        .filter((item) => item.id !== exceptProgramId)
        .map((item) => client.update(COLLECTIONS.programs, item.id, { status: "archived" })));
    },
    async findCustomerByRef(tenant, customerRef) {
      const result = await client.list(COLLECTIONS.customers, {
        filter: `${tenantScope(tenant)} && ${equal("customer_ref", customerRef)}`, perPage: 1,
      });
      return result.items?.[0] || null;
    },
    async findOrCreateCustomer(tenant, customerRef, profile = {}) {
      const existing = await this.findCustomerByRef(tenant, customerRef);
      if (existing) return existing;
      try {
        return await client.create(COLLECTIONS.customers, {
          tenant, customer_ref: customerRef, name: profile.name || "", phone: profile.phone || "", status: "active",
        });
      } catch (cause) {
        const winner = await this.findCustomerByRef(tenant, customerRef);
        if (winner) return winner;
        throw cause;
      }
    },
    async findLedgerByIdempotencyKey(tenant, idempotencyKey) {
      const result = await client.list(COLLECTIONS.ledger, {
        filter: `${tenantScope(tenant)} && ${equal("idempotency_key", idempotencyKey)}`, perPage: 1,
      });
      return result.items?.[0] || null;
    },
    async findLedgerBySource(tenant, sourceType, sourceRef) {
      const result = await client.list(COLLECTIONS.ledger, {
        filter: `${tenantScope(tenant)} && ${equal("source_type", sourceType)} && ${equal("source_ref", sourceRef)}`,
        perPage: 1,
      });
      return result.items?.[0] || null;
    },
    async appendLedger(entry) {
      try {
        return { entry: await client.create(COLLECTIONS.ledger, entry), replayed: false };
      } catch (cause) {
        const winner = await this.findLedgerByIdempotencyKey(entry.tenant, entry.idempotency_key);
        if (winner) return { entry: winner, replayed: true };
        throw cause;
      }
    },
    listCustomerLedger(tenant, customerId, { page = 1, perPage = 100 } = {}) {
      return client.list(COLLECTIONS.ledger, {
        filter: `${tenantScope(tenant)} && ${equal("customer_id", customerId)}`, sort: "created", page, perPage,
      });
    },
    async listAllCustomerLedger(tenant, customerId) {
      const entries = [];
      let page = 1;
      while (true) {
        const result = await this.listCustomerLedger(tenant, customerId, { page, perPage: 500 });
        entries.push(...(result.items || []));
        if (page >= Number(result.totalPages || 1)) return entries;
        page += 1;
      }
    },
    async listRewardCampaigns() {
      const result = await client.list(COLLECTIONS.campaigns, { filter: "status='active'", sort: "starts_at", perPage: 100 });
      return result.items || [];
    },
    async listAllRewardCampaigns() {
      const result = await client.list(COLLECTIONS.campaigns, { sort: "-created", perPage: 200 });
      return result.items || [];
    },
    createRewardCampaign(record) { return client.create(COLLECTIONS.campaigns, record); },
    updateRewardCampaign(id, patch) { return client.update(COLLECTIONS.campaigns, id, patch); },
    async getRewardCampaign(id) {
      try { return await client.get(COLLECTIONS.campaigns, id); } catch (error) { if (error.status === 404) return null; throw error; }
    },
    async listCampaignPrizes(campaignId) {
      const result = await client.list(COLLECTIONS.prizes, { filter: `${equal("campaign_id", campaignId)} && status='active'`, sort: "sort_order", perPage: 100 });
      return result.items || [];
    },
    async listAllCampaignPrizes(campaignId) {
      const result = await client.list(COLLECTIONS.prizes, { filter: equal("campaign_id", campaignId), sort: "sort_order", perPage: 200 });
      return result.items || [];
    },
    createCampaignPrize(record) { return client.create(COLLECTIONS.prizes, record); },
    async getCampaignPrize(id) {
      try { return await client.get(COLLECTIONS.prizes, id); } catch (error) { if (error.status === 404) return null; throw error; }
    },
    updateCampaignPrize(id, patch) { return client.update(COLLECTIONS.prizes, id, patch); },
    async listAvailableCampaignPrizes(campaignId) {
      const prizes = await this.listCampaignPrizes(campaignId);
      const available = [];
      for (const prize of prizes) {
        const results = await client.list(COLLECTIONS.results, { filter: equal("prize_id", prize.id), perPage: 1 });
        const wins = Number(results.totalItems || 0);
        if (!Number(prize.max_wins) || wins < Number(prize.max_wins)) {
          available.push({ ...prize, next_win_number: wins + 1 });
        }
      }
      return available;
    },
    async listStoreCampaignJoins(tenant) {
      const result = await client.list(COLLECTIONS.joins, { filter: `${tenantScope(tenant)} && status='active'`, perPage: 100 });
      return result.items || [];
    },
    async findStoreCampaignJoin(tenant, campaignId) {
      const result = await client.list(COLLECTIONS.joins, { filter: `${tenantScope(tenant)} && ${equal("campaign_id", campaignId)} && status='active'`, perPage: 1 });
      return result.items?.[0] || null;
    },
    async joinRewardCampaign(tenant, campaignId, joinedAt) {
      const existing = await this.findStoreCampaignJoin(tenant, campaignId);
      if (existing) return { join: existing, replayed: true };
      try { return { join: await client.create(COLLECTIONS.joins, { tenant, campaign_id: campaignId, status: "active", joined_at: joinedAt }), replayed: false }; }
      catch (cause) { const winner = await this.findStoreCampaignJoin(tenant, campaignId); if (winner) return { join: winner, replayed: true }; throw cause; }
    },
    async issueRewardEntitlementsForSale({ tenant, customerRef, sourceRef, amountMinor, occurredAt }) {
      const joins = await this.listStoreCampaignJoins(tenant);
      const issued = [];
      for (const join of joins) {
        const campaign = await this.getRewardCampaign(join.campaign_id);
        if (!campaign || campaign.status !== "active") continue;
        const threshold = Math.max(1, Number(campaign.spend_per_spin_minor || 1));
        const count = Math.min(Math.floor(amountMinor / threshold), Math.max(1, Number(campaign.max_spins_per_sale || 1)));
        for (let ordinal = 1; ordinal <= count; ordinal += 1) {
          const sourceKey = `${sourceRef}:${ordinal}`;
          try {
            issued.push(await client.create(COLLECTIONS.entitlements, {
              tenant, campaign_id: campaign.id, customer_ref: customerRef, source_type: "sale",
              source_ref: sourceKey, status: "available", issued_at: occurredAt,
            }));
          } catch (cause) {
            const found = await client.list(COLLECTIONS.entitlements, { filter: `${tenantScope(tenant)} && ${equal("campaign_id", campaign.id)} && ${equal("source_ref", sourceKey)}`, perPage: 1 });
            if (found.items?.[0]) issued.push(found.items[0]); else throw cause;
          }
        }
      }
      return issued;
    },
    async findSpinResultByIdempotency(tenant, key) {
      const result = await client.list(COLLECTIONS.results, { filter: `${tenantScope(tenant)} && ${equal("idempotency_key", key)}`, perPage: 1 });
      return result.items?.[0] || null;
    },
    async findAvailableSpinEntitlement(tenant, campaignId, customerRef) {
      const candidates = await client.list(COLLECTIONS.entitlements, { filter: `${tenantScope(tenant)} && ${equal("campaign_id", campaignId)} && ${equal("customer_ref", customerRef)} && status='available'`, sort: "created", perPage: 100 });
      for (const item of candidates.items || []) {
        const used = await client.list(COLLECTIONS.results, { filter: equal("entitlement_id", item.id), perPage: 1 });
        if (!used.items?.length) return item;
      }
      return null;
    },
    async createSpinResult(record) {
      try { return { result: await client.create(COLLECTIONS.results, record), replayed: false }; }
      catch (cause) {
        const replay = await this.findSpinResultByIdempotency(record.tenant, record.idempotency_key);
        if (replay) return { result: replay, replayed: true };
        const used = await client.list(COLLECTIONS.results, { filter: equal("entitlement_id", record.entitlement_id), perPage: 1 });
        if (used.items?.[0]) return { result: used.items[0], replayed: true };
        throw new LoyaltyConflictError("Prize inventory changed during the spin. Please retry with the same request key.", { cause });
      }
    },
    async getSpinResultForTenant(tenant, id) {
      try {
        const result = await client.get(COLLECTIONS.results, id);
        return result.tenant === tenant ? result : null;
      } catch (error) { if (error.status === 404) return null; throw error; }
    },
    async findClaimByResult(resultId) {
      const result = await client.list(COLLECTIONS.claims, { filter: equal("result_id", resultId), perPage: 1 });
      return result.items?.[0] || null;
    },
    async createRewardClaim(record) {
      try { return { claim: await client.create(COLLECTIONS.claims, record), replayed: false }; }
      catch (cause) {
        const winner = await this.findClaimByResult(record.result_id);
        if (winner) return { claim: winner, replayed: true };
        throw cause;
      }
    },
    markSpinClaimed(id) { return client.update(COLLECTIONS.results, id, { status: "claimed" }); },
    async findCatalogItemByExternalRef(provider, externalRef) {
      const result = await client.list(COLLECTIONS.catalog, { filter: `${equal("provider", provider)} && ${equal("external_ref", externalRef)}`, perPage: 1 });
      return result.items?.[0] || null;
    },
    async upsertCatalogItem(record) {
      const existing = await this.findCatalogItemByExternalRef(record.provider, record.external_ref);
      if (existing) return { item: await client.update(COLLECTIONS.catalog, existing.id, record), created: false };
      try { return { item: await client.create(COLLECTIONS.catalog, record), created: true }; }
      catch (cause) {
        const winner = await this.findCatalogItemByExternalRef(record.provider, record.external_ref);
        if (winner) return { item: await client.update(COLLECTIONS.catalog, winner.id, record), created: false };
        throw cause;
      }
    },
    async listCatalogItems({ provider, status } = {}) {
      const filters = [];
      if (provider) filters.push(equal("provider", provider));
      if (status) filters.push(equal("status", status));
      const result = await client.list(COLLECTIONS.catalog, { filter: filters.join(" && "), sort: "provider,name", perPage: 500 });
      return result.items || [];
    },
    async getCatalogItem(id) {
      try { return await client.get(COLLECTIONS.catalog, id); } catch (error) { if (error.status === 404) return null; throw error; }
    },
    async findFulfillmentByClaim(claimId) {
      const result = await client.list(COLLECTIONS.fulfillments, { filter: equal("claim_id", claimId), perPage: 1 });
      return result.items?.[0] || null;
    },
    createRewardFulfillment(record) { return client.create(COLLECTIONS.fulfillments, record); },
    updateRewardFulfillment(id, patch) { return client.update(COLLECTIONS.fulfillments, id, patch); },
    async listCustomerWins(tenant, customerRef) {
      const results = await client.list(COLLECTIONS.results, {
        filter: `${tenantScope(tenant)} && ${equal("customer_ref", customerRef)} && (status='won' || status='claimed')`, sort: "-spun_at", perPage: 100,
      });
      const output = [];
      for (const result of results.items || []) output.push({ ...result, claim: await this.findClaimByResult(result.id) });
      return output;
    },
  };
}
