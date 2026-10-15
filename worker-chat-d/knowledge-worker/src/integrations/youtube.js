// Kết nối kênh YouTube bằng "Đăng nhập Google" (OAuth) và đăng video qua service uploader trên VPS.
// Worker KHÔNG tự tải video (giới hạn RAM/thời gian): nó đổi refresh_token lấy access_token ngắn hạn rồi
// giao cho uploader (services/youtube-uploader) — uploader chỉ nhận access_token, không bao giờ thấy client_secret.
export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl" // đọc + trả lời bình luận
];
export const YOUTUBE_TITLE_LIMIT = 100;
export const YOUTUBE_DESCRIPTION_LIMIT = 5000;
const PRIVACY = new Set(["private", "unlisted", "public"]);
const STATE_TTL_MS = 10 * 60 * 1000;

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value) {
  return Uint8Array.from(atob(String(value).replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

// state ký HMAC, gắn tenant + người dùng + hạn 10 phút, để callback công khai không bị giả mạo/chuyển tenant.
export async function signYouTubeState(secret, payload, now = Date.now()) {
  if (!secret) throw new Error("Thiếu GOOGLE_OAUTH_STATE_SECRET");
  const encoded = base64url(new TextEncoder().encode(JSON.stringify({ ...payload, purpose: "youtube", exp: now + STATE_TTL_MS })));
  return `${encoded}.${await hmac(secret, encoded)}`;
}

export async function verifyYouTubeState(secret, state, now = Date.now()) {
  const [encoded, signature] = String(state || "").split(".");
  if (!secret || !encoded || !signature || (await hmac(secret, encoded)) !== signature) throw new Error("Phiên đăng nhập Google không hợp lệ, hãy thử lại.");
  const payload = JSON.parse(new TextDecoder().decode(fromBase64url(encoded)));
  if (payload.purpose !== "youtube") throw new Error("Phiên đăng nhập Google không hợp lệ, hãy thử lại.");
  if (!payload.exp || payload.exp < now) throw new Error("Phiên đăng nhập Google đã hết hạn, hãy thử lại.");
  return payload;
}

export function youtubeAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Gắn thông tin lỗi Google vào Error để classifyPublishError (retryPolicy) phân loại đúng:
// invalid_grant -> token hỏng (permanent), 429/quotaExceeded -> thử lại sau, 5xx -> tạm thời.
export function googleApiError(response, data, fallback) {
  const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || (typeof data?.error === "string" ? data.error : "");
  const message = data?.error?.message || data?.error_description || (typeof data?.error === "string" ? data.error : "") || fallback;
  const error = new Error(message);
  error.status = response?.status;
  error.googleReason = reason;
  if (reason === "invalid_grant" || response?.status === 401) error.metaCode = 190;
  else if (/quotaExceeded|rateLimitExceeded|userRateLimitExceeded/.test(reason)) error.status = 429;
  else if (response?.status === 403) error.metaCode = 200;
  return error;
}

async function googleJson(fetchImpl, url, init, fallback) {
  const response = await fetchImpl(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw googleApiError(response, data, `${fallback} (HTTP ${response.status})`);
  return data;
}

const form = (values) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values) });

export function exchangeYouTubeCode({ clientId, clientSecret, redirectUri, code, fetchImpl }) {
  return googleJson(fetchImpl, "https://oauth2.googleapis.com/token",
    form({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }), "Google từ chối mã đăng nhập");
}

export async function refreshYouTubeAccessToken({ clientId, clientSecret, refreshToken, fetchImpl }) {
  const data = await googleJson(fetchImpl, "https://oauth2.googleapis.com/token",
    form({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }), "Không làm mới được token YouTube");
  if (!data.access_token) throw googleApiError({ status: 401 }, { error: "invalid_grant" }, "Google không trả access_token");
  return data.access_token;
}

export async function fetchYouTubeChannel(accessToken, fetchImpl) {
  const data = await googleJson(fetchImpl, "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }, "Không đọc được kênh YouTube");
  const channel = data.items?.[0];
  if (!channel?.id) throw new Error("Tài khoản Google này chưa có kênh YouTube. Hãy tạo kênh trên youtube.com rồi kết nối lại.");
  return { id: channel.id, title: channel.snippet?.title || channel.id };
}

export function parseExtra(page) {
  try { return JSON.parse(page?.extra_config || "{}") || {}; } catch { return {}; }
}

function cleanText(value, limit) {
  // YouTube cấm "<" và ">" trong tiêu đề/mô tả.
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, limit);
}

// Siêu dữ liệu video gửi cho YouTube. Mặc định "public"; khách chọn private/unlisted bằng extra_config.privacy.
// Lưu ý: dự án Google chưa qua kiểm tra API (audit) bị YouTube tự khoá video ở private — xem `privacyNote`.
export const DEFAULT_PRIVACY = "public";
export function buildYouTubeMetadata(page, post) {
  const extra = parseExtra(page);
  const title = cleanText(post?.title, YOUTUBE_TITLE_LIMIT);
  if (!title) throw new Error("Video YouTube cần có tiêu đề.");
  const tags = Array.isArray(extra.tags) ? extra.tags.map((t) => cleanText(t, 60)).filter(Boolean).slice(0, 30) : [];
  return {
    snippet: {
      title,
      description: cleanText(post?.content, YOUTUBE_DESCRIPTION_LIMIT),
      ...(tags.length ? { tags } : {}),
      categoryId: String(extra.category_id || "22")
    },
    status: {
      privacyStatus: PRIVACY.has(extra.privacy) ? extra.privacy : DEFAULT_PRIVACY,
      selfDeclaredMadeForKids: extra.made_for_kids === true
    }
  };
}

// Mỗi tenant tự có Google OAuth client riêng (extra_config.client_id/client_secret) và có thể trỏ uploader riêng
// (uploader_url/uploader_secret); thiếu thì dùng giá trị chung của hệ thống (env) nếu có.
export function youtubeSettings(page, env = {}) {
  const extra = parseExtra(page);
  return {
    clientId: String(extra.client_id || env.YOUTUBE_CLIENT_ID || "").trim(),
    clientSecret: String(extra.client_secret || env.YOUTUBE_CLIENT_SECRET || "").trim(),
    uploaderUrl: String(extra.uploader_url || env.YT_UPLOADER_URL || "").trim(),
    uploaderSecret: String(extra.uploader_secret || env.YT_UPLOADER_SECRET || "").trim()
  };
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Lỗi từ uploader: cùng dạng lỗi Google để retryPolicy phân loại. 401 của CHÍNH uploader (sai secret) không phải token Google hỏng.
function uploaderError(status, data, fallback) {
  const error = googleApiError({ status }, { error: { message: data?.error, errors: [{ reason: data?.reason }] } }, fallback);
  if (data?.source === "uploader" && status === 401) delete error.metaCode;
  return error;
}

// YouTube tự khoá video về private khi dự án Google chưa qua kiểm tra API (audit) — báo rõ cho chủ thay vì để họ tưởng đã công khai.
export function privacyNote(requested, actual) {
  if (!actual || actual === requested) return "";
  return `Video đã lên YouTube nhưng đang ở chế độ "${actual}" thay vì "${requested}". Thường do dự án Google chưa qua kiểm tra API YouTube (API audit) nên YouTube tự khoá video ở chế độ riêng tư; đổi thủ công trong YouTube Studio hoặc hoàn tất bước audit.`;
}

// Đăng video: giao cho uploader trên VPS (chạy nền) rồi hỏi tiến độ tới khi xong, trả về { id, note }.
// Gửi kèm `key` = bài + kênh để uploader không up trùng khi Worker retry.
export async function publishToYouTube({ page, post, mediaItems, env, fetchImpl, sleep = defaultSleep, pollMs = 5000, maxWaitMs = 13 * 60 * 1000 }) {
  const video = (mediaItems || []).find((item) => item?.url && item.type === "video");
  if (!video) throw new Error("YouTube bắt buộc phải có video, bài này chưa có video.");
  const cfg = youtubeSettings(page, env);
  if (!cfg.clientId || !cfg.clientSecret) throw new Error("Kênh YouTube chưa có Client ID/Client Secret — vào sm-config.html bấm Kết nối YouTube để nhập.");
  if (!/^https:\/\//.test(cfg.uploaderUrl) || !cfg.uploaderSecret) throw new Error("Chưa cấu hình service upload YouTube (uploader_url https + uploader_secret).");
  const metadata = buildYouTubeMetadata(page, post);
  const accessToken = await refreshYouTubeAccessToken({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, refreshToken: page.access_token, fetchImpl });
  const base = cfg.uploaderUrl.replace(/\/+$/, "");
  const headers = { Authorization: `Bearer ${cfg.uploaderSecret}`, "content-type": "application/json" };
  const started = await fetchImpl(`${base}/upload`, {
    method: "POST", headers, timeout: 60_000,
    body: JSON.stringify({ video_url: video.url, access_token: accessToken, metadata, key: `${post.id || post.title}:${page.page_id}` })
  });
  const job = await started.json().catch(() => ({}));
  if (started.status !== 202 || !job.job_id) throw uploaderError(started.status, job, `Uploader YouTube lỗi ${started.status}`);

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(pollMs);
    const res = await fetchImpl(`${base}/jobs/${encodeURIComponent(job.job_id)}`, { headers, timeout: 60_000 });
    const state = await res.json().catch(() => ({}));
    if (res.status === 404 && state.reason === "job_lost") throw uploaderError(503, state, "Uploader mất job (có thể vừa khởi động lại)");
    if (!res.ok) throw uploaderError(res.status, state, `Uploader YouTube lỗi ${res.status}`);
    if (state.status === "done" && state.video_id) return { id: state.video_id, note: privacyNote(metadata.status.privacyStatus, state.privacy) };
    if (state.status === "error") throw uploaderError(state.http_status || 502, state, "Upload YouTube thất bại");
  }
  // Chưa biết video đã lên chưa -> lỗi "không rõ" để KHÔNG tự thử lại (tránh đăng trùng), báo chủ kiểm tra.
  throw Object.assign(new Error("Upload YouTube quá lâu chưa xong"), { name: "TimeoutError" });
}

// Thêm "youtube" vào select `platform` của một collection PocketBase. PocketBase <0.23 dùng `schema`, >=0.23 dùng `fields`.
// Trả về patch hoặc null nếu không cần sửa. Chỉ đụng danh sách giá trị, không đụng quy tắc truy cập.
export function youtubePlatformPatch(collection) {
  const key = Array.isArray(collection.fields) ? "fields" : "schema";
  const list = collection[key] || [];
  const field = list.find((f) => f.name === "platform");
  if (!field) throw new Error(`${collection.name}: không có field platform`);
  if (field.type !== "select") return null;
  const current = field.values || field.options?.values || [];
  if (current.includes("youtube")) return null;
  const values = [...current, "youtube"];
  const next = list.map((f) => f !== field ? f : (f.values ? { ...f, values } : { ...f, options: { ...f.options, values } }));
  return { [key]: next };
}
