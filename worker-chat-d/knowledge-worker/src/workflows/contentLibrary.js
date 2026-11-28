import { escapePocketBaseFilter as esc } from "../repositories/pocketbase/client.js";
import { ContentLibraryError, LIMITS, canEdit, canReview, cleanItem, cleanTask, cleanTasks, taskTransition } from "../domain/content-library/rules.js";

const ID = /^[A-Za-z0-9]{1,40}$/;
const MAX_PAGES = 10;

const forbidden = () => { throw new ContentLibraryError("FORBIDDEN", "Bạn không có quyền làm việc này.", 403); };
const notFound = () => { throw new ContentLibraryError("NOT_FOUND", "Không tìm thấy.", 404); };

// client: createPocketBaseClient(...) — get/create/update/delete/list.
async function listAll(client, collection, filter, sort = "-created") {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await client.list(collection, { filter, sort, page, perPage: 200 });
    items.push(...(data.items || []));
    if (page >= (data.totalPages || 1)) break;
  }
  return items;
}

// Lấy 1 bản ghi và chắc chắn nó thuộc đúng workspace; sai tenant trả 404 để không lộ id.
async function owned(client, collection, tenant, id) {
  if (!ID.test(id || "")) notFound();
  let record;
  try {
    record = await client.get(collection, id);
  } catch (err) {
    if (err?.status === 404) notFound();
    throw err;
  }
  if (record?.tenant !== tenant) notFound();
  return record;
}

