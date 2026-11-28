// Kho nội dung: agent/nhân viên lưu bài, nhân viên đăng thủ công rồi dán link, chủ kiểm tra.
// Cả 3 collection đều không có API rule công khai — chỉ Worker (token admin) đọc/ghi.
// Worker tự tạo/bổ sung field khi dùng lần đầu (syncCollections), không cần chạy tay.
const text = (name, required = false, max = null) => ({ name, type: "text", required, options: { min: null, max, pattern: "" } });
const bool = (name) => ({ name, type: "bool", required: false, options: {} });
const privateRules = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };

export const CONTENT_LIBRARY_COLLECTIONS = [
  {
    name: "content_items", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("title", true), text("content", false, 20000), text("media_json", false, 20000),
      text("note", false, 2000), text("due_at"), text("source"), text("created_by"), text("external_id"),
    ],
    indexes: [
      "CREATE INDEX `idx_content_items_tenant` ON `content_items` (`tenant`)",
      "CREATE UNIQUE INDEX `idx_content_items_external` ON `content_items` (`tenant`, `external_id`) WHERE `external_id` != ''",
    ],
  },
  {
    name: "content_tasks", type: "base", ...privateRules,
    schema: [
      text("tenant", true), text("item", true), text("platform", true), text("target"), text("status", true),
      text("post_url", false, 1000), text("done_by"), text("done_by_id"), text("done_at"), text("staff_note", false, 2000),
      text("review_note", false, 2000), text("reviewed_by"), text("reviewed_at"),
    ],
    indexes: ["CREATE INDEX `idx_content_tasks_tenant` ON `content_tasks` (`tenant`, `status`)"],
  },
  {
    name: "content_staff", type: "base", ...privateRules,
    schema: [text("tenant", true), text("name", true), text("token_hash", true), bool("active"), text("last_used_at")],
    indexes: ["CREATE UNIQUE INDEX `idx_content_staff_token` ON `content_staff` (`token_hash`)"],
  },
];
