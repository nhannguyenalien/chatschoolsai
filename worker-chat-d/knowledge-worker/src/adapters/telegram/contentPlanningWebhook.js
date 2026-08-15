import { importTrend } from "../../workflows/importTrend.js";
import { recommendTopic } from "../../workflows/recommendTopic.js";
import { reviewTopic } from "../../workflows/reviewTopic.js";
import { approveTopicToPlan } from "../../workflows/approveTopicToPlan.js";
import { approveContentPlanItem } from "../../workflows/approveContentPlanItem.js";
import { rejectContentPlanItem } from "../../workflows/rejectContentPlanItem.js";

const IMPORT_BUTTON = "📈 Nạp trend JSON";
const RECOMMEND_BUTTON = "💡 Tư vấn bài trend";
const QUEUE_BUTTON = "📋 Hàng chờ";
const REVIEW_BUTTON = "✅ Duyệt nội dung";
const MENU = { keyboard: [
  [{ text: IMPORT_BUTTON }, { text: RECOMMEND_BUTTON }],
  [{ text: QUEUE_BUTTON }, { text: REVIEW_BUTTON }],
], resize_keyboard: true };

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function chunkTelegramLines(header, lines, maxLength = 3900) {
  const chunks = [];
  let chunk = header;
  for (const line of lines) {
    const safeLine = line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line;
    if (`${chunk}\n${safeLine}`.length > maxLength) {
      chunks.push(chunk);
      chunk = safeLine;
    } else {
      chunk = `${chunk}\n${safeLine}`;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

async function resolveAdmin(repository, chatId) {
  if (!chatId) return null;
  const config = await repository.findBotConfigByOwnerChat(String(chatId));
  if (!config?.tenant) return null;
  const plans = await repository.listActivePlans(config.tenant);
  return { config, plans: plans.items || [] };
}

async function requireSinglePlan(telegram, chatId, admin) {
  if (admin.plans.length === 1) return admin.plans[0];
  const detail = admin.plans.length ? "đang có nhiều content plan active" : "chưa có content plan active";
  await telegram.sendMessage(chatId, `⚠️ Tenant ${escapeHtml(admin.config.tenant)} ${detail}. Hãy cấu hình đúng một plan active trên dashboard.`);
  return null;
}

export function createTelegramContentPlanningWebhook({ repository, legacyHistoryAdapter, telegram }) {
  if (!repository || !telegram) throw new Error("Telegram Content Planning requires repository and telegram client.");
  return async function handle(update) {
    const message = update.message;
    const callback = update.callback_query;
    const chatId = message?.chat?.id || callback?.message?.chat?.id;
    const admin = await resolveAdmin(repository, chatId);
    if (!admin) return false;

    if (callback?.data?.startsWith("cpt:")) {
      const [, action, topicId] = callback.data.split(":");
      const topic = await repository.getTrendTopic(topicId);
      if (topic.tenant !== admin.config.tenant) throw new Error("Telegram topic tenant mismatch.");
      const plan = admin.plans.find((candidate) => candidate.site_id === topic.site_id);
      if (!plan) {
        await telegram.answerCallbackQuery(callback.id, "Không tìm thấy plan active tương ứng.");
        return true;
      }
      if (action === "approve") {
        const queued = await approveTopicToPlan({ repository, tenant: admin.config.tenant, planId: plan.id, topicId });
        await telegram.answerCallbackQuery(callback.id, queued.duplicate ? "Topic đã có trong kế hoạch." : "Đã duyệt và đưa vào kế hoạch.");
      } else if (action === "skip") {
        await reviewTopic({ repository, tenant: admin.config.tenant, siteId: topic.site_id, topicId, action: "reject" });
        await telegram.answerCallbackQuery(callback.id, "Đã bỏ qua topic.");
      }
      return true;
    }

    if (callback?.data?.startsWith("cpi:")) {
      const [, action, itemId] = callback.data.split(":");
      try {
        const item = await repository.getPlanItem(itemId);
        if (item.tenant !== admin.config.tenant) throw new Error("Telegram plan item tenant mismatch.");
        const plan = admin.plans.find((candidate) => candidate.id === item.plan_id && candidate.site_id === item.site_id);
        if (!plan) throw new Error("Không tìm thấy plan active tương ứng.");
        if (action === "approve") {
          await approveContentPlanItem({ repository, tenant: admin.config.tenant, itemId });
          await telegram.answerCallbackQuery(callback.id, "✅ Đã duyệt nội dung; sẵn sàng cho lịch publish.");
        } else if (action === "reject") {
          await rejectContentPlanItem({ repository, tenant: admin.config.tenant, itemId });
          await telegram.answerCallbackQuery(callback.id, "🗑️ Đã xoá bài nháp.");
        } else {
          await telegram.answerCallbackQuery(callback.id, "Không hiểu hành động.");
        }
      } catch (error) {
        await telegram.answerCallbackQuery(callback.id, `❌ ${error instanceof Error ? error.message : "Có lỗi xảy ra."}`);
      }
      return true;
    }

    const text = message?.text?.trim();
    if (text === "/start" || text === "/content" || text === "/help") {
      await telegram.sendMessage(chatId, "🧭 <b>Dashpoc Content Planning</b>\nChọn thao tác:", MENU);
      return true;
    }
    if (text === IMPORT_BUTTON) {
      if (!await requireSinglePlan(telegram, chatId, admin)) return true;
      await repository.updateBotConfig(admin.config.id, { content_planning_telegram_state: "awaiting_trend_json" });
      await telegram.sendMessage(chatId, "Gửi nội dung JSON trend hoặc file <code>.json</code> trong tin nhắn kế tiếp.");
      return true;
    }
    if (text === RECOMMEND_BUTTON) {
      const plan = await requireSinglePlan(telegram, chatId, admin);
      if (!plan) return true;
      const result = await recommendTopic({ repository, legacyHistoryAdapter, tenant: admin.config.tenant, siteId: plan.site_id });
      if (!result.recommendation) {
        await telegram.sendMessage(chatId, "Không còn topic phù hợp sau khi kiểm tra lịch sử và chống trùng.", MENU);
        return true;
      }
      const recommendation = result.recommendation;
      await telegram.sendMessage(chatId, `💡 <b>${escapeHtml(recommendation.candidate.title)}</b>\nKeyword: ${escapeHtml(recommendation.candidate.primaryKeyword)}\nĐiểm: ${escapeHtml(recommendation.candidate.overallScore)}`, {
        inline_keyboard: [[
          { text: "✅ Duyệt", callback_data: `cpt:approve:${recommendation.candidate.id}` },
          { text: "⏭ Bỏ qua", callback_data: `cpt:skip:${recommendation.candidate.id}` },
        ]],
      });
      return true;
    }
    if (text === QUEUE_BUTTON) {
      const plan = await requireSinglePlan(telegram, chatId, admin);
      if (!plan) return true;
      const result = await repository.listPlanItems(plan.id, ["queued"]);
      const items = result.items || [];
      if (!items.length) {
        await telegram.sendMessage(chatId, "Hàng chờ chủ đề đang rỗng.", MENU);
        return true;
      }
      const chunks = chunkTelegramLines(
        `<b>Hàng chờ chủ đề (${items.length}):</b>`,
        items.map((item) => `📝 ${escapeHtml(item.topic)}`),
      );
      for (const [index, body] of chunks.entries()) {
        await telegram.sendMessage(chatId, body, index === chunks.length - 1 ? MENU : undefined);
      }
      return true;
    }
    if (text === REVIEW_BUTTON) {
      const plan = await requireSinglePlan(telegram, chatId, admin);
      if (!plan) return true;
      const result = await repository.listPlanItems(plan.id, ["draft", "review"]);
      const items = result.items || [];
      if (!items.length) {
        await telegram.sendMessage(chatId, "Không có bài nào đang chờ duyệt.", MENU);
        return true;
      }
      for (const item of items) {
        await telegram.sendMessage(chatId, `📝 <b>${escapeHtml(item.topic)}</b>`, { inline_keyboard: [[
          { text: "✅ Duyệt", callback_data: `cpi:approve:${item.id}` },
          { text: "❌ Từ chối", callback_data: `cpi:reject:${item.id}` },
        ]] });
      }
      return true;
    }

    if (admin.config.content_planning_telegram_state === "awaiting_trend_json") {
      const plan = await requireSinglePlan(telegram, chatId, admin);
      if (!plan) return true;
      let jsonText = text;
      if (message.document) {
        if (!message.document.file_name?.toLowerCase().endsWith(".json")) {
          await telegram.sendMessage(chatId, "File phải có định dạng <code>.json</code>.");
          return true;
        }
        jsonText = await telegram.downloadJsonDocument(message.document.file_id);
      }
      if (!jsonText) return false;
      await repository.updateBotConfig(admin.config.id, { content_planning_telegram_state: "" });
      const result = await importTrend({ repository, tenant: admin.config.tenant, siteId: plan.site_id, source: "telegram", text: jsonText });
      await telegram.sendMessage(chatId, `✅ Đã ${result.duplicate ? "nhận diện bản import trùng" : "import"} ${result.topics.length} topic${result.recovered ? " (report thiếu dưới 10 topic)" : ""}.`, MENU);
      return true;
    }
    return false;
  };
}
