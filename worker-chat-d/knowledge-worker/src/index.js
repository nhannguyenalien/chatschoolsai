var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    try {
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ ok: true, version: "v2.1-anythingllm-stable" }), { headers: cors });
      }
      // Route dùng ANYTHINGLLM/TELEGRAM/OPENAI/ADMIN_SECRET -> nạp system_config trước, ghi đè lên env.
      const env2 = { ...env, ...await getSystemConfig(env) };
      if (url.pathname === "/chat" && request.method === "POST") return await handleChat(request, env2, cors);
      if (url.pathname === "/embed" && request.method === "POST") return await handleEmbed(request, env2, cors);
      if (url.pathname === "/doc" && request.method === "DELETE") return await handleDelete(request, env2, cors);
      if (url.pathname === "/sync-docs" || url.pathname === "/run-digest" || url.pathname === "/run-rss-crawl" || url.pathname === "/run-publish-dispatch" || url.pathname === "/run-agent") {
        if (request.method !== "POST") {
          return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cors });
        }
        const providedKey = request.headers.get("X-Admin-Secret") || url.searchParams.get("key");
        if (!env2.ADMIN_SECRET || providedKey !== env2.ADMIN_SECRET) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
        }
        if (url.pathname === "/sync-docs") return await handleSyncDocs(request, env2, cors);
        if (url.pathname === "/run-digest") await handleDailyDigest(env2);
        else if (url.pathname === "/run-rss-crawl") await handleRssCrawlAndGenerate(env2);
        else if (url.pathname === "/run-publish-dispatch") await handlePublishDispatch(env2);
        else await handleAgentRun(env2);
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      }
      if (url.pathname === "/telegram-webhook" && request.method === "POST") {
        return await handleTelegramWebhook(request, env2);
      }
      if (url.pathname.startsWith("/api/v1/")) {
        return await handleApiV1(request, url, env2, cors);
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cors });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
    }
  },
  async scheduled(event, env, ctx) {
    const env2 = { ...env, ...await getSystemConfig(env) };
    if (event.cron === "30 0 * * *") {
      ctx.waitUntil(handleRssCrawlAndGenerate(env2).catch((err) => console.error("[RSS] Lỗi tổng:", err)));
    } else if (event.cron === "*/15 * * * *") {
      ctx.waitUntil(handlePublishDispatch(env2).catch((err) => console.error("[Publish] Lỗi tổng:", err)));
    } else if (event.cron === "0 * * * *") {
      ctx.waitUntil(handleAgentRun(env2).catch((err) => console.error("[Agent] Lỗi tổng:", err)));
    } else {
      ctx.waitUntil(handleDailyDigest(env2).catch((err) => console.error("[Digest] Lỗi tổng:", err)));
    }
  }
};
var HANDOFF_MARKER = "[NEED_HUMAN]";
var HANDOFF_INSTRUCTION = `

QUAN TRỌNG: Nếu bạn kh\xF4ng chắc chắn hoặc kh\xF4ng c\xF3 đủ th\xF4ng tin để trả lời ch\xEDnh x\xE1c c\xE2u hỏi của kh\xE1ch, h\xE3y trả lời phần bạn biết (nếu c\xF3), sau đ\xF3 kết th\xFAc CH\xCDNH X\xC1C bằng chuỗi: ${HANDOFF_MARKER} (kh\xF4ng th\xEAm k\xFD tự n\xE0o sau chuỗi n\xE0y). Chỉ d\xF9ng chuỗi n\xE0y khi thực sự kh\xF4ng chắc, kh\xF4ng lạm dụng.`;
var delay = /* @__PURE__ */ __name((ms) => new Promise((res) => setTimeout(res, ms)), "delay");
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 45e3 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(id);
  return response;
}
__name(fetchWithTimeout, "fetchWithTimeout");
var _pbToken = null;
var workspaceConfigCache = /* @__PURE__ */ new Map();
var _pbTokenTime = 0;
async function getPbToken(env) {
  const now = Date.now();
  if (_pbToken && now - _pbTokenTime < 55 * 60 * 1e3) return _pbToken;
  const res = await fetchWithTimeout(`${env.PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASS })
  });
  const data = await res.json();
  if (!data.token) throw new Error("PocketBase auth th\u1EA5t b\u1EA1i");
  // QUAN TR\u1ECCNG: PocketBase (b\u1EA3n /api/admins/auth-with-password) y\xEAu c\u1EA7u header Authorization
  // l\xE0 CH\xCDNH token th\u1EADt, KH\xD4NG th\xEAm ti\u1EC1n t\u1ED1 "Admin ". N\u1EBFu th\xEAm v\xE0o, PocketBase kh\xF4ng nh\u1EADn
  // di\u1EC7n \u0111\u01B0\u1EE3c \u0111\xE2y l\xE0 admin -> request b\u1ECB coi nh\u01B0 \u1EA9n danh. V\u1EDBi collection c\xF3 createRule/updateRule
  // r\u1ED7ng ("") th\u00EC v\u1EABn qua \u0111\u01B0\u1EE3c (ai c\u0169ng \u0111\u01B0\u1EE3c ph\xE9p) n\xEAn kh\xF4ng l\u1ED9 ra, nh\u01B0ng v\u1EDBi collection c\xF3 rule
  // th\u1EADt (vd "posts", "post_targets": @request.auth.id != "") th\u00EC m\u1ECDi request ghi \u0111\u1EC1u b\u1ECB t\u1EEB ch\u1ED1i
  // \xE2m th\u1EA7m (PocketBase tr\u1EA3 "Failed to create record." kh\xF4ng r\xF5 l\xFD do).
  _pbToken = data.token;
  _pbTokenTime = now;
  return _pbToken;
}
__name(getPbToken, "getPbToken");

// ================= [SYSTEM CONFIG: đọc từ PocketBase, ghi đè lên Cloudflare secret] =================
// Cho phép sửa ANYTHINGLLM_URL/API_KEY, TELEGRAM_BOT_TOKEN, OPENAI_KEY, ADMIN_SECRET... qua
// system-config.html thay vì phải `wrangler secret put` mỗi lần. PB_URL/PB_ADMIN_EMAIL/PB_ADMIN_PASS
// KHÔNG nằm trong system_config vì đó là thứ worker cần để tự kết nối vào PocketBase — nếu lưu
// trong PocketBase sẽ thành vòng lặp con gà quả trứng (và rất nguy hiểm nếu lộ).
var _systemConfigCache = null;
var _systemConfigCacheTime = 0;
var SYSTEM_CONFIG_OVERRIDABLE_KEYS = {
  anythingllm_url: "ANYTHINGLLM_URL",
  anythingllm_api_key: "ANYTHINGLLM_API_KEY",
  telegram_bot_token: "TELEGRAM_BOT_TOKEN",
  openai_key: "OPENAI_KEY",
  openai_base_url: "OPENAI_BASE_URL",
  openai_chat_model: "OPENAI_CHAT_MODEL",
  openai_embedding_model: "OPENAI_EMBEDDING_MODEL",
  admin_secret: "ADMIN_SECRET",
  dashboard_url: "DASHBOARD_URL"
};

async function getSystemConfig(env) {
  const now = Date.now();
  if (_systemConfigCache && now - _systemConfigCacheTime < 5 * 60 * 1e3) return _systemConfigCache;
  const fallback = {};
  for (const envKey of Object.values(SYSTEM_CONFIG_OVERRIDABLE_KEYS)) fallback[envKey] = env[envKey];
  try {
    const pbToken = await getPbToken(env);
    const res = await fetchWithTimeout(`${env.PB_URL}/api/collections/system_config/records?perPage=1`, {
      headers: { Authorization: pbToken }
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const row = data.items?.[0] || {};
    const merged = { ...fallback };
    for (const [pbField, envKey] of Object.entries(SYSTEM_CONFIG_OVERRIDABLE_KEYS)) {
      if (row[pbField]) merged[envKey] = row[pbField];
    }
    _systemConfigCache = merged;
    _systemConfigCacheTime = now;
    return merged;
  } catch (err) {
    console.error("[SystemConfig] Lỗi đọc system_config, d\xF9ng Cloudflare secret l\xE0m fallback:", err);
    return fallback;
  }
}
__name(getSystemConfig, "getSystemConfig");
async function handleChat(request, env, cors) {
  const userAgent = request.headers.get("user-agent") || "";
  let browser = "Kh\xE1c";
  if (userAgent.includes("Edg")) browser = "Edge";
  else if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
  const clientMeta = {
    ip: request.headers.get("cf-connecting-ip") || "unknown",
    device: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ? "Mobile" : "PC",
    browser,
    location: `${request.cf?.city || "Unknown"}, ${request.cf?.country || "Unknown"}`
  };
  const body = await request.json();
  const { tenant, session, question } = body;
  const pbToken = await getPbToken(env);
  if (!tenant || !session || !question) {
    return new Response(JSON.stringify({ error: "Thi\u1EBFu d\u1EEF li\u1EC7u" }), { status: 400, headers: cors });
  }
  await ensureWorkspaceExists(tenant, env);
  let botName = "AI Assistant";
  try {
    // ================= [BƯỚC 1: KIỂM TRA BILLING THEO CONFIG] =================
    // Khai báo cấu hình (Dễ dàng thay đổi sau này)
    const CONFIG = {
        DEFAULT_FREE_LIMIT: 100,
        DEFAULT_PRO_LIMIT: 1000
    };

    // Lấy thông tin Tenant/User từ PocketBase 
    // (Lưu ý: Nếu bảng của bạn tên là 'tenants', hãy đổi 'users' thành 'tenants')
    const userRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/tenants/records?filter=${encodeURIComponent(`tenant='${tenant}'`)}`, {
      headers: { "Authorization": pbToken }
    });
    const userData = await userRes.json();
    const userRecord = userData.items?.[0];

    if (userRecord) {
      let limit = userRecord.message_limit; 
      if (!limit) limit = (userRecord.plan_id === 'pro') ? CONFIG.DEFAULT_PRO_LIMIT : CONFIG.DEFAULT_FREE_LIMIT;

      let used = userRecord.message_used || 0;
      let lastReset = userRecord.last_reset_month || "";
      
      // LOGIC LAZY RESET THÁNG
      const currentMonth = new Date().toISOString().slice(0, 7); // Lấy "YYYY-MM" (VD: "2024-06")
      
      if (lastReset !== currentMonth) {
          // Bắt đầu tháng mới -> Trả used về 0
          used = 0;
          
          // Gọi API cập nhật ngay lập tức xuống DB
          await fetchWithTimeout(`${env.PB_URL}/api/collections/tenants/records/${userRecord.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", "Authorization": pbToken },
              body: JSON.stringify({ 
                  message_used: 0, 
                  last_reset_month: currentMonth 
              })
          });
      }

      // Kiểm tra giới hạn (nếu vừa reset thì used = 0 nên sẽ thoải mái chat)
      if (used >= limit) {
          return new Response(JSON.stringify({ 
              success: true,
              reply: "Bạn đã hết lượt chat trong tháng này. Vui lòng nâng cấp gói!",
              isLimitReached: true 
          }), { headers: cors });
      }
    }


    const configRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/bot_configs/records?filter=${encodeURIComponent(`tenant='${tenant}'`)}`, {
      headers: { "Authorization": pbToken }
    });
    const configData = await configRes.json();
    const botConfig = configData.items?.[0] || {};
    botName = botConfig.bot_name || "AI Assistant";
    const systemPrompt = (botConfig.system_prompt || "") + HANDOFF_INSTRUCTION;
    const temperature = botConfig.temperature !== void 0 ? botConfig.temperature : 0.7;
    await ensureWorkspaceExists(tenant, env);
    console.log("SYSTEM PROMPT:", systemPrompt);
    console.log("TEMPERATURE:", temperature);
    const currentConfigHash = `${systemPrompt}_${temperature}`;
    if (workspaceConfigCache.get(tenant) !== currentConfigHash) {
      console.log(`[Update] C\u1EADp nh\u1EADt System Prompt & Temp (${temperature}) m\u1EDBi cho Workspace: ${tenant}`);
      const updateRes = await fetchWithTimeout(
        `${env.ANYTHINGLLM_URL}api/v1/workspace/${tenant}/update`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.ANYTHINGLLM_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            openAiPrompt: systemPrompt,
            openAiTemp: parseFloat(temperature)
          })
        }
      );
      console.log(
        "UPDATE STATUS:",
        updateRes.status
      );
      console.log(
        "UPDATE RESPONSE:",
        await updateRes.text()
      );
      workspaceConfigCache.set(tenant, currentConfigHash);
    }
    const anythingRes = await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${tenant}/chat`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.ANYTHINGLLM_API_KEY}`,
        "Content-Type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        message: question,
        mode: "chat",
        sessionId: session
      })
    });
    console.log(`[Chat] AnythingLLM Status: ${anythingRes.status}`);
    if (!anythingRes.ok) {
      throw new Error(`AnythingLLM l\u1ED7i ${anythingRes.status}: ${await anythingRes.text()}`);
    }
    const aiData = await anythingRes.json();
    const rawReply = aiData.textResponse || "";
    const needsHuman = rawReply.includes(HANDOFF_MARKER);
    const reply = rawReply.split(HANDOFF_MARKER)[0].trim()
      || "Mình chưa chắc chắn về câu này, để mình nhờ admin hỗ trợ thêm cho bạn nhé!";

    // ================= [BƯỚC 2: CỘNG 1 VÀO MESSAGE_USED] =================
    if (userRecord) {
      let currentUsed = userRecord.message_used || 0; // Đảm bảo lấy 0 nếu db chưa có số
      
      await fetchWithTimeout(`${env.PB_URL}/api/collections/tenants/records/${userRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": pbToken },
        body: JSON.stringify({ message_used: currentUsed + 1 })
      });
    }
    
    await fetchWithTimeout(`${env.PB_URL}/api/collections/messages/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": pbToken },
      body: JSON.stringify({
        tenant,
        session,
        username: botName,
        text: reply,
        is_bot: true,
        needs_human: needsHuman,
        client_meta: clientMeta
      })
    });

    if (needsHuman) {
      try {
        const ownerChatId = botConfig.owner_telegram_chat_id;
        if (ownerChatId && env.TELEGRAM_BOT_TOKEN) {
          let alertText = `⚠️ [${botName}] Kh\xE1ch hỏi m\xE0 AI chưa chắc chắn:
"${question}"

Tenant: ${tenant}`;
          if (env.DASHBOARD_URL) {
            alertText += `
\u{1F449} Trả lời tại: ${env.DASHBOARD_URL}/messages.html?bot=${tenant}&session=${session}`;
          }
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, ownerChatId, alertText);
        }
      } catch (alertErr) {
        console.error("Lỗi gửi cảnh b\xE1o Telegram cho owner:", alertErr);
      }
    }

    return new Response(JSON.stringify({ success: true, reply }), { headers: cors });
  } catch (err) {
    console.error("L\u1ED7i h\u1EC7 th\u1ED1ng Chat:", err);
    return new Response(JSON.stringify({ success: true, reply: "\u26A0\uFE0F H\u1EC7 th\u1ED1ng AI \u0111ang b\u1EADn ho\u1EB7c qu\xE1 t\u1EA3i. Vui l\xF2ng th\u1EED l\u1EA1i!" }), { headers: cors });
  }
}
__name(handleChat, "handleChat");
async function ensureWorkspaceExists(tenant, env) {
  try {
    const checkRes = await fetch(
      `${env.ANYTHINGLLM_URL}api/v1/workspace/${tenant}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.ANYTHINGLLM_API_KEY}`
        }
      }
    );
    const checkRawText = await checkRes.text();
    console.log(`[Workspace Check] status=${checkRes.status} raw=${checkRawText.slice(0, 300)}`);
    let checkData;
    try {
      checkData = JSON.parse(checkRawText);
    } catch (parseErr) {
      throw new Error(`AnythingLLM trả về response kh\xF4ng phải JSON hợp lệ khi check workspace (status ${checkRes.status}): ${checkRawText.slice(0, 200)}`);
    }
    if (checkData.workspace && checkData.workspace.length > 0) {
      return;
    }
    console.log(
      `[Workspace] Ch\u01B0a c\xF3, t\u1EA1o m\u1EDBi: ${tenant}`
    );
    const createRes = await fetch(
      `${env.ANYTHINGLLM_URL}api/v1/workspace/new`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.ANYTHINGLLM_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: tenant
        })
      }
    );
    const createText = await createRes.text();
    console.log(
      `[Workspace Create] ${createRes.status}`,
      createText
    );
    if (!createRes.ok) {
      throw new Error(
        `Create workspace failed: ${createText}`
      );
    }
    await delay(1e3);
  } catch (err) {
    console.error(
      "L\u1ED7i khi t\u1EA1o workspace:",
      err
    );
    throw err;
  }
}
__name(ensureWorkspaceExists, "ensureWorkspaceExists");
async function handleEmbed(request, env, cors) {
  const { tenant, title, text } = await request.json();
  if (!tenant || !text) return new Response(JSON.stringify({ error: "Thi\u1EBFu d\u1EEF li\u1EC7u" }), { status: 400, headers: cors });
  await ensureWorkspaceExists(tenant, env);
  const pbToken = await getPbToken(env);
  try {
    const anythingUploadRes = await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/document/raw-text`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        textContent: text,
        metadata: {
          title: title || `doc_${Date.now()}.txt`,
          tenant
        }
      })
    });
    if (!anythingUploadRes.ok) throw new Error(`AnythingLLM Upload l\u1ED7i: ${await anythingUploadRes.text()}`);
    const uploadData = await anythingUploadRes.json();
    const exactAnythingPath = uploadData.documents?.[0]?.location;
    if (!exactAnythingPath) {
      throw new Error("Upload th\xE0nh c\xF4ng nh\u01B0ng AnythingLLM kh\xF4ng tr\u1EA3 v\u1EC1 \u0111\u01B0\u1EDDng d\u1EABn file!");
    }
    let isEmbedded = false;
    for (let i = 1; i <= 3; i++) {
      console.log(`[L\u1EA7n ${i}] Pin t\xE0i li\u1EC7u v\xE0o Workspace [${tenant}]...`);
      console.log(`- URL: ${env.ANYTHINGLLM_URL}api/v1/workspace/${tenant}/update-embeddings`);
      console.log(`- Path g\u1EEDi \u0111i: ${exactAnythingPath}`);
      try {
        const pinRes = await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${tenant}/update-embeddings`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ adds: [exactAnythingPath], deletes: [] })
        });
        const pinStatus = pinRes.status;
        const pinText = await pinRes.text();
        console.log(`- Status: ${pinStatus} | Response: ${pinText}`);
        if (pinStatus >= 200 && pinStatus < 300) {
          isEmbedded = true;
          break;
        }
      } catch (fetchErr) {
        console.error(`- V\u0103ng l\u1ED7i t\u1EA1i l\u1EC7nh Fetch l\u1EA7n ${i}:`, fetchErr.message);
      }
      console.log(`\u26A0\uFE0F L\u1ED7i Pin t\xE0i li\u1EC7u l\u1EA7n ${i}. Ch\u1EDD 1.5s r\u1ED3i th\u1EED l\u1EA1i...`);
      await delay(1500);
    }
    if (!isEmbedded) {
      throw new Error("Kh\xF4ng th\u1EC3 n\u1EA1p t\xE0i li\u1EC7u v\xE0o AI (Update Embeddings th\u1EA5t b\u1EA1i sau 3 l\u1EA7n th\u1EED).");
    }
    const docRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/documents/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": pbToken },
      body: JSON.stringify({
        tenant,
        title: title || "Untitled",
        raw_text: text,
        char_count: text.length,
        anything_path: exactAnythingPath
      })
    });
    const doc = await docRes.json();
    return new Response(JSON.stringify({ success: true, doc_id: doc.id, chunks_count: "Auto" }), { headers: cors });
  } catch (err) {
    console.error("L\u1ED7i Embed:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
__name(handleEmbed, "handleEmbed");
async function handleDelete(request, env, cors) {
  const { doc_id, tenant } = await request.json();
  if (!doc_id || !tenant) return new Response(JSON.stringify({ error: "Thi\u1EBFu d\u1EEF li\u1EC7u" }), { status: 400, headers: cors });
  const pbToken = await getPbToken(env);
  try {
    const docRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/documents/records/${doc_id}`, {
      headers: { "Authorization": pbToken }
    });
    if (!docRes.ok) throw new Error("Kh\xF4ng t\xECm th\u1EA5y t\xE0i li\u1EC7u trong Database PocketBase");
    const doc = await docRes.json();
    const exactAnythingPath = doc.anything_path;
    await fetchWithTimeout(`${env.PB_URL}/api/collections/documents/records/${doc_id}`, {
      method: "DELETE",
      headers: { "Authorization": pbToken }
    });
    if (exactAnythingPath) {
      await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${tenant}/update-embeddings`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ adds: [], deletes: [exactAnythingPath] })
      });
      await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/system/remove-document`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: exactAnythingPath })
      });
    }
    return new Response(JSON.stringify({ success: true }), { headers: cors });
  } catch (err) {
    console.error("L\u1ED7i Delete:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
__name(handleDelete, "handleDelete");
async function handleTelegramWebhook(request, env) {
  try {
    const update = await request.json();
    console.log("===================================");
    console.log("[Telegram Webhook] \u0110\xE3 nh\u1EADn tin nh\u1EAFn m\u1EDBi:", JSON.stringify(update));
    const message = update.message;
    if (!message) return new Response("OK", { status: 200 });
    const chatId = message.chat.id;
    const pbToken = await getPbToken(env);
    if (message.text && message.text.startsWith("/start HT")) {
      const code = message.text.split(" ")[1];
      console.log(`[Nh\xE1nh 1] Kh\xE1ch \u0111ang g\u1EEDi m\xE3 Code: ${code}`);
      const filterQuery = encodeURIComponent(`code='${code}'`);
      const searchRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/verifications/records?filter=${filterQuery}`, {
        headers: { "Authorization": pbToken }
      });
      const searchData = await searchRes.json();
      console.log(`[Nh\xE1nh 1] K\u1EBFt qu\u1EA3 t\xECm PocketBase:`, JSON.stringify(searchData));
      if (searchData.items && searchData.items.length > 0) {
        const recordId = searchData.items[0].id;
        console.log(`[Nh\xE1nh 1] \u0110\xE3 t\xECm th\u1EA5y Record ID: ${recordId}. Ti\u1EBFn h\xE0nh l\u01B0u chat_id: ${chatId}`);
        const patchRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/verifications/records/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": pbToken },
          body: JSON.stringify({ telegram_chat_id: chatId.toString() })
        });
        console.log(`[Nh\xE1nh 1] K\u1EBFt qu\u1EA3 l\u01B0u DB: Status ${patchRes.status}`);
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "Vui l\xF2ng b\u1EA5m n\xFAt b\xEAn d\u01B0\u1EDBi \u0111\u1EC3 chia s\u1EBB S\u1ED1 \u0111i\u1EC7n tho\u1EA1i b\u1EA3o m\u1EADt.", {
          keyboard: [[{ text: "\u{1F4DE} Chia s\u1EBB S\u1ED1 \u0111i\u1EC7n tho\u1EA1i", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        });
        console.log(`[Nh\xE1nh 1] \u0110\xE3 b\u1EAFn n\xFAt Share S\u0110T cho kh\xE1ch!`);
      } else {
        console.error(`[Nh\xE1nh 1 L\u1ED6I] Kh\xF4ng t\xECm th\u1EA5y m\xE3 ${code} trong Database!`);
      }
    }
    if (message.contact && message.contact.phone_number) {
      const phone = message.contact.phone_number;
      console.log(`[Nh\xE1nh 2] Kh\xE1ch \u0111\xE3 share S\u0110T: ${phone}`);
      const filterQuery = encodeURIComponent(`telegram_chat_id='${chatId}'`);
      const searchRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/verifications/records?filter=${filterQuery}`, {
        headers: { "Authorization": pbToken }
      });
      const searchData = await searchRes.json();
      if (searchData.items && searchData.items.length > 0) {
        const recordId = searchData.items[0].id;
        await fetchWithTimeout(`${env.PB_URL}/api/collections/verifications/records/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": pbToken },
          body: JSON.stringify({ phone, status: "verified" })
        });
        console.log(`[Nh\xE1nh 2] \u0110\xE3 update tr\u1EA1ng th\xE1i verified th\xE0nh c\xF4ng!`);
        const frontendDomain = record.domain || "https://chat.schoolsai.work";
        const returnUrl = `${frontendDomain}/?bot=${record.tenant || "huutin"}&session=${record.session}&show_name=1`;
        const successMsg = `\u2705 X\xE1c th\u1EF1c th\xE0nh c\xF4ng!

Vui l\xF2ng b\u1EA5m v\xE0o link d\u01B0\u1EDBi \u0111\xE2y \u0111\u1EC3 quay l\u1EA1i ph\xF2ng chat c\u1EE7a b\u1EA1n:
\u{1F449} ${returnUrl}`;
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, successMsg, { remove_keyboard: true });
      } else {
        console.error(`[Nh\xE1nh 2 L\u1ED6I] Kh\xF4ng t\xECm th\u1EA5y ai c\xF3 chat_id l\xE0 ${chatId}`);
      }
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[Webhook L\u1ED6I T\u1ED4NG]:", err);
    return new Response("OK", { status: 200 });
  }
}
__name(handleTelegramWebhook, "handleTelegramWebhook");
async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
__name(sendTelegramMessage, "sendTelegramMessage");
async function handleSyncDocs(request, env, cors) {
  const { tenant, secret_key } = await request.json();
  if (!tenant) return new Response(JSON.stringify({ error: "Thi\u1EBFu th\xF4ng tin tenant" }), { status: 400, headers: cors });
  const pbToken = await getPbToken(env);
  try {
    let fetchUrl = `${env.PB_URL}/api/collections/documents/records?perPage=500`;
    if (tenant !== "all") {
      fetchUrl += `&filter=${encodeURIComponent(`tenant='${tenant}'`)}`;
    }
    const docsRes = await fetchWithTimeout(fetchUrl, { headers: { "Authorization": pbToken } });
    const docsData = await docsRes.json();
    const syncedConfigs = /* @__PURE__ */ new Set();
    let successCount = 0;
    let failCount = 0;
    const items = docsData.items || [];
    if (items.length === 0 && tenant !== "all") {
      items.push({ tenant, isDummy: true });
    }
    for (const doc of items) {
      const currentTenant = doc.tenant;
      try {
        await ensureWorkspaceExists(currentTenant, env);
        if (!syncedConfigs.has(currentTenant)) {
          const configRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/bot_configs/records?filter=${encodeURIComponent(`tenant='${currentTenant}'`)}`, {
            headers: { "Authorization": pbToken }
          });
          const configData = await configRes.json();
          const botConfig = configData.items?.[0];
          if (botConfig) {
            await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${currentTenant}/update`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                openAiPrompt: botConfig.system_prompt || "",
                openAiTemp: parseFloat(botConfig.temperature !== void 0 ? botConfig.temperature : 0.7)
              })
            });
            console.log(`[Sync] \u0110\xE3 c\u1EADp nh\u1EADt Prompt cho tenant: ${currentTenant}`);
          }
          syncedConfigs.add(currentTenant);
        }
        if (doc.isDummy) continue;
        const uploadRes = await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/document/raw-text`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            textContent: doc.raw_text,
            metadata: { title: doc.title || `doc_sync.txt`, tenant: currentTenant }
          })
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const uploadData = await uploadRes.json();
        const newExactPath = uploadData.documents?.[0]?.location;
        if (newExactPath) {
          let isEmbedded = false;
          for (let i = 1; i <= 3; i++) {
            console.log(`[Sync ${currentTenant}] Pin l\u1EA7n ${i}...`);
            try {
              const pinRes = await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${currentTenant}/update-embeddings`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ adds: [newExactPath], deletes: [] })
              });
              if (pinRes.ok) {
                isEmbedded = true;
                break;
              }
            } catch (fetchErr) {
            }
            await delay(1500);
          }
          if (!isEmbedded) throw new Error("Update Embeddings th\u1EA5t b\u1EA1i sau 3 l\u1EA7n th\u1EED");
          await fetchWithTimeout(`${env.PB_URL}/api/collections/documents/records/${doc.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": pbToken },
            body: JSON.stringify({ anything_path: newExactPath })
          });
          successCount++;
        }
      } catch (e) {
        console.error(`L\u1ED7i sync t\xE0i li\u1EC7u ${doc.id} (Tenant: ${currentTenant}):`, e);
        failCount++;
      }
      await delay(1200);
    }
    return new Response(JSON.stringify({
      success: true,
      message: `\u0110\xE3 sync xong! Th\xE0nh c\xF4ng: ${successCount}, Th\u1EA5t b\u1EA1i: ${failCount}`
    }), { headers: cors });
  } catch (err) {
    console.error("L\u1ED7i Auto Sync:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
__name(handleSyncDocs, "handleSyncDocs");

// ================= [DIGEST HÀNG NGÀY: KHÔNG GỌI LLM, CHỈ ĐẾM SỐ TỪ POCKETBASE] =================
function getYesterdayRangeICT() {
  const now = /* @__PURE__ */ new Date();
  const ict = new Date(now.getTime() + 7 * 3600 * 1e3);
  const y = new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), ict.getUTCDate() - 1));
  const startUTC = new Date(y.getTime() - 7 * 3600 * 1e3);
  const endUTC = new Date(startUTC.getTime() + 24 * 3600 * 1e3);
  const label = `${String(y.getUTCDate()).padStart(2, "0")}/${String(y.getUTCMonth() + 1).padStart(2, "0")}/${y.getUTCFullYear()}`;
  return { startISO: startUTC.toISOString(), endISO: endUTC.toISOString(), label, dateISO: y.toISOString() };
}
__name(getYesterdayRangeICT, "getYesterdayRangeICT");

function escHtmlWorker(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
__name(escHtmlWorker, "escHtmlWorker");

// Escape giá trị chèn vào filter PocketBase (bắt buộc dùng cho MỌI chuỗi lấy từ nguồn ngoài
// không tin cậy — vd RSS feed — để tránh injection vào filter query).
function escFilterValue(str) {
  return String(str || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
__name(escFilterValue, "escFilterValue");

// Sửa lỗi rất hay gặp: model trả JSON nhưng field dài nhiều đoạn (vd content bài viết dài)
// lại chứa xuống dòng THẬT thay vì "\n" đã escape đúng chuẩn JSON -> JSON.parse() sẽ crash.
// Bài ngắn 1 dòng thường không dính lỗi này, bài dài nhiều đoạn thì gần như luôn dính.
function sanitizeJsonNewlines(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === "\\") {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        out += "\\r";
      } else if (ch === "\t") {
        out += "\\t";
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}
__name(sanitizeJsonNewlines, "sanitizeJsonNewlines");

// Trích JSON object từ text trả về của LLM — chịu được cả khi model lỡ viết thêm chữ
// trước/sau JSON (không chỉ strip markdown code fence), VÀ chịu được xuống dòng thật
// bên trong field dài (bài viết nhiều đoạn) nhờ sanitizeJsonNewlines ở trên.
function extractJsonObject(text) {
  let raw = String(text || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) raw = raw.slice(start, end + 1);
  try {
    return JSON.parse(raw);
  } catch {
  }
  try {
    return JSON.parse(sanitizeJsonNewlines(raw));
  } catch (err) {
    throw new Error("Kh\xF4ng t\xECm thấy JSON hợp lệ trong phản hồi AI: " + err.message);
  }
}
__name(extractJsonObject, "extractJsonObject");

async function pbCount(env, pbToken, collection, filter) {
  const url = `${env.PB_URL}/api/collections/${collection}/records?perPage=1&filter=${encodeURIComponent(filter)}`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: pbToken } });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.totalItems || 0;
}
__name(pbCount, "pbCount");

async function pbDistinctSessionIds(env, pbToken, tenant, startISO, endISO) {
  const filter = encodeURIComponent(`tenant='${tenant}' && created >= '${startISO}' && created < '${endISO}'`);
  const url = `${env.PB_URL}/api/collections/messages/records?perPage=500&fields=session&filter=${filter}`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: pbToken } });
  if (!res.ok) return [];
  const data = await res.json();
  return [...new Set((data.items || []).map((i) => i.session))];
}
__name(pbDistinctSessionIds, "pbDistinctSessionIds");

// ================= [PHÂN LOẠI NỘI DUNG HỘI THOẠI: 1 LẦN LLM / PHIÊN / NGÀY] =================
// Chạy trong job digest (không phải mỗi tin nhắn) để tốn ít token nhất có thể.
// Dùng 1 workspace AnythingLLM riêng, tách biệt hoàn toàn khỏi workspace chat của từng tenant
// (không dính system_prompt/persona của tenant, không lẫn lịch sử chat thật của khách).
//
// Ghi kết quả vào 2 collection CÓ SẴN trong PocketBase (không tạo bảng mới):
//   - session_summaries: cần thêm field "date" (text, vd "10/07/2026") — các field
//     tenant/session_id/contact_info/status/summary đã có sẵn đúng ý.
//   - daily_reports: đã đủ field (tenant, report_date, total_leads, content) — chỉ cần ghi vào.
var CLASSIFIER_WORKSPACE = "conversation-classifier";
var CLASSIFIER_SYSTEM_PROMPT = "Bạn l\xE0 hệ thống ph\xE2n loại hội thoại chăm s\xF3c kh\xE1ch h\xE0ng. Chỉ trả lời đ\xFAng 1 JSON object, kh\xF4ng th\xEAm chữ n\xE0o kh\xE1c, kh\xF4ng d\xF9ng markdown code fence.";
var _classifierReady = false;
var MAX_TRANSCRIPT_MESSAGES = 30;
var MAX_CHARS_PER_MESSAGE = 500;

async function ensureClassifierWorkspace(env) {
  if (_classifierReady) return;
  await ensureWorkspaceExists(CLASSIFIER_WORKSPACE, env);
  await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${CLASSIFIER_WORKSPACE}/update`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ openAiPrompt: CLASSIFIER_SYSTEM_PROMPT, openAiTemp: 0.1 })
  });
  _classifierReady = true;
}
__name(ensureClassifierWorkspace, "ensureClassifierWorkspace");

