// Luật của Kho nội dung: kiểm tra dữ liệu vào và chuyển trạng thái việc đăng. Hàm thuần, không gọi mạng.
//   todo (chờ đăng) -> done (đã đăng, chờ chủ kiểm tra) -> approved (đạt) | redo (làm lại) -> done ...
export const PLATFORMS = [
  "facebook_page", "facebook_group", "instagram", "threads", "linkedin", "pinterest",
  "tiktok", "youtube", "x", "zalo", "website", "other",
];
export const TASK_STATUSES = ["todo", "done", "approved", "redo"];
export const LIMITS = { title: 200, content: 20000, note: 2000, target: 300, url: 1000, media: 10, tasks: 20 };

export class ContentLibraryError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const fail = (code, message, status) => { throw new ContentLibraryError(code, message, status); };
// Bỏ ký tự điều khiển (giữ xuống dòng và tab).
const clean = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();

function limited(value, max, field) {
  const out = clean(value);
  if (out.length > max) fail("TOO_LONG", `${field} tối đa ${max} ký tự.`);
  return out;
}

export function cleanUrl(value, { httpsOnly = false } = {}) {
  const raw = clean(value);
  if (!raw || raw.length > LIMITS.url || /\s/.test(raw)) return "";
  let url;
  try { url = new URL(raw); } catch { return ""; }
  const protocols = httpsOnly ? ["https:"] : ["https:", "http:"];
  if (!protocols.includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password) return "";
  return url.href;
}

export function cleanMedia(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail("INVALID_MEDIA", "media phải là danh sách.");
  if (value.length > LIMITS.media) fail("INVALID_MEDIA", `Tối đa ${LIMITS.media} ảnh/video mỗi nội dung.`);
  return value.map((entry) => {
    const url = cleanUrl(typeof entry === "string" ? entry : entry?.url, { httpsOnly: true });
    if (!url) fail("INVALID_MEDIA", "Mỗi ảnh/video cần một đường dẫn https hợp lệ.");
    const type = entry?.type === "video" || (entry?.type !== "image" && /\.(mp4|webm|mov)(\?|$)/i.test(url)) ? "video" : "image";
    return { url, type };
  });
}

export function cleanTask(entry) {
  const platform = clean(typeof entry === "string" ? entry : entry?.platform).toLowerCase();
  if (!PLATFORMS.includes(platform)) fail("INVALID_PLATFORM", `platform phải là một trong: ${PLATFORMS.join(", ")}.`);
  return { platform, target: limited(entry?.target, LIMITS.target, "target") };
}

function cleanDue(value) {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) fail("INVALID_DATE", "Hạn đăng không hợp lệ.");
  return date.toISOString();
}

// partial=true (sửa): chỉ kiểm tra và trả về field được gửi lên.
export function cleanItem(body, { partial = false } = {}) {
  const out = {};
  const has = (key) => !partial || body?.[key] !== undefined;
  if (has("title")) {
    out.title = limited(body?.title, LIMITS.title, "title");
    if (!out.title) fail("TITLE_REQUIRED", "Cần tiêu đề.");
  }
  if (has("content")) out.content = limited(body?.content, LIMITS.content, "content");
  if (has("note")) out.note = limited(body?.note, LIMITS.note, "note");
  if (has("due_at")) out.due_at = cleanDue(body?.due_at);
  if (has("media")) out.media = cleanMedia(body?.media);
  if (!partial && !out.content && !out.media.length) fail("EMPTY_CONTENT", "Cần nội dung chữ hoặc ít nhất một ảnh/video.");
  return out;
}

export function cleanTasks(list) {
  if (!Array.isArray(list) || !list.length) fail("PLATFORM_REQUIRED", "Chọn ít nhất một nền tảng cần đăng.");
  if (list.length > LIMITS.tasks) fail("TOO_MANY_TASKS", `Tối đa ${LIMITS.tasks} nơi đăng mỗi nội dung.`);
  return list.map(cleanTask);
}

export const canEdit = (actor) => ["owner", "admin", "editor", "agent"].includes(actor.role);
export const canReview = (actor) => ["owner", "admin"].includes(actor.role);
// Người trong workspace được sửa việc của người khác; nhân viên (link) và agent chỉ sửa việc chính mình đã đánh dấu.
const isMember = (actor) => ["owner", "admin", "editor"].includes(actor.role);

// Trả về patch cần ghi vào content_tasks. actor: { role, name, id }
export function taskTransition(task, action, actor, input = {}, now = new Date()) {
  const status = task.status || "todo";
  const at = now.toISOString();

  if (action === "done") {
    if (!canEdit(actor) && actor.role !== "staff") fail("FORBIDDEN", "Bạn chỉ có quyền xem.", 403);
    // Đang "done" thì người đã đánh dấu (hoặc chủ/biên tập) được sửa lại link trước khi chủ duyệt.
    const mine = isMember(actor) || task.done_by_id === actor.id;
    if (!(status === "todo" || status === "redo" || (status === "done" && mine))) {
      fail("INVALID_STATE", "Việc này đã được người khác đánh dấu hoặc đã duyệt.", 409);
    }
    const postUrl = cleanUrl(input.post_url);
    if (!postUrl) fail("URL_REQUIRED", "Dán link bài viết hoặc trang social (bắt đầu bằng https://).");
    return {
      status: "done", post_url: postUrl, staff_note: limited(input.note, LIMITS.note, "note"),
      done_by: actor.name, done_by_id: actor.id, done_at: at, reviewed_by: "", reviewed_at: "",
    };
  }

  if (action === "undo") {
    if (status !== "done") fail("INVALID_STATE", "Chỉ bỏ đánh dấu được khi chủ chưa duyệt.", 409);
    const allowed = isMember(actor) || ((actor.role === "staff" || actor.role === "agent") && task.done_by_id === actor.id);
    if (!allowed) fail("FORBIDDEN", "Bạn không bỏ đánh dấu được việc này.", 403);
    return { status: "todo", post_url: "", staff_note: "", done_by: "", done_by_id: "", done_at: "" };
  }

  if (action === "approve" || action === "redo") {
    if (!canReview(actor)) fail("FORBIDDEN", "Chỉ chủ hoặc quản trị viên được duyệt.", 403);
    const allowed = action === "approve" ? status === "done" : status === "done" || status === "approved";
    if (!allowed) fail("INVALID_STATE", "Việc này chưa ở trạng thái duyệt được.", 409);
    const note = limited(input.note, LIMITS.note, "note");
    if (action === "redo" && !note) fail("NOTE_REQUIRED", "Ghi lý do cần làm lại.");
    return { status: action === "approve" ? "approved" : "redo", review_note: note, reviewed_by: actor.name, reviewed_at: at };
  }

  return fail("INVALID_ACTION", "action phải là done, undo, approve hoặc redo.");
}
