#!/usr/bin/env node
// Adds post_targets.published_url (if missing) and fills it for posts that were published before the
// worker started storing links. Dry run by default; pass --apply to write.
//   PB=https://... PB_EMAIL=admin PB_PASS=secret node scripts/backfill-published-urls.mjs [--apply]
import { resolvePublishedUrl } from "../worker-chat-d/knowledge-worker/src/domain/publishing/publishedUrl.js";

const apply = process.argv.includes("--apply");
const PB = (process.env.PB || "").replace(/\/+$/, "");
const GRAPH = "https://graph.facebook.com/v19.0";
if (!PB || !process.env.PB_EMAIL || !process.env.PB_PASS) {
  console.error("Thiếu PB, PB_EMAIL hoặc PB_PASS");
  process.exit(1);
}

const call = async (method, path, body, token) => {
  const res = await fetch(PB + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
};

const { token } = await call("POST", "/api/admins/auth-with-password", { identity: process.env.PB_EMAIL, password: process.env.PB_PASS });
const collection = await call("GET", "/api/collections/post_targets", null, token);
const fieldsKey = Array.isArray(collection.fields) ? "fields" : "schema";
let hasField = (collection[fieldsKey] || []).some((f) => f.name === "published_url");
if (!hasField) {
  if (apply) {
    const field = fieldsKey === "fields" ? { name: "published_url", type: "text", required: false } : { name: "published_url", type: "text", required: false, options: {} };
    await call("PATCH", "/api/collections/post_targets", { [fieldsKey]: [...collection[fieldsKey], field] }, token);
    hasField = true;
    console.log("Đã thêm field post_targets.published_url");
  } else {
    console.log("(dry-run) sẽ thêm field post_targets.published_url");
  }
}

const filter = hasField ? "status='published' && published_url = ''" : "status='published'";
const pageCache = new Map();
const findPage = async (target) => {
  const key = `${target.tenant}|${target.platform}|${target.page_id}`;
  if (!pageCache.has(key)) {
    const pageFilter = `tenant='${target.tenant}' && platform='${target.platform}' && page_id='${target.page_id}'`;
    const found = await call("GET", `/api/collections/pages_config/records?perPage=1&filter=${encodeURIComponent(pageFilter)}`, null, token);
    pageCache.set(key, found.items?.[0] || null);
  }
  return pageCache.get(key);
};

const stats = {};
let page = 1, totalPages = 1;
do {
  const list = await call("GET", `/api/collections/post_targets/records?perPage=100&page=${page}&filter=${encodeURIComponent(filter)}&expand=post_id`, null, token);
  totalPages = list.totalPages || 1;
  for (const target of list.items) {
    const bucket = (stats[target.platform] ||= { found: 0, skipped: 0 });
    if (!target.published_post_id) { bucket.skipped++; continue; }
    const url = await resolvePublishedUrl({
      platform: target.platform, publishedId: target.published_post_id, page: await findPage(target),
      post: target.expand?.post_id, fetchImpl: fetch, graphBase: GRAPH
    });
    if (!url) { bucket.skipped++; continue; }
    bucket.found++;
    console.log(`${target.platform}  ${target.id}  ${url}`);
    if (apply && hasField) await call("PATCH", `/api/collections/post_targets/records/${target.id}`, { published_url: url }, token);
  }
  page++;
} while (page <= totalPages);

console.log(apply ? "\nĐã ghi:" : "\n(dry-run) sẽ ghi:", JSON.stringify(stats));
if (!apply) console.log("Chạy lại với --apply để ghi.");
