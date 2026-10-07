// Meta Marketing API, CHỈ ĐỌC. Khách tự tạo token (System User hoặc user token có ads_read) rồi dán vào dashboard.
const GRAPH_VERSION = "v21.0";
const FIELDS = "campaign_id,campaign_name,spend,impressions,clicks,frequency,actions,action_values";
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

async function graph(fetchImpl, path, token, params = {}) {
  const query = new URLSearchParams({ ...params, access_token: token });
  const response = await fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${path}?${query}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || `Meta Ads API lỗi (${response.status}).`);
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

export function normalizeAccountId(value) {
  const id = String(value || "").trim().replace(/^act_/i, "");
  if (!/^\d{5,20}$/.test(id)) throw new Error("Ad account ID không hợp lệ (chỉ gồm số, có thể có tiền tố act_).");
  return `act_${id}`;
}

function purchaseOf(list = []) {
  for (const type of PURCHASE_TYPES) {
    const hit = list.find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

export function rowToMetrics(row) {
  return {
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    frequency: Number(row.frequency) || 0,
    purchases: purchaseOf(row.actions),
    revenue: purchaseOf(row.action_values),
  };
}

async function campaignRows(fetchImpl, token, accountId, since, until) {
  const rows = [];
  let next = null;
  let guard = 0;
  do {
    const body = next
      ? await (async () => { const r = await fetchImpl(next); const b = await r.json().catch(() => ({})); if (!r.ok || b.error) throw new Error(b.error?.message || "Meta Ads API lỗi."); return b; })()
      : await graph(fetchImpl, `${accountId}/insights`, token, { level: "campaign", fields: FIELDS, time_range: JSON.stringify({ since, until }), limit: "100" });
    rows.push(...(body.data || []));
    next = body.paging?.next || null;
  } while (next && ++guard < 5);
  return rows;
}

export function createMetaAdsIntegration({ fetchImpl = fetch } = {}) {
  return {
    // Kiểm tra token và liệt kê ad account mà token truy cập được.
    async listAccounts(token) {
      const body = await graph(fetchImpl, "me/adaccounts", token, { fields: "account_id,name,currency,account_status", limit: "100" });
      return (body.data || []).map((a) => ({ id: `act_${a.account_id}`, name: a.name || "", currency: a.currency || "", status: a.account_status }));
    },
    // Trả campaign với 2 cửa sổ 7 ngày liên tiếp: current = 7 ngày gần nhất, previous = 7 ngày trước đó.
    async fetchCampaigns({ token, accountId, today = new Date() }) {
      const id = normalizeAccountId(accountId);
      const day = (offset) => new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10);
      const [curRows, prevRows] = await Promise.all([
        campaignRows(fetchImpl, token, id, day(7), day(1)),
        campaignRows(fetchImpl, token, id, day(14), day(8)),
      ]);
      const map = new Map();
      for (const row of curRows) map.set(row.campaign_id, { id: row.campaign_id, name: row.campaign_name, current: rowToMetrics(row), previous: {} });
      for (const row of prevRows) {
        const entry = map.get(row.campaign_id) || { id: row.campaign_id, name: row.campaign_name, current: {}, previous: {} };
        entry.previous = rowToMetrics(row);
        map.set(row.campaign_id, entry);
      }
      return [...map.values()];
    },
  };
}