async function fetchSessionTranscript(env, pbToken, tenant, session, startISO, endISO) {
  const filter = encodeURIComponent(`tenant='${tenant}' && session='${session}' && created >= '${startISO}' && created < '${endISO}'`);
  const url = `${env.PB_URL}/api/collections/messages/records?perPage=${MAX_TRANSCRIPT_MESSAGES}&sort=created&fields=username,text,is_bot&filter=${filter}`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: pbToken } });
  if (!res.ok) return "";
  const data = await res.json();
  return (data.items || []).map((m) => {
    const role = !m.is_bot ? "Kh\xE1ch" : m.username === "Admin" ? "Admin" : "AI";
    const text = String(m.text || "").slice(0, MAX_CHARS_PER_MESSAGE);
    return `${role}: ${text}`;
  }).join("\n");
}
__name(fetchSessionTranscript, "fetchSessionTranscript");

var SS_STATUS = { CLOSED: "Đã chốt", THINKING: "Đang suy nghĩ", NEEDS_SUPPORT: "Cần hỗ trợ", OTHER: "Khác" };

async function classifySession(env, transcript) {
  if (!transcript.trim()) return null;
  const prompt = `Dựa v\xE0o đoạn hội thoại dưới đ\xE2y, h\xE3y ph\xE2n loại v\xE0 CHỈ trả về JSON đ\xFAng format sau, kh\xF4ng th\xEAm chữ n\xE0o kh\xE1c:

{"status":"...","summary":"...","contact_info":"..."}

- status: CHỈ được d\xF9ng đ\xFAng 1 trong 4 gi\xE1 trị sau (giữ nguy\xEAn dấu tiếng Việt):
  "Đã chốt" (kh\xE1ch đ\xE3 đặt/mua/chốt đơn trong đoạn n\xE0y),
  "Đang suy nghĩ" (kh\xE1ch đang hỏi th\xF4ng tin, tư vấn, c\xE2n nhắc, chưa quyết định),
  "Cần hỗ trợ" (kh\xE1ch phàn n\xE0n, gặp vấn đề, hoặc c\xF2n việc chưa được giải quyết xong),
  "Khác" (kh\xF4ng thuộc c\xE1c trường hợp tr\xEAn).
- summary: t\xF3m tắt 1-2 c\xE2u ngắn gọn bằng tiếng Việt, n\xEAu r\xF5 kh\xE1ch c\xF3 h\xE0i l\xF2ng hay kh\xF4ng nếu thể hiện r\xF5 trong hội thoại.
- contact_info: số điện thoại hoặc email kh\xE1ch để lại trong đoạn n\xE0y (nếu c\xF3), để trống "" nếu kh\xF4ng c\xF3.

Hội thoại:
${transcript}`;
  try {
    await ensureClassifierWorkspace(env);
    const res = await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${CLASSIFIER_WORKSPACE}/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ message: prompt, mode: "chat", sessionId: `classify_${Date.now()}_${Math.random().toString(36).slice(2)}` })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = extractJsonObject(data.textResponse);
    const validStatuses = Object.values(SS_STATUS);
    return {
      status: validStatuses.includes(parsed.status) ? parsed.status : SS_STATUS.OTHER,
      summary: String(parsed.summary || "").slice(0, 500),
      contact_info: String(parsed.contact_info || "").slice(0, 100)
    };
  } catch (err) {
    console.error("[Digest] Lỗi ph\xE2n loại hội thoại:", err);
    return null;
  }
}
__name(classifySession, "classifySession");

