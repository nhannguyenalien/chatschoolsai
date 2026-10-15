// Tự động trả lời bình luận YouTube. YouTube không có webhook nên Worker hỏi định kỳ (cron 15 phút):
// lấy các luồng bình luận mới nhất của cả kênh, chọn những luồng CHƯA có câu trả lời của chính kênh, rồi trả lời bằng AI Agent.
// Dedupe không cần lưu trạng thái: luồng nào đã có reply của kênh thì bỏ qua.
import { googleApiError } from "./youtube.js";

export const YOUTUBE_COMMENT_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
export const COMMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const COMMENT_QUESTION_LIMIT = 1000;
export const COMMENT_REPLY_LIMIT = 9000; // YouTube cho tối đa 10.000 ký tự; chừa chỗ dự phòng
const URL_RE = /https?:\/\/|www\./i;

async function youtubeJson(fetchImpl, url, init, fallback) {
  const response = await fetchImpl(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = googleApiError(response, data, `${fallback} (HTTP ${response.status})`);
    // 403 insufficientPermissions = token cũ chưa có quyền bình luận -> cần kết nối lại, không phải lỗi tạm thời.
    if (response.status === 403 && /insufficient/i.test(error.googleReason || "") ) error.needsReconnect = true;
    throw error;
  }
  return data;
}

export function listCommentThreads({ accessToken, channelId, fetchImpl, maxResults = 50 }) {
  const params = new URLSearchParams({ part: "snippet,replies", allThreadsRelatedToChannelId: channelId, order: "time", maxResults: String(maxResults), textFormat: "plainText" });
  return youtubeJson(fetchImpl, `https://www.googleapis.com/youtube/v3/commentThreads?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } }, "Không đọc được bình luận YouTube");
}

// Chọn bình luận cần trả lời. `since` (ISO) = thời điểm bật tự trả lời: không trả lời ngược bình luận cũ hơn mốc này.
export function pickCommentsToReply(threads, { channelId, since = "", now = Date.now(), maxAgeMs = COMMENT_MAX_AGE_MS, limit = 3 } = {}) {
  const sinceMs = since ? Date.parse(since) : 0;
  const out = [];
  for (const thread of threads?.items || []) {
    const top = thread.snippet?.topLevelComment;
    const s = top?.snippet;
    if (!top?.id || !s) continue;
    if (thread.snippet?.canReply === false) continue;
    const author = s.authorChannelId?.value || "";
    if (!author || author === channelId) continue; // bình luận của chính kênh
    const text = String(s.textDisplay || s.textOriginal || "").trim();
    if (text.length < 2 || URL_RE.test(text)) continue; // rỗng hoặc có link (thường là spam)
    const published = Date.parse(s.publishedAt || "");
    if (!Number.isFinite(published) || now - published > maxAgeMs || published < sinceMs) continue;
    const replies = thread.replies?.comments || [];
    if (replies.some((reply) => reply.snippet?.authorChannelId?.value === channelId)) continue; // kênh đã trả lời
    if ((thread.snippet?.totalReplyCount || 0) > replies.length) continue; // còn reply chưa tải về: không chắc đã trả lời chưa -> bỏ qua cho an toàn
    out.push({ threadId: thread.id, commentId: top.id, text: text.slice(0, COMMENT_QUESTION_LIMIT), authorId: author, authorName: s.authorDisplayName || "", videoId: s.videoId || thread.snippet?.videoId || "" });
  }
  // Cũ nhất trước để không bỏ sót khi bị giới hạn số câu mỗi lượt.
  return out.reverse().slice(0, limit);
}

export function postCommentReply({ accessToken, parentId, text, fetchImpl }) {
  return youtubeJson(fetchImpl, "https://www.googleapis.com/youtube/v3/comments?part=snippet", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ snippet: { parentId, textOriginal: String(text).slice(0, COMMENT_REPLY_LIMIT) } })
  }, "Không đăng được câu trả lời YouTube");
}
