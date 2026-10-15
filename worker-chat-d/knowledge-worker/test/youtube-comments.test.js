import test from "node:test";
import assert from "node:assert/strict";
import { pickCommentsToReply, listCommentThreads, postCommentReply } from "../src/integrations/youtubeComments.js";

const CH = "UCchannel";
const NOW = Date.parse("2026-10-16T10:00:00Z");
const ago = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const thread = (id, { author = "UCfan1", text = "Does it work with Zalo?", at = ago(30), replies = [], total = replies.length, canReply = true } = {}) => ({
  id, snippet: { canReply, totalReplyCount: total, videoId: "vid1", topLevelComment: { id: `${id}-c`, snippet: { textDisplay: text, publishedAt: at, authorChannelId: { value: author }, authorDisplayName: "Fan", videoId: "vid1" } } },
  replies: { comments: replies.map((a) => ({ snippet: { authorChannelId: { value: a } } })) }
});
const pick = (items, extra = {}) => pickCommentsToReply({ items }, { channelId: CH, now: NOW, since: ago(600), ...extra });

test("replies to fresh fan comments that the channel has not answered", () => {
  const out = pick([thread("t1")]);
  assert.deepEqual(out.map((c) => [c.threadId, c.commentId, c.text, c.authorId, c.videoId]), [["t1", "t1-c", "Does it work with Zalo?", "UCfan1", "vid1"]]);
});

test("never replies to the channel's own comments or to threads the channel already answered", () => {
  assert.equal(pick([thread("own", { author: CH })]).length, 0);
  assert.equal(pick([thread("done", { replies: [CH], total: 1 })]).length, 0);
  assert.equal(pick([thread("other-replied", { replies: ["UCfan2"], total: 1 })]).length, 1, "a reply from another fan does not count");
});

test("skips when it cannot be sure (replies not fully loaded), spam links, empty text and replies disabled", () => {
  assert.equal(pick([thread("partial", { replies: ["UCfan2"], total: 4 })]).length, 0);
  assert.equal(pick([thread("spam", { text: "free money https://scam.example" })]).length, 0);
  assert.equal(pick([thread("www", { text: "visit www.scam.example now" })]).length, 0);
  assert.equal(pick([thread("empty", { text: " " })]).length, 0);
  assert.equal(pick([thread("locked", { canReply: false })]).length, 0);
});

test("never answers backwards: older than the enable time or older than 24h are ignored", () => {
  assert.equal(pick([thread("before", { at: ago(700) })], { since: ago(600) }).length, 0);
  assert.equal(pick([thread("stale", { at: ago(25 * 60) })], { since: ago(60 * 48) }).length, 0);
  assert.equal(pick([thread("ok", { at: ago(10) })], { since: ago(60) }).length, 1);
});

test("processes oldest first and respects the per-run limit", () => {
  const items = [thread("new", { at: ago(5) }), thread("mid", { at: ago(20) }), thread("old", { at: ago(40) })]; // API trả mới nhất trước
  assert.deepEqual(pick(items, { limit: 2 }).map((c) => c.threadId), ["old", "mid"]);
});

test("calls the YouTube comment APIs with the right shape", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => { calls.push({ url: String(url), init }); return Response.json({ items: [], id: "r1" }); };
  await listCommentThreads({ accessToken: "at", channelId: CH, fetchImpl });
  const list = new URL(calls[0].url);
  assert.equal(list.pathname, "/youtube/v3/commentThreads");
  assert.equal(list.searchParams.get("allThreadsRelatedToChannelId"), CH);
  assert.equal(list.searchParams.get("order"), "time");
  assert.equal(calls[0].init.headers.Authorization, "Bearer at");
  await postCommentReply({ accessToken: "at", parentId: "t1", text: "Thanks! 🙏", fetchImpl });
  assert.equal(calls[1].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].init.body), { snippet: { parentId: "t1", textOriginal: "Thanks! 🙏" } });
  await postCommentReply({ accessToken: "at", parentId: "t1", text: "x".repeat(20000), fetchImpl });
  assert.equal(JSON.parse(calls[2].init.body).snippet.textOriginal.length, 9000);
});