async function classifySessionsForTenant(env, pbToken, tenant, startISO, endISO, label) {
  const sessions = await pbDistinctSessionIds(env, pbToken, tenant, startISO, endISO);
  for (const session of sessions) {
    try {
      const transcript = await fetchSessionTranscript(env, pbToken, tenant, session, startISO, endISO);
      const insight = await classifySession(env, transcript);
      if (!insight) continue;
      await fetchWithTimeout(`${env.PB_URL}/api/collections/session_summaries/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: pbToken },
        body: JSON.stringify({ tenant, session_id: session, date: label, ...insight })
      });
    } catch (err) {
      console.error(`[Digest] Lỗi lưu session_summaries cho session ${session}:`, err);
    }
  }
}
__name(classifySessionsForTenant, "classifySessionsForTenant");

async function getInsightCounts(env, pbToken, tenant, label) {
  const qi = (filter) => pbCount(env, pbToken, "session_summaries", filter);
  const base = `tenant='${tenant}' && date='${label}'`;
  const [orders, needsSupport, thinking] = await Promise.all([
    qi(`${base} && status='${SS_STATUS.CLOSED}'`),
    qi(`${base} && status='${SS_STATUS.NEEDS_SUPPORT}'`),
    qi(`${base} && status='${SS_STATUS.THINKING}'`)
  ]);
  return { orders, needsSupport, thinking };
}
__name(getInsightCounts, "getInsightCounts");

async function buildDigestForTenant(env, pbToken, cfg, startISO, endISO, label, dateISO) {
  const tenant = cfg.tenant;
  const qMsg = (filter) => pbCount(env, pbToken, "messages", filter);
  const qTarget = (filter) => pbCount(env, pbToken, "post_targets", filter);

  const [customerMsg, sessionsToday, escalationsToday, backlogPending, published, errored, waitingPosts] = await Promise.all([
    qMsg(`tenant='${tenant}' && created >= '${startISO}' && created < '${endISO}' && is_bot=false`),
    pbDistinctSessionIds(env, pbToken, tenant, startISO, endISO).then((s) => s.length),
    qMsg(`tenant='${tenant}' && created >= '${startISO}' && created < '${endISO}' && needs_human=true`),
    qMsg(`tenant='${tenant}' && needs_human=true && escalation_resolved=false`),
    qTarget(`tenant='${tenant}' && status='published' && updated >= '${startISO}' && updated < '${endISO}'`),
    qTarget(`tenant='${tenant}' && status='error' && updated >= '${startISO}' && updated < '${endISO}'`),
    qTarget(`tenant='${tenant}' && (status='pending' || status='approved' || status='scheduled')`)
  ]);

  const hasActivity = customerMsg > 0 || published > 0 || errored > 0 || backlogPending > 0 || waitingPosts > 0;
  if (!hasActivity) return null;

  const { orders, needsSupport, thinking } = await getInsightCounts(env, pbToken, tenant, label);

  const botName = cfg.bot_name || tenant;
  const lines = [];
  lines.push(`\u{1F4CA} B\xE1o c\xE1o ng\xE0y ${label} — ${botName}`);
  lines.push("");
  lines.push(`\u{1F4AC} Chat:`);
  lines.push(`• ${customerMsg} tin nhắn kh\xE1ch / ${sessionsToday} phi\xEAn chat`);
  lines.push(`• \u{1F6D2} ${orders} kh\xE1ch đ\xE3 chốt · \u{1F64B} ${thinking} kh\xE1ch đang suy nghĩ · ${needsSupport > 0 ? "\u{1F61E}" : "\u{1F642}"} ${needsSupport} kh\xE1ch cần hỗ trợ`);
  lines.push(`• ${escalationsToday} c\xE2u AI chưa chắc chắn h\xF4m qua`);
  if (backlogPending > 0) {
    lines.push(`• ⚠️ ${backlogPending} c\xE2u vẫn chưa xử l\xFD (tồn đọng) — v\xE0o Chat Logs kiểm tra`);
  }
  lines.push("");
  lines.push(`\u{1F4E2} Đăng b\xE0i:`);
  lines.push(`• ${published} b\xE0i đăng th\xE0nh c\xF4ng`);
  lines.push(`• ${errored > 0 ? "\u{1F534}" : "✅"} ${errored} b\xE0i lỗi`);
  if (waitingPosts > 0) {
    lines.push(`• ${waitingPosts} b\xE0i đang chờ duyệt/lịch đăng`);
  }
  if (env.DASHBOARD_URL) {
    lines.push("");
    lines.push(`\u{1F449} Xem chi tiết: ${env.DASHBOARD_URL}/index.html?bot=${tenant}`);
  }

  return { text: lines.join("\n"), sessionsToday };
}
__name(buildDigestForTenant, "buildDigestForTenant");

async function saveDailyReport(env, pbToken, tenant, dateISO, digestText, sessionsToday) {
  const html = digestText.split("\n").map((l) => `<p>${escHtmlWorker(l) || "&nbsp;"}</p>`).join("");
  try {
    await fetchWithTimeout(`${env.PB_URL}/api/collections/daily_reports/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: pbToken },
      body: JSON.stringify({ tenant, report_date: dateISO, total_leads: sessionsToday, content: html })
    });
  } catch (err) {
    console.error(`[Digest] Lỗi lưu daily_reports cho tenant ${tenant}:`, err);
  }
}
__name(saveDailyReport, "saveDailyReport");

