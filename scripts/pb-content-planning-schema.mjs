const text = (name, required = false) => ({ name, type: "text", required, options: {} });
const bool = (name) => ({ name, type: "bool", required: false, options: {} });
const number = (name, required = false) => ({ name, type: "number", required, options: { min: null, max: null, noDecimal: false } });
const select = (name, values, required = false) => ({ name, type: "select", required, options: { maxSelect: 1, values } });
const date = (name) => ({ name, type: "date", required: false, options: { min: "", max: "" } });

const privateRules = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };

export const CONTENT_PLANNING_COLLECTION_EXTENSIONS = {
  pages_config: [text("default_language"), text("translation_languages_json")],
  posts: [text("content_plan_item_id"), text("author"), text("language"), text("tag"), text("translation_of"), text("content_json")],
  bot_configs: [text("content_planning_telegram_state"), text("response_language")],
  ai_prompts: [text("content_language")],
};

export const CONTENT_PLANNING_COLLECTIONS = [
  {
    name: "content_performance_snapshots", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id", true), text("post_id"), select("source", ["gsc", "ga4"], true),
      text("external_key", true), text("url"), text("snapshot_key", true), date("window_start"), date("window_end"),
      text("metrics_json", true), text("dimensions_json"), date("imported_at"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_performance_snapshot_identity` ON `content_performance_snapshots` (`tenant`, `site_id`, `snapshot_key`)",
      "CREATE INDEX `idx_performance_snapshot_window` ON `content_performance_snapshots` (`tenant`, `site_id`, `source`, `window_end`)",
    ],
  },
  {
    name: "trend_reports", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id"), text("report_key", true), text("checksum", true),
      date("generated_at"), number("total_candidates", true), number("selected_count", true),
      text("source_summary_json", true), text("raw_report_json", true),
      select("import_status", ["complete", "partial"], true), text("import_source", true),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_trend_report_identity` ON `trend_reports` (`tenant`, `report_key`, `checksum`)",
      "CREATE INDEX `idx_trend_report_site` ON `trend_reports` (`tenant`, `site_id`, `generated_at`)",
    ],
  },
  {
    name: "trend_topics", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id"), text("report_id", true), number("rank", true),
      text("title", true), text("category", true), text("primary_keyword", true),
      text("topic_json", true), number("overall_score", true),
      select("status", ["imported", "recommended", "approved", "rejected", "reserved", "consumed"], true),
      text("reservation_id"), date("reserved_at"), text("duplicate_check_json"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_trend_topic_rank` ON `trend_topics` (`report_id`, `rank`)",
      "CREATE INDEX `idx_trend_topic_queue` ON `trend_topics` (`tenant`, `site_id`, `status`, `rank`)",
    ],
  },
  {
    name: "recommendation_claims", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id"), text("topic_id", true), text("reservation_id", true),
      date("claimed_at"), select("status", ["active", "released", "consumed"], true),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_recommendation_claim_topic` ON `recommendation_claims` (`topic_id`)",
      "CREATE UNIQUE INDEX `idx_recommendation_claim_reservation` ON `recommendation_claims` (`reservation_id`)",
      "CREATE INDEX `idx_recommendation_claim_scope` ON `recommendation_claims` (`tenant`, `site_id`, `status`)",
    ],
  },
  {
    name: "content_plans", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id", true), text("name", true), text("timezone", true),
      select("status", ["draft", "active", "paused", "completed", "cancelled"], true),
      text("cadence_json", true), date("starts_at"), date("ends_at"), text("created_by"),
    ],
    indexes: ["CREATE INDEX `idx_content_plan_site` ON `content_plans` (`tenant`, `site_id`, `status`)"]
  },
  {
    name: "content_plan_items", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id", true), text("plan_id", true), text("trend_topic_id"),
      text("content_type", true), text("topic", true), number("order", true), text("series_id"),
      select("status", ["queued", "approved", "generating", "draft", "review", "scheduled", "publishing", "published", "failed", "cancelled"], true),
      date("scheduled_at"), bool("dependencies_ready"), select("translation_status", ["pending", "not_required", "translating", "completed", "failed"]), text("post_id"), text("error_log"), number("attempt_count"),
    ],
    indexes: [
      "CREATE INDEX `idx_plan_item_queue` ON `content_plan_items` (`tenant`, `site_id`, `status`, `scheduled_at`, `order`)",
      "CREATE UNIQUE INDEX `idx_plan_item_topic` ON `content_plan_items` (`plan_id`, `trend_topic_id`) WHERE `trend_topic_id` != ''",
    ],
  },
  {
    name: "schedule_claims", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id", true), text("plan_id", true), text("item_id", true),
      text("slot", true), text("reservation_id", true), date("claimed_at"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_schedule_claim_item` ON `schedule_claims` (`item_id`)",
      "CREATE UNIQUE INDEX `idx_schedule_claim_slot` ON `schedule_claims` (`plan_id`, `slot`)",
      "CREATE UNIQUE INDEX `idx_schedule_claim_reservation` ON `schedule_claims` (`reservation_id`)",
    ],
  },
  {
    name: "generation_claims", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id", true), text("item_id", true), text("reservation_id", true),
      date("claimed_at"), select("status", ["active", "consumed"], true), text("post_id"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_generation_claim_item` ON `generation_claims` (`item_id`)",
      "CREATE UNIQUE INDEX `idx_generation_claim_reservation` ON `generation_claims` (`reservation_id`)",
    ],
  },
  {
    name: "translation_jobs", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("site_id", true), text("item_id", true), text("source_post_id", true),
      text("target_language", true), select("status", ["pending", "translating", "completed", "failed"], true),
      number("attempt_count"), text("translated_post_id"), text("error_log"), date("completed_at"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_translation_job_identity` ON `translation_jobs` (`source_post_id`, `site_id`, `target_language`)",
      "CREATE INDEX `idx_translation_job_item` ON `translation_jobs` (`tenant`, `item_id`, `status`)",
    ],
  },
];