test("flags a token without comment permission so the owner can reconnect", async () => {
  const fetchImpl = async () => Response.json({ error: { message: "Insufficient Permission", errors: [{ reason: "insufficientPermissions" }] } }, { status: 403 });
  await assert.rejects(() => listCommentThreads({ accessToken: "old", channelId: CH, fetchImpl }), (e) => e.needsReconnect === true);
  const quota = async () => Response.json({ error: { message: "quota", errors: [{ reason: "quotaExceeded" }] } }, { status: 403 });
  await assert.rejects(() => postCommentReply({ accessToken: "a", parentId: "t", text: "x", fetchImpl: quota }), (e) => e.status === 429 && !e.needsReconnect);
});

// ===== Luồng đầy đủ của cron: PocketBase giả + Google giả + AI giả =====
const { replyToYouTubeComments, handleYouTubeCommentReplies } = await import("../src/index.js");

function installWorld({ threads, commentsStatus = 200, since = ago(120) } = {}) {
  const writes = { patches: [], inserts: [], telegram: [], asked: [] };
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    if (url.includes("/system_config/records")) return Response.json({ items: [] });
    if (url.includes("auth-with-password")) return Response.json({ token: "pb-admin" });
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "at-1" });
    if (url.startsWith("https://www.googleapis.com/youtube/v3/commentThreads")) {
      return commentsStatus === 200 ? Response.json(threads) : Response.json({ error: { message: "Insufficient Permission", errors: [{ reason: "insufficientPermissions" }] } }, { status: commentsStatus });
    }
    if (url.startsWith("https://www.googleapis.com/youtube/v3/comments")) { writes.inserts.push(JSON.parse(init.body)); return Response.json({ id: `reply${writes.inserts.length}` }); }
    if (url.includes("/pages_config/records/") && method === "PATCH") { writes.patches.push(JSON.parse(JSON.parse(init.body).extra_config)); return Response.json({}); }
    if (url.includes("/pages_config/records")) return Response.json({ items: [pageRecord(since)] });
    if (url.includes("/bot_configs/records")) return Response.json({ items: [{ owner_telegram_chat_id: "123" }] });
    if (url.includes("api.telegram.org")) { writes.telegram.push(JSON.parse(init.body).text); return Response.json({ ok: true }); }
    throw new Error(`unexpected fetch ${method} ${url}`);
  };
  return { writes, restore: () => { globalThis.fetch = original; } };
}
const pageRecord = (since) => ({ id: "pg1", tenant: "acme", platform: "youtube", page_id: CH, label: "YouTube Nhanai", is_active: true, access_token: "rt-1",
  extra_config: JSON.stringify({ client_id: "cid.apps.googleusercontent.com", client_secret: "cs", ...(since ? { auto_reply_since: since } : {}) }) });
const envBase = { PB_URL: "https://pb.test", PB_ADMIN_EMAIL: "a", PB_ADMIN_PASS: "b", TELEGRAM_BOT_TOKEN: "tg" };