async function handleDailyDigest(env) {
  const pbToken = await getPbToken(env);
  const { startISO, endISO, label, dateISO } = getYesterdayRangeICT();

  const configsRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/bot_configs/records?perPage=200`, {
    headers: { Authorization: pbToken }
  });
  const configsData = await configsRes.json();
  const configs = (configsData.items || []).filter((c) => c.tenant);

  for (const cfg of configs) {
    try {
      await classifySessionsForTenant(env, pbToken, cfg.tenant, startISO, endISO, label);
      const digest = await buildDigestForTenant(env, pbToken, cfg, startISO, endISO, label, dateISO);
      if (!digest) continue;
      await saveDailyReport(env, pbToken, cfg.tenant, dateISO, digest.text, digest.sessionsToday);
      if (cfg.owner_telegram_chat_id) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, cfg.owner_telegram_chat_id, digest.text);
      }
    } catch (err) {
      console.error(`[Digest] Lỗi xử lý tenant ${cfg.tenant}:`, err);
    }
  }
}
__name(handleDailyDigest, "handleDailyDigest");

// ================= [RSS PARSER: nhẹ, không cần thư viện ngoài] =================
function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1] : "";
}
__name(extractTag, "extractTag");

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim();
}
__name(stripCdata, "stripCdata");

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
__name(stripHtml, "stripHtml");

function parseRssItems(xml) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const items = [];
  for (const block of blocks) {
    const title = stripHtml(stripCdata(extractTag(block, "title")));
    const link = stripCdata(extractTag(block, "link")).trim();
    const descRaw = extractTag(block, "description") || extractTag(block, "content:encoded");
    const description = stripHtml(stripCdata(descRaw)).slice(0, 1500);
    if (title && link) items.push({ title, link, description });
  }
  return items;
}
__name(parseRssItems, "parseRssItems");

// ================= [TỰ ĐỘNG VIẾT BÀI TỪ RSS: 1 workspace AI riêng, tách khỏi persona chat] =================
var CONTENT_WORKSPACE = "content-writer";
var CONTENT_OUTPUT_INSTRUCTION = `

QUAN TRỌNG: Chỉ trả lời đ\xFAng 1 JSON object, kh\xF4ng th\xEAm chữ n\xE0o kh\xE1c, kh\xF4ng d\xF9ng markdown code fence:
{"title":"...","content":"...","image_prompt":"..."}
- title: ti\xEAu đề ngắn gọn, hấp dẫn.
- content: nội dung đầy đủ để đăng l\xEAn mạng x\xE3 hội (c\xF3 thể d\xF9ng emoji). Nếu content c\xF3 nhiều đoạn/xuống d\xF2ng,
  BẮT BUỘC d\xF9ng k\xFD hiệu \\n (đ\xFAng chuẩn escape JSON) thay v\xEC xuống d\xF2ng thật trong chuỗi.
- image_prompt: m\xF4 tả ngắn cho ảnh minh hoạ ph\xF9 hợp (tiếng Anh), để trống nếu kh\xF4ng cần.`;
var _contentWorkspaceHash = null;

async function ensureContentWorkspace(env, systemPrompt, temperature) {
  await ensureWorkspaceExists(CONTENT_WORKSPACE, env);
  const hash = `${systemPrompt}_${temperature}`;
  if (_contentWorkspaceHash === hash) return;
  await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${CONTENT_WORKSPACE}/update`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ openAiPrompt: systemPrompt, openAiTemp: parseFloat(temperature) })
  });
  _contentWorkspaceHash = hash;
}
__name(ensureContentWorkspace, "ensureContentWorkspace");

