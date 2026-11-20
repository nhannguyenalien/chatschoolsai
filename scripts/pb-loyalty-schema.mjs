const text = (name, required = false) => ({
  name,
  type: "text",
  required,
  options: { min: null, max: null, pattern: "" },
});
const number = (name, required = false, onlyInt = false) => ({ name, type: "number", required, options: { min: null, max: null, noDecimal: onlyInt } });
const select = (name, values, required = false) => ({ name, type: "select", required, options: { maxSelect: 1, values } });
const date = (name) => ({ name, type: "date", required: false, options: { min: "", max: "" } });
const privateRules = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };

export const LOYALTY_COLLECTIONS = [
  {
    name: "loyalty_programs", type: "base", ...privateRules,
    schema: [
      text("tenant", true), number("version", true, true), text("currency", true),
      number("spend_per_point_minor", true, true), number("points_per_step", true, true),
      select("status", ["draft", "active", "archived"], true),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_loyalty_program_version` ON `loyalty_programs` (`tenant`, `version`)",
      "CREATE INDEX `idx_loyalty_program_active` ON `loyalty_programs` (`tenant`, `status`, `version`)",
    ],
  },
  {
    name: "loyalty_customers", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("customer_ref", true), text("name"), text("phone"),
      select("status", ["active", "blocked", "merged"], true), text("metadata_json"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_loyalty_customer_ref` ON `loyalty_customers` (`tenant`, `customer_ref`)",
      "CREATE INDEX `idx_loyalty_customer_phone` ON `loyalty_customers` (`tenant`, `phone`)",
    ],
  },
  {
    name: "loyalty_ledger", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("customer_id", true), text("customer_ref", true),
      select("transaction_type", ["earn", "redeem", "expire", "adjustment", "reversal"], true),
      number("points_delta", true, true), number("amount_minor", false, true), text("currency"),
      text("source_type", true), text("source_ref", true), number("rule_version", true, true),
      text("idempotency_key", true), date("occurred_at"), text("reverses_entry_id"), text("metadata_json"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_loyalty_ledger_idempotency` ON `loyalty_ledger` (`tenant`, `idempotency_key`)",
      "CREATE INDEX `idx_loyalty_ledger_customer` ON `loyalty_ledger` (`tenant`, `customer_id`, `created`)",
      "CREATE UNIQUE INDEX `idx_loyalty_ledger_source_unique` ON `loyalty_ledger` (`tenant`, `source_type`, `source_ref`)",
    ],
  },
  {
    name: "reward_campaigns", type: "base", ...privateRules,
    schema: [
      text("name", true), text("description"), select("status", ["draft", "active", "paused", "ended"], true),
      date("starts_at"), date("ends_at"), number("spend_per_spin_minor", true, true),
      number("max_spins_per_sale", true, true), text("theme_json"),
    ],
    indexes: ["CREATE INDEX `idx_reward_campaign_status` ON `reward_campaigns` (`status`, `starts_at`, `ends_at`)"],
  },
  {
    name: "reward_campaign_prizes", type: "base", ...privateRules,
    schema: [
      text("campaign_id", true), text("name", true), select("prize_type", ["none", "points", "voucher", "product", "partner_code"], true),
      number("weight", true), number("max_wins", false, true), number("sort_order", true, true),
      select("status", ["active", "paused", "exhausted"], true), text("value_json"),
    ],
    indexes: ["CREATE INDEX `idx_reward_prize_campaign` ON `reward_campaign_prizes` (`campaign_id`, `status`, `sort_order`)"],
  },
  {
    name: "reward_store_joins", type: "base", ...privateRules,
    schema: [text("tenant", true), text("campaign_id", true), select("status", ["active", "left", "suspended"], true), date("joined_at")],
    indexes: ["CREATE UNIQUE INDEX `idx_reward_store_join` ON `reward_store_joins` (`tenant`, `campaign_id`)"],
  },
  {
    name: "reward_spin_entitlements", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("campaign_id", true), text("customer_ref", true), text("source_type", true),
      text("source_ref", true), select("status", ["available", "revoked"], true), date("issued_at"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_reward_entitlement_source` ON `reward_spin_entitlements` (`tenant`, `campaign_id`, `source_type`, `source_ref`)",
      "CREATE INDEX `idx_reward_entitlement_customer` ON `reward_spin_entitlements` (`tenant`, `campaign_id`, `customer_ref`, `status`, `created`)",
    ],
  },
  {
    name: "reward_spin_results", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("campaign_id", true), text("customer_ref", true), text("entitlement_id", true),
      text("prize_id", true), text("prize_name", true), text("prize_type", true), text("prize_value_json"),
      text("prize_slot_key", true), text("idempotency_key", true), select("status", ["won", "no_win", "claimed", "expired", "cancelled"], true), date("spun_at"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_reward_result_entitlement` ON `reward_spin_results` (`entitlement_id`)",
      "CREATE UNIQUE INDEX `idx_reward_result_idempotency` ON `reward_spin_results` (`tenant`, `idempotency_key`)",
      "CREATE UNIQUE INDEX `idx_reward_result_prize_slot` ON `reward_spin_results` (`prize_slot_key`)",
      "CREATE INDEX `idx_reward_result_prize` ON `reward_spin_results` (`prize_id`, `status`)",
    ],
  },
  {
    name: "reward_claims", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("campaign_id", true), text("result_id", true), text("customer_ref", true),
      text("prize_id", true), text("prize_name", true), text("prize_type", true), text("prize_value_json"),
      text("claim_note"), date("claimed_at"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_reward_claim_result` ON `reward_claims` (`result_id`)",
      "CREATE INDEX `idx_reward_claim_customer` ON `reward_claims` (`tenant`, `customer_ref`, `claimed_at`)",
    ],
  },
  {
    name: "reward_catalog_items", type: "base", ...privateRules,
    schema: [
      select("source_type", ["internal", "external_api"], true),
      select("provider", ["self", "reloadly"], true), text("external_ref", true), text("name", true),
      select("stock_management", ["self_tracked", "provider_managed"], true),
      number("cost_to_platform"), number("face_value"), text("currency"), text("country_code"),
      text("image_url"), select("status", ["active", "inactive"], true), number("available_stock", false, true),
      text("source_config_json"), date("synced_at"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_reward_catalog_external` ON `reward_catalog_items` (`provider`, `external_ref`)",
      "CREATE INDEX `idx_reward_catalog_status` ON `reward_catalog_items` (`provider`, `status`, `name`)",
    ],
  },
  {
    name: "reward_fulfillments", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("campaign_id", true), text("result_id", true), text("claim_id", true),
      text("catalog_item_id", true), select("source_type", ["internal", "external_api"], true),
      select("provider", ["self", "reloadly"], true),
      select("status", ["processing", "fulfilled", "manual_review", "failed"], true),
      text("provider_ref"), text("delivery_json"), text("error_message"), number("attempts", true, true),
      date("requested_at"), date("fulfilled_at"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_reward_fulfillment_claim` ON `reward_fulfillments` (`claim_id`)",
      "CREATE INDEX `idx_reward_fulfillment_tenant` ON `reward_fulfillments` (`tenant`, `status`, `requested_at`)",
      "CREATE INDEX `idx_reward_fulfillment_provider_ref` ON `reward_fulfillments` (`provider`, `provider_ref`)",
    ],
  },
];
