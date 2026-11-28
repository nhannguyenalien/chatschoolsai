// HTTP cho Kho nội dung. Xác thực (tài khoản, link nhân viên, API key) làm ở index.js rồi truyền vào đây.
import { ContentLibraryError, PLATFORMS } from "../domain/content-library/rules.js";
import {
  actOnTask, addTask, createItem, createStaff, deleteItem, listLibrary, listStaff, removeTask, revokeStaff, staffView, updateItem,
} from "../workflows/contentLibrary.js";

const reply = (cors, data, status = 200) => Response.json(data, { status, headers: { ...cors, "Cache-Control": "no-store" } });

async function readBody(request) {
  const raw = await request.text();
  if (raw.length > 100000) throw new ContentLibraryError("TOO_LARGE", "Dữ liệu gửi lên quá lớn.", 413);
  try {
    const body = JSON.parse(raw || "{}");
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch { /* rơi xuống lỗi chung */ }
  throw new ContentLibraryError("INVALID_JSON", "Dữ liệu không phải JSON hợp lệ.");
}

async function run(cors, work) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ContentLibraryError) return reply(cors, { error: err.message, code: err.code }, err.status);
    console.error("[ContentLibrary]", err);
    return reply(cors, { error: "Kho nội dung tạm thời không truy cập được.", code: "UNAVAILABLE" }, 503);
  }
}

const methodNotFound = (cors) => reply(cors, { error: "Not found", code: "NOT_FOUND" }, 404);

// path: phần sau tiền tố, ví dụ "" | "items/<id>" | "tasks/<id>" | "staff/<id>"
function route(path) {
  const [resource = "", id = "", child = ""] = path.split("/").filter(Boolean);
  return { resource, id, child };
}

export function handleAccountContentLibrary(request, path, cors, { client, tenant, actor }) {
  return run(cors, async () => {
    const { resource, id, child } = route(path);
    const method = request.method;
    if (!resource) {
      if (method === "GET") return reply(cors, { items: await listLibrary(client, tenant), role: actor.role, platforms: PLATFORMS });
      if (method === "POST") return reply(cors, await createItem(client, tenant, await readBody(request), actor), 201);
    }
    if (resource === "items" && id) {
      if (child === "tasks" && method === "POST") return reply(cors, { task: await addTask(client, tenant, id, await readBody(request), actor) }, 201);
      if (!child && method === "PATCH") return reply(cors, { item: await updateItem(client, tenant, id, await readBody(request), actor) });
      if (!child && method === "DELETE") { await deleteItem(client, tenant, id, actor); return reply(cors, { success: true }); }
    }
    if (resource === "tasks" && id && !child) {
      if (method === "POST") return reply(cors, { task: await actOnTask(client, tenant, id, await readBody(request), actor) });
      if (method === "DELETE") { await removeTask(client, tenant, id, actor); return reply(cors, { success: true }); }
    }
    if (resource === "staff" && !child) {
      if (!id && method === "GET") return reply(cors, { staff: await listStaff(client, tenant, actor) });
      if (!id && method === "POST") return reply(cors, await createStaff(client, tenant, await readBody(request), actor), 201);
      if (id && method === "DELETE") { await revokeStaff(client, tenant, id, actor); return reply(cors, { success: true }); }
    }
    return methodNotFound(cors);
  });
}

export function handleStaffContentLibrary(request, path, cors, { client, staff }) {
  return run(cors, async () => {
    const { resource, id, child } = route(path);
    if (!resource && request.method === "GET") {
      return reply(cors, { staff: { name: staff.name, workspace: staff.tenant }, items: await staffView(client, staff) });
    }
    if (resource === "tasks" && id && !child && request.method === "POST") {
      const body = await readBody(request);
      // Nhân viên chỉ được đánh dấu/bỏ đánh dấu; duyệt là quyền của chủ.
      const actor = { role: "staff", name: staff.name, id: `staff:${staff.id}` };
      return reply(cors, { task: await actOnTask(client, staff.tenant, id, body, actor) });
    }
    return methodNotFound(cors);
  });
}

export function handleAgentContentLibrary(request, path, url, cors, { client, tenant }) {
  return run(cors, async () => {
    const { resource, id, child } = route(path);
    // Agent lưu bài và báo link đã đăng, nhưng không tự duyệt được.
    const actor = { role: "agent", name: "agent", id: "agent" };
    if (!resource && request.method === "GET") {
      const status = url.searchParams.get("status") || "";
      let items = await listLibrary(client, tenant);
      if (status) items = items.filter((item) => item.tasks.some((task) => task.status === status));
      return reply(cors, { items: items.slice(0, 100), total: items.length, platforms: PLATFORMS });
    }
    if (!resource && request.method === "POST") {
      const body = await readBody(request);
      const agent = String(body.agent || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 60);
      const result = await createItem(client, tenant, body, { ...actor, name: agent || actor.name });
      return reply(cors, result, result.duplicate ? 200 : 201);
    }
    if (resource === "tasks" && id && !child && request.method === "POST") {
      const body = await readBody(request);
      if (!["done", "undo"].includes(body.action)) throw new ContentLibraryError("INVALID_ACTION", "Agent chỉ dùng action done hoặc undo.");
      return reply(cors, { task: await actOnTask(client, tenant, id, body, actor) });
    }
    return methodNotFound(cors);
  });
}
