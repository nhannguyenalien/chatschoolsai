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

const PB_URL = process.env.PB_URL;
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASS = process.env.PB_ADMIN_PASS;

if (!PB_URL || !PB_ADMIN_EMAIL || !PB_ADMIN_PASS) {
  console.error("Thiếu env: cần PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASS. Xem hướng dẫn ở đầu file.");
  process.exit(1);
}

async function getAdminToken() {
  const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASS }),
  });
  const data = await res.json();
  if (!data.token) throw new Error("Đăng nhập admin thất bại: " + JSON.stringify(data));
  return `Admin ${data.token}`;
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
  console.log("\n[pages_config] — thêm WhatsApp/Zalo/Khác + extra_config (dùng cho sm-config.html)");
  const col = await getCollectionByName(token, "pages_config");
  if (!col) { console.log("  ! collection không tồn tại — kiểm tra lại tên, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureSelectValues(schema, "platform", ["facebook", "instagram", "whatsapp", "zalo", "other"]);
  schema = ensureField(schema, { name: "extra_config", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema });
}

async function migrateMessages(token) {
  console.log("\n[messages] — thêm needs_human + escalation_resolved (dùng cho handoff trong messages.html)");
  const col = await getCollectionByName(token, "messages");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureField(schema, { name: "needs_human", type: "bool", required: false, options: {} });
  schema = ensureField(schema, { name: "escalation_resolved", type: "bool", required: false, options: {} });
  await patchCollection(token, col.id, { schema });
}

async function migrateBotConfigs(token) {
  console.log("\n[bot_configs] — thêm owner_telegram_chat_id + Cloudinary/logo (dùng cho Telegram, digest, chèn logo)");
  const col = await getCollectionByName(token, "bot_configs");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureField(schema, { name: "owner_telegram_chat_id", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "cloudinary_cloud_name", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "cloudinary_api_key", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "cloudinary_api_secret", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_url", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_public_id", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  schema = ensureField(schema, { name: "brand_logo_cached_url", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema });
}

async function migrateSessionSummaries(token) {
  console.log("\n[session_summaries] — thêm field date (dùng cho AI phân loại hội thoại theo ngày)");
  const col = await getCollectionByName(token, "session_summaries");
  if (!col) { console.log("  ! collection không tồn tại — kiểm tra lại tên, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureField(schema, { name: "date", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema });
}

async function migratePosts(token) {
  console.log("\n[posts] — thêm field source_url (dùng để chống crawl trùng bài từ RSS)");
  const col = await getCollectionByName(token, "posts");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureField(schema, { name: "source_url", type: "text", required: false, options: { min: null, max: null, pattern: "" } });
  await patchCollection(token, col.id, { schema });
}

async function migratePostTargets(token) {
  console.log("\n[post_targets] — thêm status 'publishing' (chống đăng trùng khi 2 lần cron chồng nhau)");
  const col = await getCollectionByName(token, "post_targets");
  if (!col) { console.log("  ! collection không tồn tại, bỏ qua"); return; }
  let schema = col.schema;
  schema = ensureSelectValues(schema, "status", ["pending", "approved", "scheduled", "publishing", "published", "error"]);
  await patchCollection(token, col.id, { schema });
}

(async () => {
  console.log(`Đăng nhập admin PocketBase tại ${PB_URL} ...`);
  const token = await getAdminToken();
  await migratePagesConfig(token);
  await migrateMessages(token);
  await migrateBotConfigs(token);
  await migrateSessionSummaries(token);
  await migratePosts(token);
  await migratePostTargets(token);
  console.log("\n✅ Xong. daily_reports/weekly_reports đã đủ field sẵn, không cần sửa gì thêm.");
  console.log("Script này an toàn để chạy lại bất kỳ lúc nào (tự bỏ qua phần đã có).");
})().catch((err) => {
  console.error("\n❌ Lỗi:", err.message);
  process.exit(1);
});
