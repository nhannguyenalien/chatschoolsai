const text = (name, required = false) => ({ name, type: "text", required, options: { min: null, max: null, pattern: "" } });
const bool = (name) => ({ name, type: "bool", required: false, options: {} });
const number = (name, required = false, onlyInt = false) => ({ name, type: "number", required, options: { min: null, max: null, noDecimal: onlyInt } });
const select = (name, values, required = false) => ({ name, type: "select", required, options: { maxSelect: 1, values } });
const date = (name, required = false) => ({ name, type: "date", required, options: { min: "", max: "" } });
const privateRules = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };

// Đặt lịch dùng chung cho nhà hàng / spa / phòng khám / khách sạn: dịch vụ giữ chỗ trong một khoảng thời gian
// trên tài nguyên có sức chứa. Khác biệt theo ngành chỉ nằm ở dữ liệu cấu hình (xem BOOKING_TEMPLATES).
export const BOOKING_COLLECTIONS = [
  {
    name: "booking_settings", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("business_type"), text("open_time"), text("close_time"), text("closed_days"),
      number("tz_offset_min", false, true), number("min_notice_min", false, true), number("slot_step_min", false, true),
      number("default_capacity", false, true), number("default_duration_min", false, true), bool("manual_confirm"),
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_booking_settings_tenant` ON `booking_settings` (`tenant`)"],
  },
  {
    name: "booking_services", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("name", true), number("duration_min", false, true),
      select("unit", ["minute", "night"]), text("price_text"), text("resource_group"), select("status", ["active", "inactive"]),
    ],
    indexes: ["CREATE INDEX `idx_booking_services_tenant` ON `booking_services` (`tenant`, `status`)"],
  },
  {
    name: "booking_resources", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("name", true), text("group"), number("capacity", false, true), select("status", ["active", "inactive"]),
    ],
    indexes: ["CREATE INDEX `idx_booking_resources_tenant` ON `booking_resources` (`tenant`, `status`)"],
  },
  {
    name: "bookings", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("service_id"), text("service_name"), text("resource_id"), text("resource_name"),
      date("start", true), date("end", true), number("party_size", false, true),
      text("customer_name"), text("phone"), text("session"), text("notes"), text("extra_json"),
      select("status", ["pending", "confirmed", "cancelled", "blocked"], true), text("source"), text("idempotency_key"),
    ],
    indexes: [
      "CREATE INDEX `idx_bookings_tenant_time` ON `bookings` (`tenant`, `start`, `end`)",
      "CREATE INDEX `idx_bookings_phone` ON `bookings` (`tenant`, `phone`)",
      "CREATE INDEX `idx_bookings_idem` ON `bookings` (`tenant`, `idempotency_key`)",
    ],
  },
];
