#!/usr/bin/env node
/**
 * Migration 1 lần cho PocketBase — thêm các field mới cần cho:
 *   - Handoff "AI không trả lời được -> báo owner qua Telegram -> owner trả lời qua dashboard"
 *   - Digest hằng ngày + phân loại nội dung hội thoại
 *     (tái dùng collection session_summaries + daily_reports đã có sẵn trong DB, không tạo bảng mới)
 *
 * An toàn để chạy lại nhiều lần: field/collection nào đã tồn tại sẽ tự bỏ qua, không ghi đè.
 *
 * Cách chạy (Node 18+, không cần cài thêm gì):
 *   PB_URL=https://nhannguyen123-chat.hf.space \
 *   PB_ADMIN_EMAIL=admin@yourdomain.com \
 *   PB_ADMIN_PASS=yourpassword \
 *   node scripts/pb-migrate.mjs
 */

let PB_URL = "";
let PB_ADMIN_EMAIL = "";
let PB_ADMIN_PASS = "";

const TENANT_RULES = {
  listRule: '@request.auth.id != "" && tenant = @request.auth.tenant',
  viewRule: '@request.auth.id != "" && tenant = @request.auth.tenant',
  // Validate the resulting record for both create and update. This syntax works
  // across the PocketBase rule-engine versions used by this project and also
  // prevents moving an existing record to another tenant.
  createRule: '@request.auth.id != "" && tenant = @request.auth.tenant',
  updateRule: '@request.auth.id != "" && tenant = @request.auth.tenant',
  deleteRule: '@request.auth.id != "" && tenant = @request.auth.tenant',
};

async function getAdminToken() {
  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const res = await fetch(`${PB_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASS }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) return data.token;
    if (res.status !== 404) throw new Error(`Đăng nhập admin thất bại (${res.status}).`);
  }
  throw new Error("Đăng nhập admin thất bại.");
}

async function getCollectionByName(token, name) {
  const res = await fetch(`${PB_URL}/api/collections/${name}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) return null;
  return res.json();
}

async function patchCollection(token, id, body) {
  const res = await fetch(`${PB_URL}/api/collections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Patch collection ${id} thất bại: ${JSON.stringify(data)}`);
  return data;
}

async function createCollection(token, body) {
  const res = await fetch(`${PB_URL}/api/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Tạo collection thất bại: ${JSON.stringify(data)}`);
  return data;
}

function ensureField(schema, field) {
  if (schema.find((f) => f.name === field.name)) {
    console.log(`  - field "${field.name}" đã có, bỏ qua`);
    return schema;
  }
  console.log(`  + thêm field "${field.name}"`);
  return [...schema, field];
}

function ensureSelectValues(schema, fieldName, newValues) {
  const field = schema.find((f) => f.name === fieldName);
  if (!field) {
    console.log(`  ! field "${fieldName}" không tồn tại trong collection này, bỏ qua`);
    return schema;
  }
  if (field.type !== "select") {
    console.log(`  - field "${fieldName}" là kiểu "${field.type}" (không phải select) — mọi giá trị text đều hợp lệ sẵn, không cần sửa`);
    return schema;
  }
  const current = field.options?.values || [];
  const merged = [...new Set([...current, ...newValues])];
  if (merged.length === current.length) {
    console.log(`  - field "${fieldName}" đã có đủ values, bỏ qua`);
    return schema;
  }
  console.log(`  + mở rộng values của "${fieldName}": ${JSON.stringify(merged)}`);
  field.options = { ...field.options, values: merged };
  return schema;
}

