import { runAdsReport } from "./runAdsReport.js";
import { decryptJson } from "../domain/ads/crypto.js";

const MAX_CONNECTIONS_PER_TENANT = 5;
const MAX_ACCOUNTS_PER_CONNECTION = 20;

export function createAdsService({ repository, meta, encryptionKey, callModelFor, notify, env, now = () => new Date() }) {
  const decryptToken = async (connection) => (await decryptJson(encryptionKey, connection.token_encrypted)).token;

  const publicView = (c) => ({
    id: c.id, label: c.label, is_active: c.is_active !== false, last_error: c.last_error || "",
    accounts: safeJson(c.account_ids, []), thresholds: safeJson(c.thresholds_json, {}),
  });

  return {
    publicView,
    async list(tenant) { return (await repository.listConnections(tenant)).map(publicView); },

    // Khách dán token. Token được kiểm tra với Meta, chỉ lưu bản mã hóa, không bao giờ trả lại client.
    async connect(tenant, { label, token, accountIds, thresholds, encrypt }) {
      const clean = String(token || "").trim();
      if (clean.length < 20) throw httpError(400, "Token không hợp lệ.");
      const existing = await repository.listConnections(tenant);
      if (existing.length >= MAX_CONNECTIONS_PER_TENANT) throw httpError(400, `Tối đa ${MAX_CONNECTIONS_PER_TENANT} token cho mỗi workspace.`);
      let accounts;
      try { accounts = await meta.listAccounts(clean); } catch (err) { throw httpError(400, `Meta từ chối token: ${err.message}`); }
      if (Array.isArray(accountIds) && accountIds.length) {
        const wanted = new Set(accountIds.map((x) => `act_${String(x).replace(/^act_/i, "")}`));
        accounts = accounts.filter((a) => wanted.has(a.id));
      }
      accounts = accounts.slice(0, MAX_ACCOUNTS_PER_CONNECTION);
      if (!accounts.length) throw httpError(400, "Token không truy cập được ad account nào (cần quyền ads_read).");
      const record = await repository.createConnection({
        tenant, label: String(label || "Meta Ads").slice(0, 60), provider: "meta", token_encrypted: await encrypt({ token: clean }),
        account_ids: JSON.stringify(accounts), thresholds_json: JSON.stringify(thresholds || {}), is_active: true, last_error: "",
      });
      return publicView(record);
    },

    async reports(tenant) { return repository.listReports(tenant, 10); },

    async remove(tenant, id) {
      const connection = await repository.getConnection(tenant, id);
      if (!connection) throw httpError(404, "Không tìm thấy kết nối.");
      await repository.deleteConnection(id);
    },

    // Chạy báo cáo cho 1 tenant: lưu lịch sử và (tuỳ chọn) gửi Telegram.
    async runForTenant(tenant, { send = false, premium = false } = {}) {
      const connections = (await repository.listConnections(tenant)).filter((c) => c.is_active !== false);
      const result = await runAdsReport({
        tenant, connections,
        deps: { meta, decryptToken, env, premium, today: now(), callModel: callModelFor(tenant) },
      });
      if (result.skipped) return result;
      await repository.createReport({
        tenant, severity: result.severity, summary: String(result.text).slice(0, 8000), model: result.model || "", tier: result.tier,
      });
      if (send) await notify(tenant, `📈 Báo cáo quảng cáo Meta\n\n${result.text}`);
      return result;
    },

    // Cron: lần lượt từng tenant, một tenant lỗi không chặn các tenant khác.
    async runAll({ limit = 20 } = {}) {
      const tenants = (await repository.listTenantsWithConnections()).slice(0, limit);
      const out = [];
      for (const tenant of tenants) {
        try {
          const r = await this.runForTenant(tenant, { send: true });
          out.push({ tenant, severity: r.severity, tier: r.tier });
        } catch (err) {
          console.error(`[Ads] Lỗi tenant ${tenant}:`, err?.message || err);
          out.push({ tenant, error: String(err?.message || err) });
        }
      }
      return out;
    },
  };
}

function safeJson(value, fallback) { try { return JSON.parse(value || ""); } catch { return fallback; } }
export function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