async function generatePostFromRssItem(env, item, aiPrompt) {
  const systemPrompt = (aiPrompt.system_prompt || "") + CONTENT_OUTPUT_INSTRUCTION;
  const temperature = 0.7;
  try {
    await ensureContentWorkspace(env, systemPrompt, temperature);
    const userMessage = `Ti\xEAu đề nguồn: ${item.title}
M\xF4 tả/nội dung nguồn: ${item.description}
Link gốc: ${item.link}`;
    const res = await fetchWithTimeout(`${env.ANYTHINGLLM_URL}api/v1/workspace/${CONTENT_WORKSPACE}/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.ANYTHINGLLM_API_KEY}`, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ message: userMessage, mode: "chat", sessionId: `gen_${Date.now()}_${Math.random().toString(36).slice(2)}` })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = extractJsonObject(data.textResponse);
    return {
      title: String(parsed.title || "").slice(0, 200),
      content: String(parsed.content || ""),
      image_prompt: String(parsed.image_prompt || "")
    };
  } catch (err) {
    console.error("[RSS] Lỗi tạo nội dung AI:", err);
    return null;
  }
}
__name(generatePostFromRssItem, "generatePostFromRssItem");

// ================= [AI VẼ ẢNH: DALL-E 3, chỉ chạy khi bài chưa có ảnh/video sẵn] =================
async function generateImageWithDallE(env, prompt) {
  if (!env.OPENAI_KEY || !prompt) return null;
  try {
    const res = await fetchWithTimeout(`${env.OPENAI_BASE_URL}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1024x1024", response_format: "b64_json" }),
      timeout: 6e4
    });
    if (!res.ok) {
      console.error(`[Image] DALL-E lỗi ${res.status}:`, await res.text());
      return null;
    }
    const data = await res.json();
    return data.data?.[0]?.b64_json || null;
  } catch (err) {
    console.error("[Image] Lỗi gọi DALL-E:", err);
    return null;
  }
}
__name(generateImageWithDallE, "generateImageWithDallE");

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
__name(base64ToBlob, "base64ToBlob");

// Lưu ảnh AI vẽ vào media_library (source='ai_generated') — dùng chung thư viện media với
// ảnh khách tự upload, để composer.html/kho library thấy được và có thể tái sử dụng.
async function uploadImageToMediaLibrary(env, pbToken, tenant, base64Image, label, promptUsed) {
  const blob = base64ToBlob(base64Image, "image/png");
  const form = new FormData();
  form.append("tenant", tenant);
  form.append("label", String(label || "AI generated").slice(0, 100));
  form.append("source", "ai_generated");
  form.append("type", "image");
  form.append("status", "ready");
  form.append("prompt_used", String(promptUsed || "").slice(0, 500));
  form.append("file", blob, `ai_${Date.now()}.png`);
  const res = await fetchWithTimeout(`${env.PB_URL}/api/collections/media_library/records`, {
    method: "POST",
    headers: { Authorization: pbToken },
    body: form
  });
  if (!res.ok) {
    console.error(`[Image] Upload media_library lỗi ${res.status}:`, await res.text());
    return null;
  }
  const record = await res.json();
  if (!record.file) return null;
  return `${env.PB_URL}/api/files/media_library/${record.id}/${record.file}`;
}
__name(uploadImageToMediaLibrary, "uploadImageToMediaLibrary");

async function processOneRssSource(env, pbToken, source) {
  const aiPrompt = source.expand?.prompt_id;
  if (!aiPrompt) {
    console.log(`[RSS] Nguồn "${source.label}" chưa gắn AI Prompt, bỏ qua`);
    return;
  }
  const feedRes = await fetchWithTimeout(source.rss_url, { timeout: 15e3 });
  if (!feedRes.ok) {
    console.error(`[RSS] Kh\xF4ng tải được feed: ${source.rss_url}`);
    return;
  }
  const xml = await feedRes.text();
  const items = parseRssItems(xml).slice(0, source.max_items || 7);

  const pagesRes = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/pages_config/records?perPage=100&filter=${encodeURIComponent(`tenant='${source.tenant}' && is_active=true && (platform='facebook' || platform='instagram')`)}`,
    { headers: { Authorization: pbToken } }
  );
  const pagesData = await pagesRes.json();
  const activePages = pagesData.items || [];

  for (const item of items) {
    try {
      const dupRes = await fetchWithTimeout(
        `${env.PB_URL}/api/collections/posts/records?perPage=1&filter=${encodeURIComponent(`tenant='${source.tenant}' && source_url='${escFilterValue(item.link)}'`)}`,
        { headers: { Authorization: pbToken } }
      );
      const dupData = await dupRes.json();
      if ((dupData.totalItems || 0) > 0) continue;

      const generated = await generatePostFromRssItem(env, item, aiPrompt);
      if (!generated || !generated.content) continue;

      const postRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/posts/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: pbToken },
        body: JSON.stringify({
          tenant: source.tenant,
          title: generated.title || item.title,
          content: generated.content,
          image_prompt: generated.image_prompt || "",
          source_url: item.link
        })
      });
      const post = await postRes.json();
      if (!post.id) continue;

      if (generated.image_prompt) {
        try {
          const b64Image = await generateImageWithDallE(env, generated.image_prompt);
          if (b64Image) {
            const imageUrl = await uploadImageToMediaLibrary(env, pbToken, source.tenant, b64Image, generated.title || item.title, generated.image_prompt);
            if (imageUrl) {
              await fetchWithTimeout(`${env.PB_URL}/api/collections/media/records`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: pbToken },
                body: JSON.stringify({ tenant: source.tenant, post_id: post.id, url: imageUrl, type: "image", order: 0 })
              });
            }
          }
        } catch (err) {
          console.error(`[Image] Lỗi tạo ảnh cho post ${post.id}:`, err);
        }
      }

      for (const page of activePages) {
        await fetchWithTimeout(`${env.PB_URL}/api/collections/post_targets/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: pbToken },
          body: JSON.stringify({
            tenant: source.tenant,
            post_id: post.id,
            platform: page.platform,
            page_id: page.page_id,
            status: "pending"
          })
        });
      }
    } catch (err) {
      console.error(`[RSS] Lỗi xử l\xFD item ${item.link}:`, err);
    }
  }
}
__name(processOneRssSource, "processOneRssSource");

// tenantFilter tuỳ chọn — bỏ trống thì chạy cho TẤT CẢ tenant (dùng bởi cron), truyền vào thì
// chỉ chạy đúng 1 tenant (dùng bởi /api/v1/trigger/rss-crawl khi hệ thống ngoài gọi vào).
async function handleRssCrawlAndGenerate(env, tenantFilter) {
  const pbToken = await getPbToken(env);
  let filter = "is_active=true";
  if (tenantFilter) filter += ` && tenant='${escFilterValue(tenantFilter)}'`;
  const sourcesRes = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/rss_sources/records?perPage=200&filter=${encodeURIComponent(filter)}&expand=prompt_id`,
    { headers: { Authorization: pbToken } }
  );
  const sourcesData = await sourcesRes.json();
  const sources = sourcesData.items || [];

  for (const source of sources) {
    try {
      await processOneRssSource(env, pbToken, source);
    } catch (err) {
      console.error(`[RSS] Lỗi xử l\xFD nguồn ${source.label}:`, err);
    }
  }
}
__name(handleRssCrawlAndGenerate, "handleRssCrawlAndGenerate");

// ================= [ĐĂNG BÀI TỰ ĐỘNG: Facebook/Instagram Graph API] =================
// LƯU Ý: chỉ chạy cho post_targets đã được người dùng duyệt (status='approved')
// hoặc đã tới giờ hẹn (status='scheduled' && scheduled_at <= now). AI không tự đăng khi chưa duyệt.
var FB_GRAPH_VERSION = "v19.0";

async function markTargetError(env, pbToken, targetId, message) {
  await fetchWithTimeout(`${env.PB_URL}/api/collections/post_targets/records/${targetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: pbToken },
    body: JSON.stringify({ status: "error", error_log: String(message).slice(0, 500) })
  }).catch(() => {
  });
}
__name(markTargetError, "markTargetError");

// ================= [CLOUDINARY: chèn logo/thương hiệu lên ảnh trước khi đăng] =================
// Mỗi tenant dùng tài khoản Cloudinary riêng (nhập ở config.html). Nếu tenant chưa cấu hình
// đủ 4 thứ (cloud_name/api_key/api_secret/brand_logo_url) thì bỏ qua, dùng ảnh gốc — không chặn đăng bài.
async function cloudinarySignature(params, apiSecret) {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(sorted + apiSecret));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(cloudinarySignature, "cloudinarySignature");

async function cloudinaryUpload(cfg, fileUrl, extraParams = {}) {
  const timestamp = Math.floor(Date.now() / 1e3);
  const signature = await cloudinarySignature({ timestamp, ...extraParams }, cfg.cloudinary_api_secret);
  const form = new FormData();
  form.append("file", fileUrl);
  form.append("api_key", cfg.cloudinary_api_key);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  Object.entries(extraParams).forEach(([k, v]) => form.append(k, String(v)));
  const res = await fetchWithTimeout(`https://api.cloudinary.com/v1_1/${cfg.cloudinary_cloud_name}/image/upload`, {
    method: "POST",
    body: form,
    timeout: 3e4
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || `Cloudinary upload lỗi ${res.status}`);
  return data;
}
__name(cloudinaryUpload, "cloudinaryUpload");