async function migratePagesConfig(token) {
  console.log("\n[pages_config] — thêm WhatsApp/Zalo/WordPress/Sanity/Khác + extra_config (dùng cho sm-config.html)");
  const col = await getCollectionByName(token, "pages_config");
  if (!col) { console.log("  ! collection không tồn tại — kiểm tra lại tên, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureSelectValues(schema, "platform", ["facebook", "instagram", "whatsapp", "zalo", "wordpress", "sanity", "other"]);
  schema = ensureField(schema, { name: "extra_config", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema, ...TENANT_RULES });
}

async function migrateMessages(token) {
  console.log("\n[messages] — đồng bộ metadata chat, voice và handoff");
  const col = await getCollectionByName(token, "messages");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  // Worker luôn gửi hai field này khi tạo message. Database cũ thiếu một trong hai
  // field sẽ trả PocketBase 400 "Failed to create record".
  schema = ensureField(schema, { name: "client_meta", type: "json", required: false, options: { maxSize: 2000000 } });
  schema = ensureField(schema, { name: "via_voice", type: "bool", required: false, options: {} });
  schema = ensureField(schema, { name: "needs_human", type: "bool", required: false, options: {} });
  schema = ensureField(schema, { name: "escalation_resolved", type: "bool", required: false, options: {} });
  // This is a field migration. Preserve the live permissions, including active
  // workspace memberships installed by pb-messages-read-access.mjs.
  await patchCollection(token, col.id, { schema });
}

async function migrateBotConfigs(token) {
  console.log("\n[bot_configs] — thêm greeting + owner_telegram_chat_id + Cloudinary/logo (dùng cho chat, Telegram, digest, chèn logo)");
  const col = await getCollectionByName(token, "bot_configs");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureField(schema, { name: "greeting", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "owner_telegram_chat_id", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "cloudinary_cloud_name", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "cloudinary_api_key", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "cloudinary_api_secret", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "pixverse_api_key", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_url", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_public_id", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_cached_url", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_enabled", type: "bool", required: false, options: {} });
  schema = ensureField(schema, { name: "brand_text_enabled", type: "bool", required: false, options: {} });
  schema = ensureField(schema, { name: "brand_logo_position", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_size", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_text", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_text_position", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_text_size", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_text_color", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_opacity", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_text_opacity", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_text_bg", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_border", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "image_mode", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "image_style", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "weekly_plan_config", type: "text", required: false, options: { min: null, max: 20000, pattern: "" } });
  schema = ensureField(schema, { name: "api_key", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema, ...TENANT_RULES });
}

async function migrateTenants(token) {
  console.log("\n[tenants] — thêm workspace_limit (Number, optional): cho phép admin override số lượng workspace");
  console.log("  phụ (/api/account/workspaces) riêng theo từng platform, thay vì luôn dùng mặc định free 3/pro 10.");
  const col = await getCollectionByName(token, "tenants");
  if (!col) { console.log("  ! collection không tồn tại — kiểm tra lại tên, bỏ qua"); return; }
  let schema = ensureField(col.schema, {
    name: "workspace_limit",
    type: "number",
    required: false,
    options: { min: 0, max: null, noDecimal: true },
  });
  // Dung lượng media (byte): storage_used do Worker ghi; storage_limit_bytes (optional) override
  // mặc định theo gói (free 100 MB, pro 2 GB).
  schema = ensureField(schema, { name: "storage_used", type: "number", required: false, options: { min: 0, max: null, noDecimal: true } });
  schema = ensureField(schema, { name: "storage_limit_bytes", type: "number", required: false, options: { min: 0, max: null, noDecimal: true } });
  // CHỈ patch "schema" — "tenants" là auth collection (đăng nhập bằng email/password của
  // account), có listRule/viewRule/... riêng để bảo vệ tài khoản khách, KHÁC hẳn các collection
  // "base" phía trên dùng chung TENANT_RULES. Không spread rule nào vào đây để tránh ghi đè
  // nhầm quyền đăng nhập/truy cập tài khoản của khách hàng.
  await patchCollection(token, col.id, { schema });
}

async function migrateMediaLibrary(token) {
  console.log("\n[media_library] — thêm size_bytes + r2_key (tính dung lượng và xoá object R2)");
  const col = await getCollectionByName(token, "media_library");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureField(schema, { name: "size_bytes", type: "number", required: false, options: { min: 0, max: null, noDecimal: true } });
  schema = ensureField(schema, { name: "r2_key", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema });
}

async function migrateSessionSummaries(token) {
  console.log("\n[session_summaries] — thêm field date (dùng cho AI phân loại hội thoại theo ngày)");
  const col = await getCollectionByName(token, "session_summaries");
  if (!col) { console.log("  ! collection không tồn tại — kiểm tra lại tên, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureField(schema, { name: "date", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema, ...TENANT_RULES });
}

async function migratePosts(token) {
  console.log("\n[posts] — thêm source_url + cluster_id/slug/meta_title/meta_description/focus_keyword (dùng cho cụm bài blog dài chuẩn SEO)");
  const col = await getCollectionByName(token, "posts");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureField(schema, { name: "source_url", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "cluster_id", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "slug", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "meta_title", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "meta_description", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "focus_keyword", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema, ...TENANT_RULES });
}

async function migratePostTargets(token) {
  console.log("\n[post_targets] — thêm status 'publishing' + platform wordpress/sanity");
  const col = await getCollectionByName(token, "post_targets");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureSelectValues(schema, "status", ["pending", "approved", "scheduled", "publishing", "published", "error"]);
  schema = ensureSelectValues(schema, "platform", ["facebook", "instagram", "linkedin", "wordpress", "sanity"]);
  schema = ensureField(schema, { name: "attempts", type: "number", required: false, options: { min: 0, max: null, noDecimal: true } });
  await patchCollection(token, col.id, { schema, ...TENANT_RULES });
}

async function migrateSystemConfig(token) {
  console.log("\n[system_config] — collection MỚI, cấu hình tầng hệ thống (dùng bởi system-config.html)");
  const existing = await getCollectionByName(token, "system_config");
  if (existing) { console.log("  - collection đã tồn tại, bỏ qua tạo mới"); return; }
  console.log("  + tạo collection mới (chỉ superuser PocketBase đọc/ghi được — không tenant nào truy cập được)");
  await createCollection(token, {
    name: "system_config",
    type: "base",
    schema: [
      { name: "anythingllm_url", type: "text", required: false, options: {} },
      { name: "anythingllm_api_key", type: "text", required: false, options: {} },
      { name: "telegram_bot_token", type: "text", required: false, options: {} },
      { name: "openai_key", type: "text", required: false, options: {} },
      { name: "openai_base_url", type: "text", required: false, options: {} },
      { name: "openai_chat_model", type: "text", required: false, options: {} },
      { name: "openai_embedding_model", type: "text", required: false, options: {} },
      { name: "admin_secret", type: "text", required: false, options: {} },
      { name: "dashboard_url", type: "text", required: false, options: {} },
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });
}

async function migrateAgentLogs(token) {
  console.log("\n[agent_logs] — collection MỚI, lưu lại quyết định của AI Agent để hiện trong config.html");
  const existing = await getCollectionByName(token, "agent_logs");
  if (existing) { console.log("  - collection đã tồn tại, cập nhật tenant rules"); await patchCollection(token, existing.id, TENANT_RULES); return; }
  console.log("  + tạo collection mới");
  await createCollection(token, {
    name: "agent_logs",
    type: "base",
    schema: [
      { name: "tenant", type: "text", required: true, options: {} },
      { name: "tool_name", type: "text", required: false, options: {} },
      { name: "tool_args", type: "text", required: false, options: {} },
      { name: "tool_result", type: "text", required: false, options: {} },
    ],
    ...TENANT_RULES,
  });
}

async function migrateAgentTools(token) {
  console.log("\n[agent_tools] — collection MỚI, khách tự khai báo tool JSON cho Agent gọi (không cần code)");
  const existing = await getCollectionByName(token, "agent_tools");
  if (existing) {
    console.log("  - collection đã tồn tại, cập nhật tenant rules + thêm requires_confirmation nếu chưa có");
    const schema = ensureField(existing.schema, { name: "requires_confirmation", type: "bool", required: false, options: {} });
    await patchCollection(token, existing.id, { schema, ...TENANT_RULES });
    return;
  }
  console.log("  + tạo collection mới");
  await createCollection(token, {
    name: "agent_tools",
    type: "base",
    schema: [
      { name: "tenant", type: "text", required: true, options: {} },
      { name: "name", type: "text", required: true, options: {} },
      { name: "description", type: "text", required: false, options: {} },
      { name: "parameters_schema", type: "text", required: false, options: {} },
      { name: "method", type: "select", required: false, options: { maxSelect: 1, values: ["GET", "POST", "PUT", "PATCH", "DELETE"] } },
      { name: "url_template", type: "text", required: false, options: {} },
      { name: "headers_template", type: "text", required: false, options: {} },
      { name: "result_path", type: "text", required: false, options: {} },
      { name: "is_active", type: "bool", required: false, options: {} },
      { name: "requires_confirmation", type: "bool", required: false, options: {} },
    ],
    ...TENANT_RULES,
  });
}

async function migrateAgentToolProposals(token) {
  console.log("\n[agent_tool_proposals] — collection MỚI, lưu đề xuất gọi tool ghi dữ liệu chờ người dùng xác nhận");
  console.log("  trước khi thực thi thật (dùng bởi /api/v1/operator-chat + /agent-tool-proposals/:id/confirm|reject)");
  const existing = await getCollectionByName(token, "agent_tool_proposals");
  if (existing) {
    console.log("  - collection đã tồn tại, kiểm tra lại field/values (phòng trường hợp lần tạo trước bị thiếu)");
    let schema = existing.schema;
    schema = ensureField(schema, { name: "tenant", type: "text", required: true, options: {} });
    schema = ensureField(schema, { name: "session", type: "text", required: false, options: {} });
    schema = ensureField(schema, { name: "tool_name", type: "text", required: true, options: {} });
    schema = ensureField(schema, { name: "args", type: "text", required: false, options: {} });
    schema = ensureField(schema, { name: "description", type: "text", required: false, options: {} });
    schema = ensureField(schema, { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["pending", "confirmed", "rejected"] } });
    schema = ensureField(schema, { name: "result", type: "text", required: false, options: {} });
    schema = ensureSelectValues(schema, "status", ["pending", "confirmed", "rejected"]);
    await patchCollection(token, existing.id, { schema, ...TENANT_RULES });
    return;
  }
  console.log("  + tạo collection mới");
  await createCollection(token, {
    name: "agent_tool_proposals",
    type: "base",
    schema: [
      { name: "tenant", type: "text", required: true, options: {} },
      { name: "session", type: "text", required: false, options: {} },
      { name: "tool_name", type: "text", required: true, options: {} },
      { name: "args", type: "text", required: false, options: {} },
      { name: "description", type: "text", required: false, options: {} },
      { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["pending", "confirmed", "rejected"] } },
      { name: "result", type: "text", required: false, options: {} },
    ],
    ...TENANT_RULES,
  });
}

async function migrateAgentChatMessages(token) {
  console.log("\n[agent_chat_messages] — collection MỚI, lưu lịch sử chat với Trợ lý cấu hình (agent-chat.html)");
  const existing = await getCollectionByName(token, "agent_chat_messages");
  if (existing) { console.log("  - collection đã tồn tại, cập nhật tenant rules"); await patchCollection(token, existing.id, TENANT_RULES); return; }
  console.log("  + tạo collection mới");
  await createCollection(token, {
    name: "agent_chat_messages",
    type: "base",
    schema: [
      { name: "tenant", type: "text", required: true, options: {} },
      { name: "role", type: "select", required: true, options: { maxSelect: 1, values: ["user", "assistant"] } },
      { name: "content", type: "text", required: false, options: {} },
    ],
    ...TENANT_RULES,
  });
}

async function migratePublishSchedules(token) {
  console.log("\n[publish_schedules] — collection MỚI, luật lên lịch tự động theo ngày/giờ cho từng loại nội dung");
  const existing = await getCollectionByName(token, "publish_schedules");
  if (existing) {
    console.log("  - collection đã tồn tại, cập nhật tenant rules + field page_id (luật lịch riêng cho từng page)");
    const schema = ensureField(existing.schema, { name: "page_id", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
    await patchCollection(token, existing.id, { schema, ...TENANT_RULES });
    return;
  }
  console.log("  + tạo collection mới");
  await createCollection(token, {
    name: "publish_schedules",
    type: "base",
    schema: [
      { name: "tenant", type: "text", required: true, options: {} },
      { name: "content_type", type: "select", required: true, options: { maxSelect: 1, values: ["blog", "social"] } },
      { name: "days", type: "text", required: false, options: {} },
      { name: "times", type: "text", required: false, options: {} },
      { name: "is_active", type: "bool", required: false, options: {} },
      { name: "page_id", type: "text", required: false, options: {} },
    ],
    ...TENANT_RULES,
  });
}

async function migrateWeeklyPlans(token) {
  console.log("\n[weekly_plans] — collection MỚI, lưu các kế hoạch tuần do AI lập (kế hoạch tuần ở composer.html)");
  const existing = await getCollectionByName(token, "weekly_plans");
  if (existing) { console.log("  - collection đã tồn tại, cập nhật tenant rules"); await patchCollection(token, existing.id, TENANT_RULES); return; }
  console.log("  + tạo collection mới");
  await createCollection(token, {
    name: "weekly_plans",
    type: "base",
    schema: [
      { name: "tenant", type: "text", required: true, options: {} },
      { name: "week_start", type: "text", required: false, options: {} },
      { name: "status", type: "text", required: false, options: {} },
      { name: "requested", type: "number", required: false, options: { min: 0, max: null, noDecimal: true } },
      { name: "created_count", type: "number", required: false, options: { min: 0, max: null, noDecimal: true } },
      { name: "items", type: "json", required: false, options: { maxSize: 2000000 } },
      { name: "note", type: "text", required: false, options: { min: null, max: 2000, pattern: "" } },
    ],
    ...TENANT_RULES,
  });
}

export async function runPocketBaseMigration({ pbUrl, adminEmail, adminPass }) {
  PB_URL = pbUrl;
  PB_ADMIN_EMAIL = adminEmail;
  PB_ADMIN_PASS = adminPass;
  if (!PB_URL || !PB_ADMIN_EMAIL || !PB_ADMIN_PASS) throw new Error("Thiếu cấu hình PocketBase admin.");
  console.log(`Đăng nhập admin PocketBase tại ${PB_URL} ...`);
  const token = await getAdminToken();
  // Mỗi bước độc lập: một bước lỗi (vd collection trùng tên) không chặn các bước sau; lỗi được gom và báo ở cuối.
  const steps = [
    migratePagesConfig, migrateMessages, migrateBotConfigs, migrateTenants, migrateMediaLibrary, migrateSessionSummaries,
    migratePosts, migratePostTargets, migrateSystemConfig, migrateAgentLogs, migrateAgentTools, migrateAgentToolProposals,
    migrateAgentChatMessages, migratePublishSchedules, migrateWeeklyPlans,
  ];
  const failures = [];
  for (const step of steps) {
    try {
      await step(token);
    } catch (err) {
      console.error(`  ❌ ${step.name} lỗi: ${err.message}`);
      failures.push(`${step.name}: ${err.message}`);
    }
  }
  if (failures.length) {
    console.log(`\n⚠️ Xong, nhưng ${failures.length} bước lỗi (các bước còn lại đã chạy):`);
    failures.forEach((f) => console.log(`  - ${f}`));
    throw new Error(`${failures.length} bước migrate lỗi — xem danh sách ở trên.`);
  }
  console.log("\n✅ Xong. daily_reports/weekly_reports đã đủ field sẵn, không cần sửa gì thêm.");
  console.log("Script này an toàn để chạy lại bất kỳ lúc nào (tự bỏ qua phần đã có).");
  return { ok: true };
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  runPocketBaseMigration({
    pbUrl: process.env.PB_URL,
    adminEmail: process.env.PB_ADMIN_EMAIL,
    adminPass: process.env.PB_ADMIN_PASS,
  }).catch((err) => {
    console.error("\n❌ Lỗi:", err.message);
    process.exit(1);
  });
}
