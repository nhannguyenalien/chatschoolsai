import test from "node:test";
import assert from "node:assert/strict";
import { classifyCampaign, evaluateAccount, mergeThresholds, DEFAULT_THRESHOLDS } from "../src/domain/ads/rules.js";
import { selectAdsModel } from "../src/domain/ads/router.js";
import { encryptJson, decryptJson } from "../src/domain/ads/crypto.js";
import { createMetaAdsIntegration, normalizeAccountId, rowToMetrics } from "../src/integrations/metaAds.js";
import { runAdsReport, plainReport } from "../src/workflows/runAdsReport.js";

const camp = (id, cur, prev = cur) => ({ id, name: `c${id}`, current: cur, previous: prev });
const good = { spend: 100, impressions: 10000, clicks: 300, purchases: 10, revenue: 400, frequency: 1.8 };

test("rules: SCALE khi ROAS tốt và không cờ", () => {
  assert.equal(classifyCampaign(camp(1, good)).label, "SCALE");
});
test("rules: PAUSE khi chi nhiều mà không ra đơn", () => {
  const r = classifyCampaign(camp(2, { ...good, purchases: 0, revenue: 0 }));
  assert.equal(r.label, "PAUSE");
  assert.ok(r.flags.includes("spend_no_conversion"));
});
test("rules: WATCH + creative_fatigue khi frequency cao", () => {
  const r = classifyCampaign(camp(3, { ...good, frequency: 4.2, revenue: 250 }));
  assert.ok(r.flags.includes("creative_fatigue"));
  assert.notEqual(r.label, "SCALE");
});
test("rules: ROAS tụt và CPA tăng được gắn cờ", () => {
  const r = classifyCampaign(camp(4, { ...good, revenue: 250, purchases: 6 }, good));
  assert.ok(r.flags.includes("roas_drop"));
  assert.ok(r.flags.includes("cpa_rise"));
});
test("rules: chi quá ít thì WATCH low_data, không kết luận", () => {
  const r = classifyCampaign(camp(5, { spend: 1, purchases: 0 }));
  assert.deepEqual([r.label, r.flags], ["WATCH", ["low_data"]]);
});
test("rules: anomaly khi >=3 campaign bị cờ", () => {
  const bad = { ...good, frequency: 5 };
  assert.equal(evaluateAccount([camp(1, bad), camp(2, bad), camp(3, bad)]).anomaly, true);
  assert.equal(evaluateAccount([camp(1, good)]).anomaly, false);
});
test("rules: ngưỡng tùy chỉnh bị lọc giá trị lạ", () => {
  const t = mergeThresholds({ max_frequency: 2, roas_scale: "abc", hack: 1, min_spend: -3 });
  assert.equal(t.max_frequency, 2);
  assert.equal(t.roas_scale, DEFAULT_THRESHOLDS.roas_scale);
  assert.equal(t.min_spend, DEFAULT_THRESHOLDS.min_spend);
  assert.equal(t.hack, undefined);
});

test("router: chọn tier theo bất thường, rơi về model chat mặc định", () => {
  assert.deepEqual(selectAdsModel({ OPENAI_CHAT_MODEL: "base" }), { tier: "cheap", model: "base" });
  const env = { ADS_MODEL_CHEAP: "c", ADS_MODEL_STRONG: "s", ADS_MODEL_PREMIUM: "p" };
  assert.equal(selectAdsModel(env, { anomaly: true }).model, "s");
  assert.equal(selectAdsModel(env, { anomaly: true, premium: true }).model, "p");
  assert.equal(selectAdsModel(env, { premium: true }).model, "c");
});

test("crypto: mã hóa rồi giải mã khứ hồi, sai khóa thì lỗi", async () => {
  const blob = await encryptJson("k1", { token: "EAAB" });
  assert.ok(!blob.includes("EAAB"));
  assert.deepEqual(await decryptJson("k1", blob), { token: "EAAB" });
  await assert.rejects(decryptJson("k2", blob));
  await assert.rejects(encryptJson("", {}));
});