// Upload logo lên Cloudinary 1 lần rồi cache public_id vào bot_configs — chỉ upload lại nếu
// tenant đổi link logo (brand_logo_url khác brand_logo_cached_url).
async function ensureLogoUploaded(env, pbToken, cfg) {
  if (cfg.brand_logo_public_id && cfg.brand_logo_cached_url === cfg.brand_logo_url) {
    return cfg.brand_logo_public_id;
  }
  const data = await cloudinaryUpload(cfg, cfg.brand_logo_url, {});
  await fetchWithTimeout(`${env.PB_URL}/api/collections/bot_configs/records/${cfg.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: pbToken },
    body: JSON.stringify({ brand_logo_public_id: data.public_id, brand_logo_cached_url: cfg.brand_logo_url })
  });
  cfg.brand_logo_public_id = data.public_id;
  cfg.brand_logo_cached_url = cfg.brand_logo_url;
  return data.public_id;
}
__name(ensureLogoUploaded, "ensureLogoUploaded");

async function applyBranding(env, pbToken, cfg, imageUrl) {
  if (!imageUrl) return imageUrl;
  if (!cfg?.cloudinary_cloud_name || !cfg?.cloudinary_api_key || !cfg?.cloudinary_api_secret || !cfg?.brand_logo_url) {
    return imageUrl;
  }
  try {
    const logoPublicId = await ensureLogoUploaded(env, pbToken, cfg);
    const transformation = `l_${logoPublicId},g_south_east,x_20,y_20,w_150,fl_layer_apply`;
    const data = await cloudinaryUpload(cfg, imageUrl, { transformation });
    return data.secure_url || imageUrl;
  } catch (err) {
    console.error("[Branding] Lỗi chèn logo Cloudinary:", err);
    return imageUrl;
  }
}
__name(applyBranding, "applyBranding");

async function publishToFacebook(page, post, media) {
  const base = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${page.page_id}`;
  if (media && media.url) {
    const endpoint = media.type === "video" ? `${base}/videos` : `${base}/photos`;
    const bodyParams = media.type === "video"
      ? { file_url: media.url, description: post.content, access_token: page.access_token }
      : { url: media.url, caption: post.content, access_token: page.access_token };
    const res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyParams)
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error?.message || `Facebook API lỗi ${res.status}`);
    return data.post_id || data.id;
  }
  const res = await fetchWithTimeout(`${base}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: post.content, access_token: page.access_token })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || `Facebook API lỗi ${res.status}`);
  return data.id;
}
__name(publishToFacebook, "publishToFacebook");

// Instagram giới hạn caption 2200 k\xFD tự (giới hạn cứng của Meta) — nếu vượt th\xEC BẮT BUỘC b\xE1o
// lỗi để chủ tự sửa ngắn lại trong composer.html, KH\xD4NG tự cắt ngầm nội dung đ\xE3 được duyệt.
var IG_CAPTION_LIMIT = 2200;

async function publishToInstagram(page, post, media) {
  if (!media || !media.url) throw new Error("Instagram bắt buộc phải c\xF3 ảnh/video, b\xE0i n\xE0y chưa c\xF3 media");
  if ((post.content || "").length > IG_CAPTION_LIMIT) {
    throw new Error(`Nội dung d\xE0i ${post.content.length} k\xFD tự, vượt giới hạn ${IG_CAPTION_LIMIT} k\xFD tự của Instagram — v\xE0o composer.html r\xFAt ngắn lại rồi duyệt lại.`);
  }
  const base = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${page.page_id}`;
  const containerParams = media.type === "video"
    ? { media_type: "REELS", video_url: media.url, caption: post.content, access_token: page.access_token }
    : { image_url: media.url, caption: post.content, access_token: page.access_token };
  const containerRes = await fetchWithTimeout(`${base}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(containerParams)
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok || containerData.error) throw new Error(containerData.error?.message || `Instagram tạo media lỗi ${containerRes.status}`);

  const publishRes = await fetchWithTimeout(`${base}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerData.id, access_token: page.access_token })
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok || publishData.error) throw new Error(publishData.error?.message || `Instagram publish lỗi ${publishRes.status}`);
  return publishData.id;
}
__name(publishToInstagram, "publishToInstagram");

// "Claim" target trước khi gọi API thật, để nếu 2 lần cron lỡ chồng nhau (vd 1 lần chạy quá
// 15 phút) thì lần sau sẽ không thấy target này ở status cũ nữa -> tránh đăng trùng lên Facebook.
async function claimTargetForPublishing(env, pbToken, targetId) {
  const checkRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/post_targets/records/${targetId}`, {
    headers: { Authorization: pbToken }
  });
  if (!checkRes.ok) return false;
  const current = await checkRes.json();
  if (current.status !== "approved" && current.status !== "scheduled") return false;
  const claimRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/post_targets/records/${targetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: pbToken },
    body: JSON.stringify({ status: "publishing" })
  });
  return claimRes.ok;
}
__name(claimTargetForPublishing, "claimTargetForPublishing");

async function publishOneTarget(env, pbToken, target) {
  const claimed = await claimTargetForPublishing(env, pbToken, target.id);
  if (!claimed) return;

  // Từ đây trở đi target đang ở status="publishing" — bất kỳ lỗi gì cũng PHẢI rơi vào catch
  // bên dưới để chuyển sang status="error", tránh kẹt vĩnh viễn ở "Đang đăng...".
  try {
    const post = target.expand?.post_id;
    if (!post) throw new Error("Kh\xF4ng t\xECm thấy b\xE0i viết gốc");

    const pageRes = await fetchWithTimeout(
      `${env.PB_URL}/api/collections/pages_config/records?perPage=1&filter=${encodeURIComponent(`tenant='${target.tenant}' && page_id='${target.page_id}' && platform='${target.platform}'`)}`,
      { headers: { Authorization: pbToken } }
    );
    const pageData = await pageRes.json();
    const page = pageData.items?.[0];
    if (!page || !page.access_token) throw new Error("Chưa cấu h\xECnh token cho page n\xE0y (v\xE0o sm-config.html)");

    const mediaRes = await fetchWithTimeout(
      `${env.PB_URL}/api/collections/media/records?perPage=1&sort=order&filter=${encodeURIComponent(`post_id='${post.id}'`)}`,
      { headers: { Authorization: pbToken } }
    );
    const mediaData = await mediaRes.json();
    let media = mediaData.items?.[0];

    if (media && media.url && media.type === "image") {
      const cfgRes = await fetchWithTimeout(
        `${env.PB_URL}/api/collections/bot_configs/records?perPage=1&filter=${encodeURIComponent(`tenant='${target.tenant}'`)}`,
        { headers: { Authorization: pbToken } }
      );
      const cfgData = await cfgRes.json();
      const cfg = cfgData.items?.[0];
      if (cfg) {
        const brandedUrl = await applyBranding(env, pbToken, cfg, media.url);
        if (brandedUrl !== media.url) media = { ...media, url: brandedUrl };
      }
    }

    let publishedId;
    if (target.platform === "facebook") {
      publishedId = await publishToFacebook(page, post, media);
    } else if (target.platform === "instagram") {
      publishedId = await publishToInstagram(page, post, media);
    } else {
      throw new Error(`Chưa hỗ trợ đăng tự động cho platform "${target.platform}"`);
    }
    await fetchWithTimeout(`${env.PB_URL}/api/collections/post_targets/records/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: pbToken },
      body: JSON.stringify({ status: "published", published_post_id: String(publishedId), error_log: "" })
    });
  } catch (err) {
    await markTargetError(env, pbToken, target.id, err.message);
  }
}
__name(publishOneTarget, "publishOneTarget");

// Nếu worker bị Cloudflare ngắt giữa chừng (hết CPU time) ngay sau khi claim, target có thể kẹt
// vĩnh viễn ở status="publishing". Quá 30 phút vẫn còn "publishing" -> coi như treo, đưa về "error"
// để không bị bỏ quên (owner sẽ thấy trong "Lỗi" và có thể duyệt lại).
async function recoverStalePublishing(env, pbToken, tenantFilter) {
  const staleBefore = new Date(Date.now() - 30 * 60 * 1e3).toISOString();
  let filter = `status='publishing' && updated <= '${staleBefore}'`;
  if (tenantFilter) filter += ` && tenant='${escFilterValue(tenantFilter)}'`;
  const res = await fetchWithTimeout(`${env.PB_URL}/api/collections/post_targets/records?perPage=50&filter=${encodeURIComponent(filter)}`, {
    headers: { Authorization: pbToken }
  });
  const data = await res.json();
  for (const target of data.items || []) {
    await markTargetError(env, pbToken, target.id, "Bị treo qu\xE1 30 ph\xFAt ở trạng th\xE1i đang đăng (c\xF3 thể do worker bị ngắt giữa chừng) — kiểm tra lại v\xE0 duyệt lại nếu cần.");
  }
}
__name(recoverStalePublishing, "recoverStalePublishing");

// tenantFilter tuỳ chọn — bỏ trống thì chạy cho TẤT CẢ tenant (dùng bởi cron), truyền vào thì
// chỉ chạy đúng 1 tenant (dùng bởi /api/v1/trigger/publish khi hệ thống ngoài gọi vào).
async function handlePublishDispatch(env, tenantFilter) {
  const pbToken = await getPbToken(env);
  await recoverStalePublishing(env, pbToken, tenantFilter);

  const nowISO = (/* @__PURE__ */ new Date()).toISOString();
  let filter = `(status='approved' || (status='scheduled' && scheduled_at <= '${nowISO}'))`;
  if (tenantFilter) filter = `tenant='${escFilterValue(tenantFilter)}' && ${filter}`;
  const res = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/post_targets/records?perPage=50&filter=${encodeURIComponent(filter)}&expand=post_id`,
    { headers: { Authorization: pbToken } }
  );
  const data = await res.json();
  const targets = data.items || [];

  for (const target of targets) {
    try {
      await publishOneTarget(env, pbToken, target);
    } catch (err) {
      console.error(`[Publish] Lỗi target ${target.id}:`, err);
    }
  }
}
__name(handlePublishDispatch, "handlePublishDispatch");

// ================= [API /api/v1/* CHO HỆ THỐNG NGOÀI GỌI VÀO] =================
// Xác thực bằng API key ri\xEAng của từng tenant (kh\xE1c ADMIN_SECRET d\xF9ng nội bộ ở /run-*),
// lấy trong bot_configs.api_key — tenant tự tạo/copy ở config.html.
async function resolveTenantByApiKey(env, pbToken, apiKey) {
  if (!apiKey) return null;
  const res = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/bot_configs/records?perPage=1&filter=${encodeURIComponent(`api_key='${escFilterValue(apiKey)}'`)}`,
    { headers: { Authorization: pbToken } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0] || null;
}
__name(resolveTenantByApiKey, "resolveTenantByApiKey");

