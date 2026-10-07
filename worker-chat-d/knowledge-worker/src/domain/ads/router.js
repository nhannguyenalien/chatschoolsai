// Chọn model cho Ads Agent theo mức bất thường. Tên model luôn đọc từ env, không hard-code.
export function selectAdsModel(env, { anomaly = false, premium = false } = {}) {
  const fallback = env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
  const cheap = env.ADS_MODEL_CHEAP || fallback;
  const strong = env.ADS_MODEL_STRONG || cheap;
  const top = env.ADS_MODEL_PREMIUM || strong;
  if (anomaly && premium) return { tier: "premium", model: top };
  if (anomaly) return { tier: "strong", model: strong };
  return { tier: "cheap", model: cheap };
}
