#!/usr/bin/env node
import worker from "../worker-chat-d/knowledge-worker/src/index.js";

const baseUrl = process.env.PB_URL?.replace(/\/$/, "");
const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASS;
if (!baseUrl || !email || !password) throw new Error("PB_URL, PB_ADMIN_EMAIL and PB_ADMIN_PASS are required.");
const pocketBaseUrl = new URL(baseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(pocketBaseUrl.hostname)) {
  throw new Error(`Refusing API smoke test against non-loopback PocketBase host '${pocketBaseUrl.hostname}'.`);
}

async function authenticate() {
  const body = JSON.stringify({ identity: email, password });
  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.token) return data.token;
    if (response.status !== 404) throw new Error(`PocketBase authentication failed: ${data.message || response.status}`);
  }
  throw new Error("No supported PocketBase superuser endpoint found.");
}

const token = await authenticate();
const pbHeaders = { authorization: token, "content-type": "application/json" };
const env = { PB_URL: baseUrl, PB_ADMIN_EMAIL: email, PB_ADMIN_PASS: password };
const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const tenant = `api-smoke-${suffix}`;
const apiKey = `smoke-key-${suffix}`;
const created = [];

async function create(collection, body) {
  const response = await fetch(`${baseUrl}/api/collections/${collection}/records`, {
    method: "POST", headers: pbHeaders, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Cannot seed ${collection}: ${await response.text()}`);
  const record = await response.json();
  created.push([collection, record.id]);
  return record;
}

async function update(collection, id, body) {
  const response = await fetch(`${baseUrl}/api/collections/${collection}/records/${id}`, {
    method: "PATCH", headers: pbHeaders, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Cannot update ${collection}/${id}: ${await response.text()}`);
  return response.json();
}

async function api(path, { method = "GET", key = apiKey, body } = {}) {
  const response = await worker.fetch(new Request(`https://worker.smoke${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  return { response, body: await response.json().catch(() => ({})) };
}

try {
  const site = await create("pages_config", {
    tenant, platform: "sanity", page_id: `project-${suffix}:production`, default_language: "vi", translation_languages_json: "[]",
  });
  await create("bot_configs", { tenant, api_key: apiKey });
  const plan = await create("content_plans", {
    tenant, site_id: site.id, name: "Authenticated API smoke", timezone: "UTC", status: "active",
    cadence_json: JSON.stringify({ days: ["all"], times: ["03:00"] }),
  });
  const topic = await create("trend_topics", {
    tenant, site_id: site.id, report_id: `report-${suffix}`, rank: 1, title: "Authenticated review topic",
    category: "smoke", primary_keyword: "authenticated review", topic_json: "{}", overall_score: 99,
    status: "recommended", duplicate_check_json: "{}",
  });

  const unauthorized = await api("/api/v1/content-planning/review", { key: "invalid-smoke-key" });
  if (unauthorized.response.status !== 401) throw new Error(`Expected invalid API key to return 401, got ${unauthorized.response.status}.`);
  console.log("PASS invalid API key is rejected with 401");

  const initial = await api("/api/v1/content-planning/review");
  if (initial.response.status !== 200 || initial.body.topics?.[0]?.id !== topic.id || initial.body.plans?.[0]?.id !== plan.id) {
    throw new Error(`Authenticated review snapshot failed: ${initial.response.status} ${JSON.stringify(initial.body)}`);
  }
  console.log("PASS authenticated review snapshot is tenant-scoped");

  const approved = await api(`/api/v1/content-planning/topics/${topic.id}/approve-to-plan`, {
    method: "POST", body: { planId: plan.id, contentType: "blog" },
  });
  if (approved.response.status !== 201 || approved.body.item?.status !== "queued") {
    throw new Error(`Approve-to-plan failed: ${approved.response.status} ${JSON.stringify(approved.body)}`);
  }
  const item = approved.body.item;
  created.push(["content_plan_items", item.id]);
  const post = await create("posts", {
    tenant, site_id: site.id, title: "Review draft", content: "Safe dashboard preview", content_plan_item_id: item.id,
    language: "vi",
  });
  await update("content_plan_items", item.id, {
    post_id: post.id, status: "review", dependencies_ready: false, translation_status: "pending",
  });

  const review = await api("/api/v1/content-planning/review");
  if (review.response.status !== 200 || review.body.items?.[0]?.post?.content !== "Safe dashboard preview") {
    throw new Error(`Draft review snapshot failed: ${review.response.status} ${JSON.stringify(review.body)}`);
  }
  console.log("PASS dashboard review returns the generated draft preview");

  const blocked = await api(`/api/v1/content-planning/items/${item.id}/approve`, { method: "POST", body: {} });
  if (blocked.response.status !== 409 || blocked.body.details?.reason !== "dependencies_not_ready") {
    throw new Error(`Dependency gate failed closed incorrectly: ${blocked.response.status} ${JSON.stringify(blocked.body)}`);
  }
  console.log("PASS draft approval fails closed with 409 until dependencies are ready");
} finally {
  for (const [collection, id] of created.reverse()) {
    await fetch(`${baseUrl}/api/collections/${collection}/records/${id}`, { method: "DELETE", headers: pbHeaders }).catch(() => {});
  }
}
