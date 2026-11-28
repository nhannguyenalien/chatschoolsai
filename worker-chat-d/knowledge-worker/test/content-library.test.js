import test from "node:test";
import assert from "node:assert/strict";
import { cleanItem, cleanUrl, taskTransition } from "../src/domain/content-library/rules.js";
import { handleAccountContentLibrary, handleAgentContentLibrary, handleStaffContentLibrary } from "../src/api/contentLibrary.js";
import { hashStaffToken, resolveStaff } from "../src/workflows/contentLibrary.js";
import { createMemoryClient } from "./helpers/memoryPocketBase.js";

const owner = { role: "owner", id: "account:o1", name: "Chủ" };
const editor = { role: "editor", id: "account:e1", name: "Biên tập" };
const viewer = { role: "viewer", id: "account:v1", name: "Xem" };
const call = (method, body) => new Request("https://x.test/", { method, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
const account = (client, actor, method, path, body, tenant = "shop") => handleAccountContentLibrary(call(method, body), path, {}, { client, tenant, actor });
const staffCall = (client, staff, method, path, body) => handleStaffContentLibrary(call(method, body), path, {}, { client, staff });
const agent = (client, method, path, body, query = "", tenant = "shop") => handleAgentContentLibrary(call(method, body), path, new URL(`https://x.test/${query}`), {}, { client, tenant });
const draft = { title: "Bài 1", content: "Nội dung", platforms: [{ platform: "facebook_group", target: "Hội cafe" }, "threads"] };

async function seeded() {
  const client = createMemoryClient();
  const res = await agent(client, "POST", "", { ...draft, agent: "writer", external_id: "run-1" });
  assert.equal(res.status, 201);
  const { item } = await res.json();
  const made = await (await account(client, owner, "POST", "staff", { name: "Lan" })).json();
  const staff = await resolveStaff(client, made.token);
  return { client, item, staff, token: made.token, staffId: made.staff.id };
}

test("agent saves content once per external_id and tasks start as todo", async () => {
  const { client, item } = await seeded();
  assert.equal(item.source, "agent");
  assert.equal(item.created_by, "writer");
  assert.deepEqual(item.tasks.map((t) => [t.platform, t.status]), [["facebook_group", "todo"], ["threads", "todo"]]);
  const again = await agent(client, "POST", "", { ...draft, external_id: "run-1" });
  assert.equal(again.status, 200);
  assert.equal((await again.json()).duplicate, true);
  assert.equal(client.rows("content_items").length, 1);
  assert.equal(client.rows("content_tasks").length, 2);
});

test("staff ticks done with a link, owner sends back, staff redoes, owner approves", async () => {
  const { client, item, staff } = await seeded();
  const id = item.tasks[0].id;
  const noLink = await staffCall(client, staff, "POST", `tasks/${id}`, { action: "done" });
  assert.equal(noLink.status, 400);
  assert.equal((await noLink.json()).code, "URL_REQUIRED");
  let task = (await (await staffCall(client, staff, "POST", `tasks/${id}`, { action: "done", post_url: "https://facebook.com/groups/1/posts/2", note: "chờ admin duyệt" })).json()).task;
  assert.equal(task.status, "done");
  assert.equal(task.done_by, "Lan");

  assert.equal((await account(client, owner, "POST", `tasks/${id}`, { action: "redo" })).status, 400, "redo needs a reason");
  assert.equal((await account(client, owner, "POST", `tasks/${id}`, { action: "redo", note: "Link sai" })).status, 200);
  let view = await (await staffCall(client, staff, "GET", "")).json();
  assert.equal(view.items[0].tasks.find((t) => t.id === id).review_note, "Link sai");

  await staffCall(client, staff, "POST", `tasks/${id}`, { action: "done", post_url: "https://facebook.com/groups/1/posts/3" });
  task = (await (await account(client, owner, "POST", `tasks/${id}`, { action: "approve" })).json()).task;
  assert.equal(task.status, "approved");
  assert.equal(task.reviewed_by, "Chủ");
  assert.equal((await staffCall(client, staff, "POST", `tasks/${id}`, { action: "undo" })).status, 409);
  assert.equal((await staffCall(client, staff, "POST", `tasks/${id}`, { action: "done", post_url: "https://evil.test/x" })).status, 409);
  view = await (await staffCall(client, staff, "GET", "")).json();
  assert.ok(view.items[0].tasks.find((t) => t.id === id).mine, "own approved work stays visible");
});

test("staff and agent can never approve; editors and viewers cannot review", async () => {
  const { client, item, staff } = await seeded();
  const id = item.tasks[0].id;
  await staffCall(client, staff, "POST", `tasks/${id}`, { action: "done", post_url: "https://threads.net/@a/post/1" });
  assert.equal((await staffCall(client, staff, "POST", `tasks/${id}`, { action: "approve" })).status, 403);
  assert.equal((await agent(client, "POST", `tasks/${id}`, { action: "approve" })).status, 400);
  assert.equal((await account(client, editor, "POST", `tasks/${id}`, { action: "approve" })).status, 403);
  assert.equal((await account(client, viewer, "POST", `tasks/${id}`, { action: "undo" })).status, 403);
  assert.equal((await account(client, viewer, "POST", "", draft)).status, 403);
  assert.equal((await account(client, editor, "DELETE", `items/${item.id}`)).status, 403);
  assert.equal((await account(client, editor, "GET", "staff")).status, 403);
  assert.equal(client.rows("content_tasks").find((t) => t.id === id).status, "done");
});

test("one staff member or the agent cannot overwrite or undo another person's proof", async () => {
  const { client, item, staff } = await seeded();
  const id = item.tasks[0].id;
  await staffCall(client, staff, "POST", `tasks/${id}`, { action: "done", post_url: "https://threads.net/@a/post/1" });
  const other = { id: "other", name: "Minh", tenant: "shop" };
  assert.equal((await staffCall(client, other, "POST", `tasks/${id}`, { action: "done", post_url: "https://threads.net/@b/post/2" })).status, 409);
  assert.equal((await staffCall(client, other, "POST", `tasks/${id}`, { action: "undo" })).status, 403);
  assert.equal((await agent(client, "POST", `tasks/${id}`, { action: "undo" })).status, 403);
  assert.equal((await (await staffCall(client, other, "GET", "")).json()).items[0].tasks.length, 1, "others' finished work is hidden");
  assert.equal((await staffCall(client, staff, "POST", `tasks/${id}`, { action: "undo" })).status, 200);
});

test("another workspace cannot read or change anything", async () => {
  const { client, item, staffId } = await seeded();
  const id = item.tasks[0].id;
  assert.deepEqual((await (await account(client, owner, "GET", "", undefined, "other")).json()).items, []);
  for (const [method, path, body] of [["POST", `tasks/${id}`, { action: "done", post_url: "https://a.test/1" }], ["DELETE", `items/${item.id}`], ["PATCH", `items/${item.id}`, { title: "x" }], ["DELETE", `staff/${staffId}`], ["DELETE", `tasks/${id}`]]) {
    assert.equal((await account(client, owner, method, path, body, "other")).status, 404, `${method} ${path}`);
  }
  assert.equal((await agent(client, "POST", `tasks/${id}`, { action: "done", post_url: "https://a.test/1" }, "", "other")).status, 404);
  assert.equal((await staffCall(client, { id: "z", name: "Z", tenant: "other" }, "POST", `tasks/${id}`, { action: "done", post_url: "https://a.test/1" })).status, 404);
});

test("staff links are stored hashed, shown once and stop working when revoked", async () => {
  const { client, token, staffId } = await seeded();
  const row = client.rows("content_staff")[0];
  assert.equal(row.token_hash, await hashStaffToken(token));
  assert.ok(!JSON.stringify(row).includes(token));
  const listed = JSON.stringify(await (await account(client, owner, "GET", "staff")).json());
  assert.ok(!listed.includes(token) && !listed.includes(row.token_hash));
  assert.equal(await resolveStaff(client, "x".repeat(43)), null);
  assert.equal(await resolveStaff(client, "' || id!='"), null);
  assert.equal((await account(client, owner, "DELETE", `staff/${staffId}`)).status, 200);
  assert.equal(await resolveStaff(client, token), null);
});

test("owner edits, adds a platform and deletes; finished tasks cannot be removed by an editor", async () => {
  const { client, item, staff } = await seeded();
  const edited = (await (await account(client, editor, "PATCH", `items/${item.id}`, { title: "Mới" })).json()).item;
  assert.equal(edited.title, "Mới");
  assert.equal(edited.content, "Nội dung");
  assert.equal((await account(client, owner, "PATCH", `items/${item.id}`, { content: "" })).status, 400);
  assert.equal((await account(client, editor, "POST", `items/${item.id}/tasks`, { platform: "pinterest" })).status, 201);
  await staffCall(client, staff, "POST", `tasks/${item.tasks[0].id}`, { action: "done", post_url: "https://a.test/1" });
  assert.equal((await account(client, editor, "DELETE", `tasks/${item.tasks[0].id}`)).status, 403);
  assert.equal((await account(client, editor, "DELETE", `tasks/${item.tasks[1].id}`)).status, 200);
  assert.equal((await account(client, owner, "DELETE", `items/${item.id}`)).status, 200);
  assert.equal(client.rows("content_items").length + client.rows("content_tasks").length, 0);
});

test("agent filters by status and reads the links staff submitted", async () => {
  const { client, item, staff } = await seeded();
  await agent(client, "POST", "", { title: "Bài 2", media: [{ url: "https://cdn.test/a.mp4" }], platforms: ["tiktok"] });
  await staffCall(client, staff, "POST", `tasks/${item.tasks[0].id}`, { action: "done", post_url: "https://a.test/1" });
  const done = await (await agent(client, "GET", "", undefined, "?status=done")).json();
  assert.equal(done.items.length, 1);
  assert.equal(done.items[0].tasks[0].post_url, "https://a.test/1");
  assert.equal((await (await agent(client, "GET", "")).json()).items.find((i) => i.title === "Bài 2").media[0].type, "video");
});

test("bad input is refused and nothing is stored", async () => {
  const client = createMemoryClient();
  for (const [patch, code] of [
    [{ title: "" }, "TITLE_REQUIRED"], [{ content: "" }, "EMPTY_CONTENT"], [{ platforms: [] }, "PLATFORM_REQUIRED"],
    [{ platforms: ["myspace"] }, "INVALID_PLATFORM"], [{ media: [{ url: "javascript:alert(1)" }] }, "INVALID_MEDIA"],
    [{ media: [{ url: "http://insecure.test/a.png" }] }, "INVALID_MEDIA"], [{ content: "a".repeat(20001) }, "TOO_LONG"], [{ due_at: "mai" }, "INVALID_DATE"],
  ]) {
    const res = await agent(client, "POST", "", { ...draft, ...patch });
    assert.equal(res.status, 400, code);
    assert.equal((await res.json()).code, code);
  }
  assert.equal((await agent(client, "POST", "", "not json")).status, 400);
  assert.equal(client.rows("content_items").length + client.rows("content_tasks").length, 0);
});

test("only real web links are accepted as proof", () => {
  assert.equal(cleanUrl("https://www.pinterest.com/pin/1/"), "https://www.pinterest.com/pin/1/");
  for (const bad of ["", "javascript:alert(1)", "data:text/html,x", "facebook.com/post", "https://localhost", "https://a:b@facebook.com", "https://face book.com"]) {
    assert.equal(cleanUrl(bad), "", bad);
  }
  assert.throws(() => taskTransition({ status: "todo" }, "approve", owner), /duyệt/);
  assert.deepEqual(cleanItem({ title: " a ", content: "b\u0000c" }).content, "bc");
});

test("a partly failed create leaves nothing behind", async () => {
  const client = createMemoryClient({ failCreate: (collection, count) => collection === "content_tasks" && count === 2 });
  const res = await agent(client, "POST", "", draft);
  assert.equal(res.status, 503);
  assert.equal(client.rows("content_items").length + client.rows("content_tasks").length, 0);
});
