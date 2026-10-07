// Rule engine cho Ads Agent: code thuần, KHÔNG gọi model. Quyết định campaign nào cần chú ý
// và có đáng gọi model chẩn đoán hay không.
export const DEFAULT_THRESHOLDS = Object.freeze({
  min_spend: 5,          // dưới mức này (đơn vị tiền tệ của account) thì chưa đủ dữ liệu để kết luận
  roas_scale: 3,         // ROAS >= ngưỡng này (và CPA ổn) → SCALE
  roas_pause: 1,         // ROAS < ngưỡng này → PAUSE
  max_frequency: 3.5,    // frequency cao → creative mệt
  roas_drop_pct: 20,     // ROAS 7 ngày gần nhất tụt so với 7 ngày trước ≥ x% → bất thường
  cpa_rise_pct: 25,      // CPA tăng ≥ x% → bất thường
});

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);

export function mergeThresholds(custom) {
  const out = { ...DEFAULT_THRESHOLDS };
  if (custom && typeof custom === "object") {
    for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
      if (custom[key] !== undefined && Number.isFinite(Number(custom[key])) && Number(custom[key]) >= 0) out[key] = Number(custom[key]);
    }
  }
  return out;
}

// metrics = { spend, impressions, clicks, purchases, revenue, frequency }
export function deriveMetrics(m = {}) {
  const spend = num(m.spend), clicks = num(m.clicks), impressions = num(m.impressions);
  const purchases = num(m.purchases), revenue = num(m.revenue);
  return {
    spend, impressions, clicks, purchases, revenue,
    frequency: num(m.frequency),
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpa: purchases > 0 ? spend / purchases : null,
    roas: spend > 0 ? revenue / spend : 0,
  };
}

// current/previous: 2 cửa sổ 7 ngày liên tiếp của cùng 1 campaign.
export function classifyCampaign(campaign, thresholds = DEFAULT_THRESHOLDS) {
  const cur = deriveMetrics(campaign.current);
  const prev = deriveMetrics(campaign.previous);
  const flags = [];
  let label = "HOLD";

  if (cur.spend < thresholds.min_spend) {
    return { id: campaign.id, name: campaign.name, label: "WATCH", flags: ["low_data"], current: cur, previous: prev, change: {} };
  }
  const roasChange = pct(cur.roas, prev.roas);
  const cpaChange = cur.cpa != null && prev.cpa != null ? pct(cur.cpa, prev.cpa) : null;

  if (cur.frequency >= thresholds.max_frequency) flags.push("creative_fatigue");
  if (roasChange != null && roasChange <= -thresholds.roas_drop_pct) flags.push("roas_drop");
  if (cpaChange != null && cpaChange >= thresholds.cpa_rise_pct) flags.push("cpa_rise");
  if (cur.purchases === 0 && cur.spend >= thresholds.min_spend * 4) flags.push("spend_no_conversion");

  if (cur.roas < thresholds.roas_pause || flags.includes("spend_no_conversion")) label = "PAUSE";
  else if (cur.roas >= thresholds.roas_scale && !flags.includes("creative_fatigue") && !flags.includes("cpa_rise")) label = "SCALE";
  else if (flags.length) label = "WATCH";

  return { id: campaign.id, name: campaign.name, label, flags, current: cur, previous: prev, change: { roas_pct: roasChange, cpa_pct: cpaChange } };
}

// Bất thường = cần model mạnh. Cờ lẻ ở 1 campaign nhỏ thì model rẻ là đủ.
export function evaluateAccount(campaigns, customThresholds) {
  const thresholds = mergeThresholds(customThresholds);
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