test("meta: chuẩn hóa account id", () => {
  assert.equal(normalizeAccountId("act_12345678"), "act_12345678");
  assert.equal(normalizeAccountId("12345678"), "act_12345678");
  assert.throws(() => normalizeAccountId("abc"));
});
test("meta: rowToMetrics đọc purchase và giá trị", () => {
  const m = rowToMetrics({ spend: "10", impressions: "100", clicks: "5", frequency: "1.2", actions: [{ action_type: "omni_purchase", value: "2" }], action_values: [{ action_type: "omni_purchase", value: "40" }] });
  assert.deepEqual([m.spend, m.purchases, m.revenue], [10, 2, 40]);
});
test("meta: fetchCampaigns ghép 2 cửa sổ 7 ngày theo campaign", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    const q = new URL(String(url)).searchParams;
    const since = JSON.parse(q.get("time_range")).since;
    const recent = since === "2026-09-30";
    return { ok: true, json: async () => ({ data: [{ campaign_id: "9", campaign_name: "A", spend: recent ? "50" : "40", impressions: "1000", clicks: "10" }] }) };
  };
  const meta = createMetaAdsIntegration({ fetchImpl });
  const [c] = await meta.fetchCampaigns({ token: "t", accountId: "123456", today: new Date("2026-10-07T00:00:00Z") });
  assert.equal(c.current.spend, 50);
  assert.equal(c.previous.spend, 40);
  assert.ok(urls[0].includes("act_123456/insights"));
});
test("meta: lỗi API được ném ra kèm thông điệp", async () => {
  const meta = createMetaAdsIntegration({ fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid OAuth token", code: 190 } }) }) });
  await assert.rejects(meta.listAccounts("bad"), /Invalid OAuth token/);
});

const conn = { label: "Shop", account_ids: JSON.stringify([{ id: "act_111111", name: "Shop VN", currency: "VND" }]), thresholds_json: "{}" };
const mkDeps = (campaigns, calls) => ({
  meta: { fetchCampaigns: async () => campaigns }, decryptToken: async () => "tok", env: { ADS_MODEL_CHEAP: "c", ADS_MODEL_STRONG: "s" },
  callModel: async (args) => { calls.push(args); return "BÁO CÁO"; },
});
test("report: không có gì đáng chú ý thì KHÔNG gọi model", async () => {
  const calls = [];
  const r = await runAdsReport({ tenant: "t", connections: [conn], deps: mkDeps([camp(1, good)], calls) });
  assert.equal(calls.length, 0);
  assert.equal(r.tier, "none");
  assert.match(r.text, /Shop VN/);
});
test("report: có cờ thì gọi model và payload không chứa token", async () => {
  const calls = [];
  const r = await runAdsReport({ tenant: "t", connections: [conn], deps: mkDeps([camp(1, { ...good, frequency: 5 })], calls) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "c");
  assert.ok(!JSON.stringify(calls[0].data).includes("tok"));
  assert.equal(r.severity, "warning");
});
test("report: bất thường lớn leo thang lên model mạnh", async () => {
  const calls = [];
  const bad = { ...good, frequency: 5 };
  const r = await runAdsReport({ tenant: "t", connections: [conn], deps: mkDeps([camp(1, bad), camp(2, bad), camp(3, bad)], calls) });
  assert.equal(calls[0].model, "s");
  assert.equal(r.severity, "critical");
});
test("report: một account lỗi không làm hỏng cả báo cáo", async () => {
  const deps = { ...mkDeps([], []), meta: { fetchCampaigns: async () => { throw new Error("token hết hạn"); } } };
  const r = await runAdsReport({ tenant: "t", connections: [conn], deps });
  assert.equal(r.severity, "warning");
  assert.match(r.text, /token hết hạn/);
});
test("report: token không giải mã được thì báo kết nối lại", async () => {
  const deps = { ...mkDeps([], []), decryptToken: async () => { throw new Error("x"); } };
  const r = await runAdsReport({ tenant: "t", connections: [conn], deps });
  assert.match(r.text, /kết nối lại/);
});
test("report: không có connection thì bỏ qua", async () => {
  assert.equal((await runAdsReport({ tenant: "t", connections: [], deps: mkDeps([], []) })).skipped, true);
  assert.equal(plainReport([]), "");
});

import { createAdsService } from "../src/workflows/adsService.js";
import { handleAdsRoute } from "../src/api/ads.js";

function memRepo() {
  const rows = []; const reports = [];
  return {
    rows, reports,
    listConnections: async (t) => rows.filter((r) => r.tenant === t),
    getConnection: async (t, id) => rows.find((r) => r.tenant === t && r.id === id) || null,
    createConnection: async (r) => { const rec = { id: `r${rows.length + 1}`, ...r }; rows.push(rec); return rec; },
    deleteConnection: async (id) => rows.splice(rows.findIndex((r) => r.id === id), 1),
    listTenantsWithConnections: async () => [...new Set(rows.map((r) => r.tenant))],
    createReport: async (r) => reports.push(r), listReports: async () => reports,
  };
}
const KEY = "unit-test-key";
const TOKEN = "EAAB-this-is-a-long-enough-token-1234567890";
const mkService = (repo, extra = {}) => createAdsService({
  repository: repo, env: {}, encryptionKey: KEY,
  meta: { listAccounts: async () => [{ id: "act_111111", name: "Shop", currency: "USD" }, { id: "act_222222", name: "Other", currency: "USD" }], fetchCampaigns: async () => [camp(1, good)] },
  callModelFor: () => async () => "x", notify: async (...a) => extra.sent?.push(a), ...extra,
});
const enc = (v) => encryptJson(KEY, v);

test("ads service: lưu token mã hóa, không trả token ra ngoài, lọc theo account_ids", async () => {
  const repo = memRepo();
  const view = await mkService(repo).connect("t1", { label: "Shop", token: TOKEN, accountIds: ["111111"], encrypt: enc });
  assert.deepEqual(view.accounts.map((a) => a.id), ["act_111111"]);
  assert.ok(!JSON.stringify(view).includes(TOKEN));
  assert.ok(!JSON.stringify(repo.rows).includes(TOKEN));
  assert.equal((await decryptJson(KEY, repo.rows[0].token_encrypted)).token, TOKEN);
});
test("ads service: token bị Meta từ chối hoặc quá ngắn thì không lưu", async () => {
  const repo = memRepo();
  const svc = mkService(repo, { meta: { listAccounts: async () => { throw new Error("Invalid OAuth"); } } });
  await assert.rejects(svc.connect("t1", { token: TOKEN, encrypt: enc }), /Meta từ chối/);
  await assert.rejects(svc.connect("t1", { token: "x", encrypt: enc }), /không hợp lệ/);
  assert.equal(repo.rows.length, 0);
});
test("ads service: chạy cho tenant lưu báo cáo và gửi Telegram; tenant khác không bị lẫn", async () => {
  const repo = memRepo(); const sent = [];
  const svc = mkService(repo, { sent });
  await svc.connect("t1", { token: TOKEN, encrypt: enc });
  const r = await svc.runForTenant("t1", { send: true });
  assert.equal(r.tier, "none");
  assert.equal(repo.reports.length, 1);
  assert.equal(sent[0][0], "t1");
  assert.equal((await svc.runForTenant("t2", { send: true })).skipped, true);
  await assert.rejects(svc.remove("t2", "r1"), /Không tìm thấy/);
});
test("ads api: route trả JSON, lỗi nghiệp vụ giữ status, lỗi lạ không lộ chi tiết", async () => {
  const repo = memRepo(); const svc = mkService(repo);
  const call = (method, path, body) => handleAdsRoute({ request: new Request(`https://x${path}`, { method, body: body ? JSON.stringify(body) : undefined }), url: new URL(`https://x${path}`), tenant: "t1", service: svc, encrypt: enc, cors: {} });
  const created = await call("POST", "/api/v1/ads/connections", { token: TOKEN });
  assert.equal(created.status, 201);
  assert.equal((await call("POST", "/api/v1/ads/connections", { token: "x" })).status, 400);
  assert.equal((await (await call("GET", "/api/v1/ads/connections")).json()).connections.length, 1);
  assert.equal((await call("DELETE", "/api/v1/ads/connections/nope")).status, 404);
  const boom = await handleAdsRoute({ request: new Request("https://x/api/v1/ads/connections"), url: new URL("https://x/api/v1/ads/connections"), tenant: "t1", service: { list: async () => { throw new Error("secret db detail"); } }, encrypt: enc, cors: {} });
  assert.equal(boom.status, 500);
  assert.ok(!(await boom.text()).includes("secret"));
  assert.equal(await call("GET", "/api/v1/other"), null);
});