async function handleApiListPosts(request, env, cors, cfg) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const pbToken = await getPbToken(env);
  const postsRes = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/posts/records?perPage=50&sort=-created&filter=${encodeURIComponent(`tenant='${escFilterValue(cfg.tenant)}'`)}&expand=post_targets_via_post_id,media_via_post_id`,
    { headers: { Authorization: pbToken } }
  );
  const postsData = await postsRes.json();
  let items = postsData.items || [];
  if (statusFilter) {
    items = items.filter((p) => (p.expand?.post_targets_via_post_id || []).some((t) => t.status === statusFilter));
  }
  const posts = items.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    created: p.created,
    targets: (p.expand?.post_targets_via_post_id || []).map((t) => ({
      id: t.id, platform: t.platform, status: t.status, scheduled_at: t.scheduled_at,
      error_log: t.error_log, published_post_id: t.published_post_id
    })),
    media: (p.expand?.media_via_post_id || []).map((m) => ({ url: m.url, type: m.type }))
  }));
  return new Response(JSON.stringify({ success: true, posts }), { headers: cors });
}
__name(handleApiListPosts, "handleApiListPosts");

async function handleApiCreatePost(request, env, cors, cfg) {
  const body = await request.json().catch(() => ({}));
  const { title, content, image_prompt, image_url, video_url, platforms, auto_approve } = body;
  if (!title || !content) {
    return new Response(JSON.stringify({ error: "Thiếu title hoặc content" }), { status: 400, headers: cors });
  }
  const pbToken = await getPbToken(env);
  const postRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/posts/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: pbToken },
    body: JSON.stringify({ tenant: cfg.tenant, title, content, image_prompt: image_prompt || "" })
  });
  const post = await postRes.json();
  if (!post.id) {
    return new Response(JSON.stringify({ error: "Tạo b\xE0i viết thất bại", detail: post }), { status: 502, headers: cors });
  }

  if (image_url || video_url) {
    await fetchWithTimeout(`${env.PB_URL}/api/collections/media/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: pbToken },
      body: JSON.stringify({ tenant: cfg.tenant, post_id: post.id, url: image_url || video_url, type: video_url ? "video" : "image", order: 0 })
    });
  }

  const targetPlatforms = Array.isArray(platforms) && platforms.length ? platforms : ["facebook"];
  const pagesRes = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/pages_config/records?perPage=100&filter=${encodeURIComponent(`tenant='${escFilterValue(cfg.tenant)}' && is_active=true`)}`,
    { headers: { Authorization: pbToken } }
  );
  const pagesData = await pagesRes.json();
  const pages = pagesData.items || [];

  const createdTargets = [];
  for (const platform of targetPlatforms) {
    const page = pages.find((p) => p.platform === platform);
    if (!page) continue;
    const targetRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/post_targets/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: pbToken },
      body: JSON.stringify({
        tenant: cfg.tenant, post_id: post.id, platform, page_id: page.page_id,
        status: auto_approve ? "approved" : "pending"
      })
    });
    const target = await targetRes.json();
    if (target.id) createdTargets.push({ id: target.id, platform, status: target.status });
  }

  return new Response(JSON.stringify({ success: true, post_id: post.id, targets: createdTargets }), { headers: cors });
}
__name(handleApiCreatePost, "handleApiCreatePost");

async function handleApiApprovePost(env, cors, cfg, postId) {
  const pbToken = await getPbToken(env);
  const targetsRes = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/post_targets/records?perPage=50&filter=${encodeURIComponent(`tenant='${escFilterValue(cfg.tenant)}' && post_id='${escFilterValue(postId)}' && status='pending'`)}`,
    { headers: { Authorization: pbToken } }
  );
  const targetsData = await targetsRes.json();
  const targets = targetsData.items || [];
  for (const t of targets) {
    await fetchWithTimeout(`${env.PB_URL}/api/collections/post_targets/records/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: pbToken },
      body: JSON.stringify({ status: "approved" })
    });
  }
  return new Response(JSON.stringify({ success: true, approved: targets.length }), { headers: cors });
}
__name(handleApiApprovePost, "handleApiApprovePost");

async function handleApiStatus(env, cors, cfg) {
  const pbToken = await getPbToken(env);
  const qt = (filter) => pbCount(env, pbToken, "post_targets", filter);
  const base = `tenant='${escFilterValue(cfg.tenant)}'`;
  const [pending, approved, scheduled, publishing, published, error] = await Promise.all([
    qt(`${base} && status='pending'`),
    qt(`${base} && status='approved'`),
    qt(`${base} && status='scheduled'`),
    qt(`${base} && status='publishing'`),
    qt(`${base} && status='published'`),
    qt(`${base} && status='error'`)
  ]);
  return new Response(JSON.stringify({ success: true, tenant: cfg.tenant, pending, approved, scheduled, publishing, published, error }), { headers: cors });
}
__name(handleApiStatus, "handleApiStatus");

// Gọi lại đúng handler nội bộ (handleChat/handleEmbed/...) nhưng \xE9p cứng tenant từ API key,
// bỏ qua tenant client tự gửi lên (nếu c\xF3) — tr\xE1nh 1 tenant giả mạo tenant kh\xE1c qua body.
async function callInternalHandlerWithForcedTenant(request, env, cors, tenant, innerHandler) {
  const body = await request.json().catch(() => ({}));
  // KHÔNG copy nguyên request.headers — header Content-Length của request GỐC không khớp với
  // body MỚI (dài hơn do thêm field tenant), khiến request.json() ở innerHandler đọc bị cắt cụt
  // giữa chừng ("Unexpected end of JSON input"). Chỉ giữ lại header thật sự cần, để runtime tự
  // tính Content-Length đúng theo body mới.
  const newHeaders = new Headers({ "Content-Type": "application/json" });
  const ua = request.headers.get("user-agent");
  if (ua) newHeaders.set("user-agent", ua);
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) newHeaders.set("cf-connecting-ip", cfIp);
  const forcedRequest = new Request(request.url, {
    method: "POST",
    headers: newHeaders,
    body: JSON.stringify({ ...body, tenant }),
    cf: request.cf
  });
  return await innerHandler(forcedRequest, env, cors);
}
__name(callInternalHandlerWithForcedTenant, "callInternalHandlerWithForcedTenant");

// ================= [API: CHATBOT] =================
async function handleApiChat(request, env, cors, cfg) {
  return await callInternalHandlerWithForcedTenant(request, env, cors, cfg.tenant, handleChat);
}
__name(handleApiChat, "handleApiChat");

// ================= [API: BOT CONFIG] =================
var CONFIG_READABLE_FIELDS = [
  "bot_name", "bot_avatar", "color", "webhook", "greeting", "system_prompt",
  "model", "temperature", "max_tokens", "streaming", "owner_telegram_chat_id",
  "cloudinary_cloud_name", "brand_logo_url"
];
var CONFIG_WRITABLE_FIELDS = [
  "bot_name", "bot_avatar", "color", "webhook", "greeting", "system_prompt",
  "model", "temperature", "max_tokens", "streaming", "owner_telegram_chat_id",
  "cloudinary_cloud_name", "cloudinary_api_key", "cloudinary_api_secret", "brand_logo_url"
];

async function handleApiGetConfig(env, cors, cfg) {
  const out = { tenant: cfg.tenant };
  for (const f of CONFIG_READABLE_FIELDS) out[f] = cfg[f] ?? null;
  return new Response(JSON.stringify({ success: true, config: out }), { headers: cors });
}
__name(handleApiGetConfig, "handleApiGetConfig");

async function handleApiUpdateConfig(request, env, cors, cfg) {
  const body = await request.json().catch(() => ({}));
  const patch = {};
  for (const f of CONFIG_WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, f)) patch[f] = body[f];
  }
  if (Object.keys(patch).length === 0) {
    return new Response(JSON.stringify({ error: "Kh\xF4ng c\xF3 field n\xE0o hợp lệ để cập nhật" }), { status: 400, headers: cors });
  }
  const pbToken = await getPbToken(env);
  const res = await fetchWithTimeout(`${env.PB_URL}/api/collections/bot_configs/records/${cfg.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: pbToken },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Cập nhật config thất bại" }), { status: 502, headers: cors });
  }
  return new Response(JSON.stringify({ success: true, updated: Object.keys(patch) }), { headers: cors });
}
__name(handleApiUpdateConfig, "handleApiUpdateConfig");

// ================= [API: KNOWLEDGE BASE] =================
async function handleApiListKnowledge(env, cors, cfg) {
  const pbToken = await getPbToken(env);
  const res = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/documents/records?perPage=100&sort=-created&filter=${encodeURIComponent(`tenant='${escFilterValue(cfg.tenant)}'`)}&fields=id,title,char_count,created`,
    { headers: { Authorization: pbToken } }
  );
  const data = await res.json();
  return new Response(JSON.stringify({ success: true, documents: data.items || [] }), { headers: cors });
}
__name(handleApiListKnowledge, "handleApiListKnowledge");

async function handleApiAddKnowledge(request, env, cors, cfg) {
  return await callInternalHandlerWithForcedTenant(request, env, cors, cfg.tenant, handleEmbed);
}
__name(handleApiAddKnowledge, "handleApiAddKnowledge");

async function handleApiDeleteKnowledge(env, cors, cfg, docId) {
  const pbToken = await getPbToken(env);
  const forcedRequest = new Request("https://internal/doc", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id: docId, tenant: cfg.tenant })
  });
  return await handleDelete(forcedRequest, env, cors);
}
__name(handleApiDeleteKnowledge, "handleApiDeleteKnowledge");

async function handleApiSyncKnowledge(env, cors, cfg) {
  const forcedRequest = new Request("https://internal/sync-docs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant: cfg.tenant })
  });
  return await handleSyncDocs(forcedRequest, env, cors);
}
__name(handleApiSyncKnowledge, "handleApiSyncKnowledge");

// ================= [API: CHAT LOGS] =================
async function handleApiListMessages(request, env, cors, cfg) {
  const url = new URL(request.url);
  const session = url.searchParams.get("session");
  let filter = `tenant='${escFilterValue(cfg.tenant)}'`;
  if (session) filter += ` && session='${escFilterValue(session)}'`;
  const pbToken = await getPbToken(env);
  const res = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/messages/records?perPage=100&sort=-created&filter=${encodeURIComponent(filter)}`,
    { headers: { Authorization: pbToken } }
  );
  const data = await res.json();
  const messages = (data.items || []).map((m) => ({
    id: m.id, session: m.session, username: m.username, text: m.text,
    is_bot: m.is_bot, needs_human: m.needs_human || false, created: m.created
  }));
  return new Response(JSON.stringify({ success: true, messages }), { headers: cors });
}
__name(handleApiListMessages, "handleApiListMessages");