test("cron: answers new comments through the AI agent and posts the replies on YouTube, no approval step", async () => {
  const world = installWorld({ threads: { items: [thread("done", { replies: [CH], total: 1, at: ago(3) }), thread("t2", { text: "Great video!", at: ago(5) }), thread("t1", { text: "Can I use this for my hotel?", at: ago(10) })] } });
  try {
    const asked = [];
    const askAgent = async (request) => { const body = await request.json(); asked.push(body); return Response.json({ reply: `**Yes!** [Docs](https://chat.schoolsai.work) for: ${body.question}` }); };
    const count = await replyToYouTubeComments(envBase, "pb-admin", pageRecord(ago(120)), 3, { askAgent });
    assert.equal(count, 2);
    assert.deepEqual(asked.map((b) => b.question), ["Can I use this for my hotel?", "Great video!"]); // API trả mới nhất trước; bot trả lời cũ nhất trước
    assert.equal(asked[0].session, "youtube:comment:UCfan1");
    assert.equal(asked[0].client_meta.platform, "youtube");
    assert.equal(asked[0].tenant, "acme");
    assert.deepEqual(world.writes.inserts.map((b) => b.snippet.parentId), ["t1", "t2"]);
    assert.match(world.writes.inserts[0].snippet.textOriginal, /^Yes! Docs: https:\/\/chat\.schoolsai\.work for:/, "markdown is flattened to plain text");
  } finally { world.restore(); }
});

test("cron: first run on a channel connected before this feature only records the start time (no back-replies)", async () => {
  const world = installWorld({ threads: { items: [thread("t1", { at: ago(10) })] } });
  try {
    const count = await replyToYouTubeComments(envBase, "pb-admin", pageRecord(""), 3, { askAgent: async () => { throw new Error("must not ask"); } });
    assert.equal(count, 0);
    assert.equal(world.writes.patches.length, 1);
    assert.ok(Date.parse(world.writes.patches[0].auto_reply_since) > Date.now() - 5000);
    assert.equal(world.writes.inserts.length, 0);
  } finally { world.restore(); }
});

test("cron: auto_reply=false turns the bot off for a channel", async () => {
  const world = installWorld({ threads: { items: [thread("t1")] } });
  try {
    const page = pageRecord(ago(120));
    page.extra_config = JSON.stringify({ ...JSON.parse(page.extra_config), auto_reply: false });
    assert.equal(await replyToYouTubeComments(envBase, "pb-admin", page, 3, { askAgent: async () => { throw new Error("must not ask"); } }), 0);
    assert.equal(world.writes.inserts.length, 0);
  } finally { world.restore(); }
});

test("cron: an old token without comment permission asks the owner to reconnect once", async () => {
  const world = installWorld({ threads: { items: [] }, commentsStatus: 403 });
  try {
    assert.equal(await replyToYouTubeComments(envBase, "pb-admin", pageRecord(ago(120)), 3, {}), 0);
    assert.equal(world.writes.patches[0].comment_reply_status, "needs_reconnect");
    assert.match(world.writes.telegram[0], /kết nối lại/);
    // đã đánh dấu rồi thì không nhắn lại
    const page = pageRecord(ago(120));
    page.extra_config = JSON.stringify({ ...JSON.parse(page.extra_config), comment_reply_status: "needs_reconnect" });
    await replyToYouTubeComments(envBase, "pb-admin", page, 3, {});
    assert.equal(world.writes.telegram.length, 1);
  } finally { world.restore(); }
});

test("cron: an AI failure posts nothing (the comment is retried on the next run)", async () => {
  const world = installWorld({ threads: { items: [thread("t1", { at: ago(10) })] } });
  try {
    assert.equal(await replyToYouTubeComments(envBase, "pb-admin", pageRecord(ago(120)), 3, { askAgent: async () => { throw new Error("AI down"); } }), 0);
    assert.equal(world.writes.inserts.length, 0);
    assert.equal(await replyToYouTubeComments(envBase, "pb-admin", pageRecord(ago(120)), 3, { askAgent: async () => Response.json({ reply: "  " }) }), 0);
  } finally { world.restore(); }
});

test("cron: handleYouTubeCommentReplies walks all active YouTube channels", async () => {
  const world = installWorld({ threads: { items: [thread("t1", { at: ago(10) })] } });
  const original = console.error;
  console.error = () => {}; // handleChat thật không có cấu hình -> lỗi được nuốt, không đăng gì
  try {
    assert.equal(await handleYouTubeCommentReplies(envBase), 0);
  } finally { console.error = original; world.restore(); }
});
