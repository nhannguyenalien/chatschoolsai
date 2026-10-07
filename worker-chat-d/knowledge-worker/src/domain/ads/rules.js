// Rule engine cho Ads Agent: code thuần, KHÔNG gọi model. Quyết định campaign nào cần chú ý
// và có đáng gọi model chẩn đoán hay không.
//
// "Kết quả chính" phụ thuộc mục tiêu campaign (đơn hàng, tin nhắn, lead, click...). Chỉ campaign bán hàng
// có doanh thu mới được đánh giá bằng ROAS; các loại khác đánh giá bằng chi phí mỗi kết quả.

// Ngưỡng tiền tính theo USD, tự quy đổi sang tiền tệ của ad account (xem CURRENCY_PER_USD).
// Tenant tự đặt min_spend/cost_target thì giá trị đó là theo ĐÚNG tiền tệ của account, không quy đổi.
export const DEFAULT_THRESHOLDS = Object.freeze({
  min_spend: 5,          // chi 7 ngày dưới mức này: chưa đủ dữ liệu để kết luận
  roas_scale: 3,         // ROAS >= ngưỡng (và chi phí không tăng) → SCALE (chỉ campaign bán hàng có doanh thu)
  roas_pause: 1,         // ROAS < ngưỡng → PAUSE
  max_frequency: 3.5,    // frequency cao → creative mệt
  roas_drop_pct: 20,     // ROAS 7 ngày gần nhất tụt so với 7 ngày trước ≥ x% → bất thường
  cost_rise_pct: 25,     // chi phí mỗi kết quả tăng ≥ x% → bất thường
  cost_target: 0,        // chi phí mỗi kết quả mục tiêu (0 = không đặt): ≤ mục tiêu và không cờ → SCALE, ≥ 2x → WATCH
});
const MONEY_KEYS = new Set(["min_spend"]);

export const CURRENCY_PER_USD = Object.freeze({
  VND: 25000, IDR: 16000, KRW: 1400, JPY: 150, INR: 85, PHP: 56, THB: 35, TWD: 32, MYR: 4.5,
  EUR: 0.92, GBP: 0.8, CNY: 7.2, HKD: 7.8, SGD: 1.35, AUD: 1.5, CAD: 1.37,
});

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);

export function mergeThresholds(custom, currency) {
  const out = { ...DEFAULT_THRESHOLDS };
  out.min_spend = DEFAULT_THRESHOLDS.min_spend * (CURRENCY_PER_USD[String(currency || "").toUpperCase()] || 1);
  if (custom && typeof custom === "object") {
    for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
      if (custom[key] !== undefined && Number.isFinite(Number(custom[key])) && Number(custom[key]) >= 0) out[key] = Number(custom[key]);
    }
  }
  return out;
}

// metrics = { spend, impressions, clicks, results, revenue, frequency }
export function deriveMetrics(m = {}) {
  const spend = num(m.spend), clicks = num(m.clicks), impressions = num(m.impressions);
  const results = num(m.results), revenue = num(m.revenue);
  return {
    spend, impressions, clicks, results, revenue,
    frequency: num(m.frequency),
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cost_per_result: results > 0 ? spend / results : null,
    roas: spend > 0 ? revenue / spend : 0,
  };
}

// current/previous: 2 cửa sổ 7 ngày liên tiếp của cùng 1 campaign. kind: sales|leads|messages|traffic|engagement|awareness|app
export function classifyCampaign(campaign, thresholds = DEFAULT_THRESHOLDS) {
  const cur = deriveMetrics(campaign.current);
  const prev = deriveMetrics(campaign.previous);
  const kind = campaign.kind || "sales";
  const base = { id: campaign.id, name: campaign.name, kind, current: cur, previous: prev };
  const flags = [];

  if (cur.spend < thresholds.min_spend) return { ...base, label: "WATCH", flags: ["low_data"], change: {} };

  // ROAS chỉ có ý nghĩa khi là campaign bán hàng và Meta trả về giá trị đơn hàng.
  const useRoas = kind === "sales" && cur.revenue > 0;
  const judgesResults = kind !== "awareness";
  const roasChange = useRoas ? pct(cur.roas, prev.roas) : null;
  const costChange = cur.cost_per_result != null && prev.cost_per_result != null ? pct(cur.cost_per_result, prev.cost_per_result) : null;

  if (cur.frequency >= thresholds.max_frequency) flags.push("creative_fatigue");
  if (roasChange != null && roasChange <= -thresholds.roas_drop_pct) flags.push("roas_drop");
  if (judgesResults && costChange != null && costChange >= thresholds.cost_rise_pct) flags.push("cost_rise");
  if (judgesResults && cur.results === 0 && cur.spend >= thresholds.min_spend * 4) flags.push("spend_no_result");
  if (thresholds.cost_target > 0 && cur.cost_per_result != null && cur.cost_per_result >= thresholds.cost_target * 2) flags.push("cost_over_target");

  const fatigueOrCost = flags.includes("creative_fatigue") || flags.includes("cost_rise");
  let label = "HOLD";
  if (flags.includes("spend_no_result") || (useRoas && cur.roas < thresholds.roas_pause)) label = "PAUSE";
  else if (useRoas && cur.roas >= thresholds.roas_scale && !fatigueOrCost) label = "SCALE";
  else if (!useRoas && judgesResults && thresholds.cost_target > 0 && cur.cost_per_result != null
    && cur.cost_per_result <= thresholds.cost_target && !flags.length) label = "SCALE";
  else if (flags.length) label = "WATCH";

  return { ...base, label, flags, change: { roas_pct: roasChange, cost_pct: costChange } };
}

// Bất thường = cần model mạnh. Cờ lẻ ở 1 campaign nhỏ thì model rẻ là đủ.
export function evaluateAccount(campaigns, customThresholds, currency) {
  const thresholds = mergeThresholds(customThresholds, currency);
  const results = campaigns.map((c) => classifyCampaign(c, thresholds));
  const totalSpend = results.reduce((s, c) => s + c.current.spend, 0);
  const flagged = results.filter((c) => c.flags.some((f) => f !== "low_data"));
  const flaggedSpend = flagged.reduce((s, c) => s + c.current.spend, 0);
  const anomaly = flagged.length >= 3 || (flagged.length >= 2 && totalSpend > 0 && flaggedSpend / totalSpend >= 0.4)
    || results.some((c) => c.label === "PAUSE" && c.current.spend >= thresholds.min_spend * 4);
  return {
    campaigns: results,
    totals: { campaigns: results.length, spend: totalSpend, flagged: flagged.length },
    counts: results.reduce((acc, c) => ({ ...acc, [c.label]: (acc[c.label] || 0) + 1 }), {}),
    anomaly,
    needsAttention: flagged.length > 0,
  };
}