async function handleApiV1(request, url, env, cors) {
  const apiKey = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("api_key") || "";
  const pbToken = await getPbToken(env);
  const cfg = await resolveTenantByApiKey(env, pbToken, apiKey);
  if (!cfg) {
    return new Response(JSON.stringify({ error: "API key kh\xF4ng hợp lệ — v\xE0o config.html lấy API key của bạn" }), { status: 401, headers: cors });
  }

  if (url.pathname === "/api/v1/posts" && request.method === "GET") return await handleApiListPosts(request, env, cors, cfg);
  if (url.pathname === "/api/v1/posts" && request.method === "POST") return await handleApiCreatePost(request, env, cors, cfg);

  const approveMatch = url.pathname.match(/^\/api\/v1\/posts\/([^/]+)\/approve$/);
  if (approveMatch && request.method === "POST") return await handleApiApprovePost(env, cors, cfg, approveMatch[1]);

  if (url.pathname === "/api/v1/status" && request.method === "GET") return await handleApiStatus(env, cors, cfg);

  if (url.pathname === "/api/v1/trigger/rss-crawl" && request.method === "POST") {
    await handleRssCrawlAndGenerate(env, cfg.tenant);
    return new Response(JSON.stringify({ success: true }), { headers: cors });
  }
  if (url.pathname === "/api/v1/trigger/publish" && request.method === "POST") {
    await handlePublishDispatch(env, cfg.tenant);
    return new Response(JSON.stringify({ success: true }), { headers: cors });
  }
  if (url.pathname === "/api/v1/trigger/agent" && request.method === "POST") {
    await handleAgentRun(env, cfg.tenant);
    return new Response(JSON.stringify({ success: true }), { headers: cors });
  }

  if (url.pathname === "/api/v1/chat" && request.method === "POST") return await handleApiChat(request, env, cors, cfg);

  if (url.pathname === "/api/v1/config" && request.method === "GET") return await handleApiGetConfig(env, cors, cfg);
  if (url.pathname === "/api/v1/config" && request.method === "PATCH") return await handleApiUpdateConfig(request, env, cors, cfg);

  if (url.pathname === "/api/v1/knowledge" && request.method === "GET") return await handleApiListKnowledge(env, cors, cfg);
  if (url.pathname === "/api/v1/knowledge" && request.method === "POST") return await handleApiAddKnowledge(request, env, cors, cfg);
  if (url.pathname === "/api/v1/knowledge/sync" && request.method === "POST") return await handleApiSyncKnowledge(env, cors, cfg);
  const knowledgeDeleteMatch = url.pathname.match(/^\/api\/v1\/knowledge\/([^/]+)$/);
  if (knowledgeDeleteMatch && request.method === "DELETE") return await handleApiDeleteKnowledge(env, cors, cfg, knowledgeDeleteMatch[1]);

  if (url.pathname === "/api/v1/messages" && request.method === "GET") return await handleApiListMessages(request, env, cors, cfg);

  return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cors });
}
__name(handleApiV1, "handleApiV1");

// ================= [AGENT: LLM tự quyết định gọi tool nào, dựa trên OpenAI function calling] =================
// Nguyên tắc thiết kế: agent CHỈ được trao các tool AN TOÀN/KHẢ NGHỊCH — không tool nào được
// bỏ qua bước người duyệt nội dung. trigger_publish chỉ đăng bài ĐÃ được duyệt sẵn, không tự
// duyệt bài mới. pause_rss_source đảo ngược được (bật lại trong composer.html). Mọi quyết định
// đều log ra console (xem qua `wrangler tail`) để có thể truy vết sau này.
var AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "trigger_publish",
      description: "Đăng ngay các b\xE0i đ\xE3 được người duyệt (status=approved) hoặc tới giờ hẹn. KH\xD4NG tự duyệt nội dung mới — chỉ thực thi c\xE1i người đ\xE3 duyệt sẵn.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "trigger_rss_crawl",
      description: "Crawl lại c\xE1c nguồn RSS đang hoạt động để AI viết b\xE0i n\xE1p mới (vẫn ở trạng th\xE1i chờ duyệt, kh\xF4ng tự đăng).",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "pause_rss_source",
      description: "Tạm dừng 1 nguồn RSS đang liên tục lỗi/kh\xF4ng sinh được b\xE0i mới, tr\xE1nh l\xE3ng ph\xED. C\xF3 thể bật lại tay sau trong composer.html.",
      parameters: {
        type: "object",
        properties: {
          source_id: { type: "string", description: "id của record rss_sources cần tạm dừng" },
          reason: { type: "string", description: "L\xFD do tạm dừng, ngắn gọn" }
        },
        required: ["source_id", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_alert",
      description: "Gửi cảnh b\xE1o khẩn qua Telegram cho chủ khi ph\xE1t hiện bất thường cần người chú \xFD ngay.",
      parameters: {
        type: "object",
        properties: { message: { type: "string", description: "Nội dung cảnh b\xE1o, ngắn gọn, tiếng Việt" } },
        required: ["message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "no_action",
      description: "Kh\xF4ng cần l\xE0m g\xEC — mọi thứ đang b\xECnh thường.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  }
];

async function executeAgentTool(env, pbToken, tenant, name, args) {
  switch (name) {
    case "trigger_publish":
      await handlePublishDispatch(env, tenant);
      return "Đ\xE3 chạy publish dispatch.";
    case "trigger_rss_crawl":
      await handleRssCrawlAndGenerate(env, tenant);
      return "Đ\xE3 chạy RSS crawl.";
    case "pause_rss_source": {
      if (!args.source_id) return "Thiếu source_id, bỏ qua.";
      await fetchWithTimeout(`${env.PB_URL}/api/collections/rss_sources/records/${args.source_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: pbToken },
        body: JSON.stringify({ is_active: false })
      });
      return `Đ\xE3 tạm dừng nguồn ${args.source_id}: ${args.reason || ""}`;
    }
    case "send_alert": {
      const cfgRes = await fetchWithTimeout(
        `${env.PB_URL}/api/collections/bot_configs/records?perPage=1&filter=${encodeURIComponent(`tenant='${escFilterValue(tenant)}'`)}`,
        { headers: { Authorization: pbToken } }
      );
      const cfgData = await cfgRes.json();
      const chatId = cfgData.items?.[0]?.owner_telegram_chat_id;
      if (!chatId) return "Kh\xF4ng c\xF3 owner_telegram_chat_id, bỏ qua cảnh b\xE1o.";
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `\u{1F916} [Agent] ${args.message || ""}`);
      return "Đ\xE3 gửi cảnh b\xE1o Telegram.";
    }
    case "no_action":
      return "Kh\xF4ng h\xE0nh động.";
    default:
      return `Tool kh\xF4ng x\xE1c định: ${name}`;
  }
}
__name(executeAgentTool, "executeAgentTool");

async function getAgentSnapshot(env, pbToken, tenant) {
  const base = `tenant='${escFilterValue(tenant)}'`;
  const [pending, errorCount, needsHumanBacklog] = await Promise.all([
    pbCount(env, pbToken, "post_targets", `${base} && status='pending'`),
    pbCount(env, pbToken, "post_targets", `${base} && status='error'`),
    pbCount(env, pbToken, "messages", `${base} && needs_human=true && escalation_resolved=false`)
  ]);
  const sourcesRes = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/rss_sources/records?perPage=50&filter=${encodeURIComponent(base)}&fields=id,label,is_active`,
    { headers: { Authorization: pbToken } }
  );
  const sourcesData = await sourcesRes.json();
  const errorsRes = await fetchWithTimeout(
    `${env.PB_URL}/api/collections/post_targets/records?perPage=5&sort=-updated&filter=${encodeURIComponent(`${base} && status='error'`)}&fields=platform,error_log`,
    { headers: { Authorization: pbToken } }
  );
  const errorsData = await errorsRes.json();
  return {
    pending,
    errorCount,
    needsHumanBacklog,
    sources: sourcesData.items || [],
    recentErrors: (errorsData.items || []).map((t) => `${t.platform}: ${t.error_log}`)
  };
}
__name(getAgentSnapshot, "getAgentSnapshot");

async function runAgentForTenant(env, pbToken, tenant) {
  const snapshot = await getAgentSnapshot(env, pbToken, tenant);
  console.log(`[Agent] tenant=${tenant} snapshot: pending=${snapshot.pending} error=${snapshot.errorCount} needsHuman=${snapshot.needsHumanBacklog} sources=${snapshot.sources.length}`);
  // Không gọi LLM nếu không có gì bất thường -> tiết kiệm token, giống nguyên tắc của digest.
  if (snapshot.pending === 0 && snapshot.errorCount === 0 && snapshot.needsHumanBacklog === 0) {
    console.log(`[Agent] tenant=${tenant}: kh\xF4ng c\xF3 g\xEC bất thường, bỏ qua (kh\xF4ng gọi LLM).`);
    return;
  }

  const systemPrompt = `Bạn l\xE0 AI agent vận h\xE0nh hệ thống chatbot + đăng b\xE0i social cho 1 tenant. Dựa v\xE0o dữ liệu hiện tại, h\xE3y gọi đ\xFAng tool ph\xF9 hợp (c\xF3 thể gọi nhiều tool, hoặc no_action nếu kh\xF4ng cần l\xE0m g\xEC). KH\xD4NG được tự \xFD duyệt nội dung mới — trigger_publish chỉ thực thi những g\xEC NGƯỜI Đ\xC3 DUYỆT SẴN. Chỉ pause_rss_source khi thấy dấu hiệu r\xF5 r\xE0ng nguồn đ\xF3 đang gặp vấn đề (dựa v\xE0o lỗi gần đ\xE2y). Chỉ send_alert khi thực sự cần người ch\xFA \xFD ngay, kh\xF4ng lạm dụng.`;
  const userMessage = `Trạng th\xE1i hiện tại của tenant "${tenant}":
- B\xE0i đang chờ duyệt: ${snapshot.pending}
- B\xE0i lỗi đăng: ${snapshot.errorCount}
- C\xE2u hỏi AI chưa chắc chắn, chưa xử l\xFD (needs_human): ${snapshot.needsHumanBacklog}
- Nguồn RSS: ${JSON.stringify(snapshot.sources)}
- Lỗi gần đ\xE2y: ${snapshot.recentErrors.join("; ") || "kh\xF4ng c\xF3"}`;

  try {
    const res = await fetchWithTimeout(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        tools: AGENT_TOOLS,
        tool_choice: "auto"
      }),
      timeout: 3e4
    });
    const data = await res.json();
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
    if (toolCalls.length === 0) {
      console.log(`[Agent] tenant=${tenant}: model kh\xF4ng gọi tool n\xE0o (${data.choices?.[0]?.message?.content || ""})`);
      return;
    }
    for (const call of toolCalls) {
      const name = call.function?.name;
      let args = {};
      try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
      const result = await executeAgentTool(env, pbToken, tenant, name, args);
      console.log(`[Agent] tenant=${tenant} tool=${name} args=${JSON.stringify(args)} -> ${result}`);
    }
  } catch (err) {
    console.error(`[Agent] Lỗi chạy agent cho tenant ${tenant}:`, err);
  }
}
__name(runAgentForTenant, "runAgentForTenant");

async function handleAgentRun(env, tenantFilter) {
  const pbToken = await getPbToken(env);
  if (tenantFilter) {
    await runAgentForTenant(env, pbToken, tenantFilter);
    return;
  }
  const configsRes = await fetchWithTimeout(`${env.PB_URL}/api/collections/bot_configs/records?perPage=200&fields=tenant`, {
    headers: { Authorization: pbToken }
  });
  const configsData = await configsRes.json();
  for (const cfg of configsData.items || []) {
    try {
      await runAgentForTenant(env, pbToken, cfg.tenant);
    } catch (err) {
      console.error(`[Agent] Lỗi tenant ${cfg.tenant}:`, err);
    }
  }
}
__name(handleAgentRun, "handleAgentRun");

export {
  index_default as default
};
//# sourceMappingURL=index.js.map
