import test from "node:test";
import assert from "node:assert/strict";
import { createTelegramContentPlanningWebhook } from "../src/adapters/telegram/contentPlanningWebhook.js";

function fixture(overrides = {}) {
  const calls = [];
  const config = { id: "cfg1", tenant: "acme", content_planning_telegram_state: "" };
  const plan = { id: "plan1", tenant: "acme", site_id: "site1", status: "active" };
  const repository = {
    async findBotConfigByOwnerChat(chatId) { calls.push(["admin", chatId]); return config; },
    async listActivePlans() { return { items: [plan] }; },
    async updateBotConfig(id, patch) { calls.push(["config", id, patch]); Object.assign(config, patch); },
    ...overrides.repository,
  };
  const telegram = {
    async sendMessage(...args) { calls.push(["send", ...args]); },
    async answerCallbackQuery(...args) { calls.push(["answer", ...args]); },
    async downloadJsonDocument() { return overrides.documentText || "{}"; },
  };
  return { calls, config, plan, repository, telegram, handle: createTelegramContentPlanningWebhook({ repository, telegram }) };
}

test("shows the content menu only to a uniquely matched Telegram owner", async () => {
  const fx = fixture();
  assert.equal(await fx.handle({ message: { chat: { id: 42 }, text: "/start" } }), true);
  assert.equal(fx.calls[0][0], "admin");
  assert.equal(fx.calls.at(-1)[0], "send");

  fx.repository.findBotConfigByOwnerChat = async () => null;
  assert.equal(await fx.handle({ message: { chat: { id: 99 }, text: "/start" } }), false);
});

test("refuses to guess a website when more than one plan is active", async () => {
  const fx = fixture({ repository: { async listActivePlans() { return { items: [{ id: "a" }, { id: "b" }] }; } } });
  await fx.handle({ message: { chat: { id: 42 }, text: "📈 Nạp trend JSON" } });
  assert.equal(fx.calls.some(([name]) => name === "config"), false);
  assert.match(fx.calls.find(([name]) => name === "send")[2], /nhiều content plan active/);
});

test("records awaiting JSON state and accepts only a json document", async () => {
  const fx = fixture();
  await fx.handle({ message: { chat: { id: 42 }, text: "📈 Nạp trend JSON" } });
  assert.equal(fx.config.content_planning_telegram_state, "awaiting_trend_json");

  await fx.handle({ message: { chat: { id: 42 }, document: { file_id: "f1", file_name: "trend.txt" } } });
  assert.equal(fx.config.content_planning_telegram_state, "awaiting_trend_json");
  assert.match(fx.calls.at(-1)[2], /\.json/);
});

test("approves a tenant-owned recommendation and queues it in the matching site plan", async () => {
  const topic = { id: "topic1", tenant: "acme", site_id: "site1", status: "recommended", title: "Topic" };
  const fx = fixture({ repository: {
    async getTrendTopic() { return topic; },
    async updateTrendTopic(id, patch) { Object.assign(topic, patch); return topic; },
    async getPlan() { return fx.plan; },
    async findPlanItemByTopic() { return null; },
    async nextPlanItemOrder() { return 1; },
    async createPlanItem(item) { fx.calls.push(["item", item]); return { id: "item1", ...item }; },
    async deletePlanItem() {},
  } });
  assert.equal(await fx.handle({ callback_query: { id: "cb1", data: "cpt:approve:topic1", message: { chat: { id: 42 } } } }), true);
  assert.equal(topic.status, "consumed");
  assert.equal(fx.calls.find(([name]) => name === "item")[1].plan_id, "plan1");
  assert.match(fx.calls.at(-1)[2], /Đã duyệt/);
});

test("rejects a callback topic from another tenant before changing it", async () => {
  let updated = false;
  const fx = fixture({ repository: {
    async getTrendTopic() { return { id: "topic1", tenant: "other", site_id: "site1", status: "recommended" }; },
    async updateTrendTopic() { updated = true; },
  } });
  await assert.rejects(() => fx.handle({ callback_query: { id: "cb1", data: "cpt:skip:topic1", message: { chat: { id: 42 } } } }), /tenant mismatch/);
  assert.equal(updated, false);
});

test("lists only queued items from the single active plan", async () => {
  const fx = fixture({ repository: {
    async listPlanItems(planId, statuses) {
      fx.calls.push(["list-items", planId, statuses]);
      return { items: [{ id: "item1", topic: "Safe topic" }] };
    },
  } });
  await fx.handle({ message: { chat: { id: 42 }, text: "📋 Hàng chờ" } });
  assert.deepEqual(fx.calls.find(([name]) => name === "list-items").slice(1), ["plan1", ["queued"]]);
  assert.match(fx.calls.at(-1)[2], /Safe topic/);
});

test("splits a long queue into Telegram-safe messages without losing items", async () => {
  const topics = Array.from({ length: 80 }, (_, index) => ({ id: `item${index}`, topic: `${index}: ${"x".repeat(90)}` }));
  const fx = fixture({ repository: {
    async listPlanItems() { return { items: topics }; },
  } });
  await fx.handle({ message: { chat: { id: 42 }, text: "📋 Hàng chờ" } });
  const sent = fx.calls.filter(([name]) => name === "send");
  assert.ok(sent.length > 1);
  assert.ok(sent.every((call) => call[2].length <= 3900));
  assert.match(sent.map((call) => call[2]).join("\n"), /79: x/);
  assert.equal(sent.at(-1)[3].resize_keyboard, true);
});

test("shows draft review actions scoped to the active plan", async () => {
  const fx = fixture({ repository: {
    async listPlanItems() { return { items: [{ id: "item1", topic: "Draft title", status: "review" }] }; },
  } });
  await fx.handle({ message: { chat: { id: 42 }, text: "✅ Duyệt nội dung" } });
  const sent = fx.calls.at(-1);
  assert.match(sent[2], /Draft title/);
  assert.equal(sent[3].inline_keyboard[0][0].callback_data, "cpi:approve:item1");
  assert.equal(sent[3].inline_keyboard[0][1].callback_data, "cpi:reject:item1");
});

test("reject callback deletes a tenant-owned review draft through the shared workflow", async () => {
  const deleted = [];
  const item = { id: "item1", tenant: "acme", plan_id: "plan1", site_id: "site1", post_id: "post1", status: "review" };
  const fx = fixture({ repository: {
    async getPlanItem() { return item; }, async getPost() { return { id: "post1", tenant: "acme" }; },
    async listTranslatedPosts() { return []; }, async listPostTargets() { return [{ id: "target1", status: "pending" }]; },
    async updatePlanItem(_id, patch) { Object.assign(item, patch); return item; }, async deletePost(id) { deleted.push(id); },
  } });
  await fx.handle({ callback_query: { id: "cb1", data: "cpi:reject:item1", message: { chat: { id: 42 } } } });
  assert.deepEqual(deleted, ["post1"]);
  assert.equal(item.status, "cancelled");
  assert.match(fx.calls.at(-1)[2], /Đã xoá/);
});