function parseMedia(value) {
  try {
    const list = JSON.parse(value || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function publicTask(task) {
  return {
    id: task.id, item: task.item, platform: task.platform, target: task.target || "", status: task.status || "todo",
    post_url: task.post_url || "", done_by: task.done_by || "", done_at: task.done_at || "", staff_note: task.staff_note || "",
    review_note: task.review_note || "", reviewed_by: task.reviewed_by || "", reviewed_at: task.reviewed_at || "",
  };
}

function publicItem(item, tasks) {
  return {
    id: item.id, title: item.title, content: item.content || "", media: parseMedia(item.media_json),
    note: item.note || "", due_at: item.due_at || "", source: item.source || "", created_by: item.created_by || "",
    external_id: item.external_id || "", created: item.created || "", tasks: tasks.map(publicTask),
  };
}

export async function listLibrary(client, tenant) {
  const filter = `tenant='${esc(tenant)}'`;
  const [items, tasks] = await Promise.all([
    listAll(client, "content_items", filter),
    listAll(client, "content_tasks", filter, "created"),
  ]);
  const byItem = new Map();
  for (const task of tasks) (byItem.get(task.item) || byItem.set(task.item, []).get(task.item)).push(task);
  return items.map((item) => publicItem(item, byItem.get(item.id) || []));
}

const newTask = (tenant, item, task) => ({
  tenant, item, platform: task.platform, target: task.target, status: "todo", post_url: "", done_by: "", done_by_id: "",
  done_at: "", staff_note: "", review_note: "", reviewed_by: "", reviewed_at: "",
});

async function findByExternalId(client, tenant, externalId) {
  const data = await client.list("content_items", { filter: `tenant='${esc(tenant)}' && external_id='${esc(externalId)}'`, perPage: 1 });
  const item = data.items?.[0];
  if (!item) return null;
  const tasks = await listAll(client, "content_tasks", `tenant='${esc(tenant)}' && item='${esc(item.id)}'`, "created");
  return publicItem(item, tasks);
}

// external_id (tuỳ chọn): agent gửi lại cùng một bài thì không tạo bản trùng.
export async function createItem(client, tenant, body, actor) {
  if (!canEdit(actor)) forbidden();
  const externalId = String(body?.external_id || "").trim().slice(0, 200);
  if (externalId) {
    const existing = await findByExternalId(client, tenant, externalId);
    if (existing) return { item: existing, duplicate: true };
  }
  const { media, ...fields } = cleanItem(body);
  const tasks = cleanTasks(body?.platforms);
  let item;
  try {
    item = await client.create("content_items", {
      tenant, ...fields, media_json: JSON.stringify(media), external_id: externalId,
      source: actor.role === "agent" ? "agent" : "manual", created_by: actor.name,
    });
  } catch (err) {
    // Hai request cùng external_id chạy song song: chỉ mục unique chặn bản thứ hai.
    const existing = externalId && err?.status === 400 ? await findByExternalId(client, tenant, externalId) : null;
    if (existing) return { item: existing, duplicate: true };
    throw err;
  }
  const created = [];
  try {
    for (const task of tasks) created.push(await client.create("content_tasks", newTask(tenant, item.id, task)));
  } catch (err) {
    for (const task of created) await client.delete("content_tasks", task.id).catch(() => {});
    await client.delete("content_items", item.id).catch(() => {});
    throw err;
  }
  return { item: publicItem(item, created), duplicate: false };
}

export async function updateItem(client, tenant, id, body, actor) {
  if (!canEdit(actor)) forbidden();
  const item = await owned(client, "content_items", tenant, id);
  const { media, ...fields } = cleanItem(body, { partial: true });
  const patch = { ...fields, ...(media ? { media_json: JSON.stringify(media) } : {}) };
  if (!Object.keys(patch).length) throw new ContentLibraryError("EMPTY_PATCH", "Không có gì để sửa.");
  const merged = { ...item, ...patch };
  if (!merged.content && !parseMedia(merged.media_json).length) throw new ContentLibraryError("EMPTY_CONTENT", "Cần nội dung chữ hoặc ít nhất một ảnh/video.");
  const updated = await client.update("content_items", id, patch);
  const tasks = await listAll(client, "content_tasks", `tenant='${esc(tenant)}' && item='${esc(id)}'`, "created");
  return publicItem(updated, tasks);
}

export async function deleteItem(client, tenant, id, actor) {
  if (!canReview(actor)) forbidden();
  await owned(client, "content_items", tenant, id);
  const tasks = await listAll(client, "content_tasks", `tenant='${esc(tenant)}' && item='${esc(id)}'`, "created");
  for (const task of tasks) await client.delete("content_tasks", task.id);
  await client.delete("content_items", id);
}

export async function addTask(client, tenant, itemId, body, actor) {
  if (!canEdit(actor)) forbidden();
  await owned(client, "content_items", tenant, itemId);
  const task = cleanTask(body);
  const existing = await listAll(client, "content_tasks", `tenant='${esc(tenant)}' && item='${esc(itemId)}'`, "created");
  if (existing.length >= LIMITS.tasks) throw new ContentLibraryError("TOO_MANY_TASKS", `Tối đa ${LIMITS.tasks} nơi đăng mỗi nội dung.`);
  return publicTask(await client.create("content_tasks", newTask(tenant, itemId, task)));
}

export async function removeTask(client, tenant, taskId, actor) {
  if (!canEdit(actor)) forbidden();
  const task = await owned(client, "content_tasks", tenant, taskId);
  // Việc đã đăng là bằng chứng để chủ kiểm tra: chỉ chủ/quản trị được xoá.
  if (task.status !== "todo" && !canReview(actor)) forbidden();
  await client.delete("content_tasks", taskId);
}

export async function actOnTask(client, tenant, taskId, body, actor, now = new Date()) {
  const task = await owned(client, "content_tasks", tenant, taskId);
  const patch = taskTransition(task, String(body?.action || ""), actor, body, now);
  return publicTask(await client.update("content_tasks", taskId, patch));
}

// ===== Link cho nhân viên: không cần tài khoản, chỉ thấy Kho nội dung của 1 workspace =====
export async function hashStaffToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(token)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const publicStaff = (row) => ({ id: row.id, name: row.name, active: Boolean(row.active), last_used_at: row.last_used_at || "", created: row.created || "" });

export async function listStaff(client, tenant, actor) {
  if (!canReview(actor)) forbidden();
  return (await listAll(client, "content_staff", `tenant='${esc(tenant)}'`)).map(publicStaff);
}

// Token chỉ trả về đúng một lần; kho chỉ lưu bản băm.
export async function createStaff(client, tenant, body, actor) {
  if (!canReview(actor)) forbidden();
  const name = String(body?.name || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 60);
  if (!name) throw new ContentLibraryError("NAME_REQUIRED", "Nhập tên nhân viên.");
  const token = randomToken();
  const row = await client.create("content_staff", { tenant, name, token_hash: await hashStaffToken(token), active: true, last_used_at: "" });
  return { staff: publicStaff(row), token };
}

export async function revokeStaff(client, tenant, id, actor) {
  if (!canReview(actor)) forbidden();
  await owned(client, "content_staff", tenant, id);
  await client.delete("content_staff", id);
}

export async function resolveStaff(client, token, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token || "")) return null;
  const data = await client.list("content_staff", { filter: `token_hash='${await hashStaffToken(token)}'`, perPage: 1 });
  const row = data.items?.[0];
  if (!row || !row.active) return null;
  // Ghi "lần dùng gần nhất" tối đa mỗi giờ một lần; lỗi ghi không chặn nhân viên làm việc.
  if (!row.last_used_at || now - new Date(row.last_used_at) > 3600e3) {
    await client.update("content_staff", row.id, { last_used_at: now.toISOString() }).catch(() => {});
  }
  return { id: row.id, name: row.name, tenant: row.tenant };
}

// Nhân viên chỉ thấy việc còn phải làm và việc chính mình đã làm.
export async function staffView(client, staff) {
  const items = await listLibrary(client, staff.tenant);
  const filter = `tenant='${esc(staff.tenant)}' && done_by_id='${esc(`staff:${staff.id}`)}'`;
  const mine = new Set((await listAll(client, "content_tasks", filter)).map((task) => task.id));
  return items
    .map(({ external_id: _externalId, created_by: _createdBy, ...item }) => ({
      ...item,
      tasks: item.tasks
        .filter((task) => task.status === "todo" || task.status === "redo" || mine.has(task.id))
        .map((task) => ({ ...task, mine: mine.has(task.id) })),
    }))
    .filter((item) => item.tasks.length);
}
