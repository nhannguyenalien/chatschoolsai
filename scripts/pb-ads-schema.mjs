const text = (name, required = false) => ({ name, type: "text", required, options: { min: null, max: null, pattern: "" } });
const bool = (name) => ({ name, type: "bool", required: false, options: {} });
const select = (name, values, required = false) => ({ name, type: "select", required, options: { maxSelect: 1, values } });
const privateRules = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };

export const ADS_COLLECTIONS = [
  {
    name: "ads_connections", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("label"), select("provider", ["meta"], true),
      text("token_encrypted", true), text("account_ids"), text("thresholds_json"), bool("is_active"), text("last_error"),
    ],
    indexes: ["CREATE INDEX `idx_ads_connection_tenant` ON `ads_connections` (`tenant`, `is_active`)"],
  },
  {
    name: "ads_reports", type: "base", ...privateRules,
    schema: [
      text("tenant", true), select("severity", ["ok", "warning", "critical"], true),
      text("summary"), text("model"), text("tier"),
    ],
    indexes: ["CREATE INDEX `idx_ads_report_tenant` ON `ads_reports` (`tenant`, `created`)"],
  },
];
