#!/usr/bin/env node
import { LOYALTY_COLLECTIONS } from "./pb-loyalty-schema.mjs";

const collectionIds = {
  loyalty_programs: "loyprograms0001",
  loyalty_customers: "loycustomers001",
  loyalty_ledger: "loyledger000001",
  reward_campaigns: "rewardcampaign1",
  reward_campaign_prizes: "rewardprizes001",
  reward_store_joins: "rewardjoins0001",
  reward_spin_entitlements: "rewardspins0001",
  reward_spin_results: "rewardresults01",
  reward_claims: "rewardclaims001",
};

const fieldIds = {
  loyalty_programs: {
    tenant: "lptenant1", version: "lpversn1", currency: "lpcurrn1",
    spend_per_point_minor: "lpspend1", points_per_step: "lppoint1", status: "lpstatus1",
  },
  loyalty_customers: {
    tenant: "lctenant1", customer_ref: "lccref01", name: "lcname01",
    phone: "lcphone1", status: "lcstatus1", metadata_json: "lcmeta01",
  },
  loyalty_ledger: {
    tenant: "lltenant1", customer_id: "llcustid", customer_ref: "llcref01",
    transaction_type: "lltrtype", points_delta: "llpoints", amount_minor: "llamount",
    currency: "llcurrn1", source_type: "llsrctyp", source_ref: "llsrcref",
    rule_version: "llrulev1", idempotency_key: "llidem01", occurred_at: "lloccur1",
    reverses_entry_id: "llrevers", metadata_json: "llmeta01",
  },
  reward_campaigns: { name: "rcname001", description: "rcdesc001", status: "rcstatus1", starts_at: "rcstart01", ends_at: "rcends001", spend_per_spin_minor: "rcspend01", max_spins_per_sale: "rcmaxspin", theme_json: "rctheme01" },
  reward_campaign_prizes: { campaign_id: "rpcamp001", name: "rpname001", prize_type: "rptype001", weight: "rpweight1", max_wins: "rpmaxwins", sort_order: "rpsort001", status: "rpstatus1", value_json: "rpvalue01" },
  reward_store_joins: { tenant: "rjtenant1", campaign_id: "rjcamp001", status: "rjstatus1", joined_at: "rjjoined1" },
  reward_spin_entitlements: { tenant: "retenant1", campaign_id: "recamp001", customer_ref: "recref001", source_type: "resrctype", source_ref: "resrcref1", status: "restatus1", issued_at: "reissued1" },
  reward_spin_results: { tenant: "rrtenant1", campaign_id: "rrcamp001", customer_ref: "rrcref001", entitlement_id: "rrentit01", prize_id: "rrprize01", prize_name: "rrpname01", prize_type: "rrptype01", prize_value_json: "rrvalue01", prize_slot_key: "rrslot001", idempotency_key: "rridem001", status: "rrstatus1", spun_at: "rrspun001" },
  reward_claims: { tenant: "rctenant1", campaign_id: "rccamp001", result_id: "rcresult1", customer_ref: "rccref001", prize_id: "rcprize01", prize_name: "rcpname01", prize_type: "rcptype01", prize_value_json: "rcvalue01", claim_note: "rcnote001", claimed_at: "rcclaim01" },
};

const auditFields = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

function modernField(field) {
  const { options = {}, ...base } = field;
  if (field.type === "number") {
    return { ...base, min: options.min, max: options.max, onlyInt: options.noDecimal };
  }
  return { ...base, ...options };
}

function legacyField(collectionName, field) {
  return {
    system: false,
    id: fieldIds[collectionName][field.name],
    name: field.name,
    type: field.type,
    required: field.required ?? false,
    presentable: false,
    unique: false,
    options: field.options ?? {},
  };
}

const legacyCollections = LOYALTY_COLLECTIONS.map(({ schema, ...collection }) => ({
  id: collectionIds[collection.name],
  ...collection,
  system: false,
  schema: schema.map((field) => legacyField(collection.name, field)),
  options: {},
}));

const modernCollections = LOYALTY_COLLECTIONS.map(({ schema, ...collection }) => ({
  id: collectionIds[collection.name],
  ...collection,
  system: false,
  fields: [...schema, ...auditFields].map((field) => ({
    ...modernField(field),
    ...(fieldIds[collection.name]?.[field.name]
      ? { id: fieldIds[collection.name][field.name] }
      : {}),
  })),
}));

// This repository uses PocketBase's legacy Dashboard import format (`schema`).
// Pass --modern only for PocketBase versions that export collections as `fields`.
const collections = process.argv.includes("--modern")
  ? modernCollections
  : legacyCollections;

// Dashboard > Settings > Import collections expects the JSON array. The API
// endpoint expects the same array wrapped in { collections, deleteMissing }.
const output = process.argv.includes("--api-payload")
  ? { collections, deleteMissing: false }
  : collections;

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
