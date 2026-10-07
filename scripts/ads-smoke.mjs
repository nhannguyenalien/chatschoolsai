#!/usr/bin/env node
// Thử Ads Agent với ad account Meta thật, KHÔNG ghi gì vào PocketBase và không gọi model.
//   META_ADS_TOKEN=... node scripts/ads-smoke.mjs [act_123456]
// Token chỉ đọc từ biến môi trường, không in ra màn hình.
import { createMetaAdsIntegration } from "../worker-chat-d/knowledge-worker/src/integrations/metaAds.js";
import { evaluateAccount } from "../worker-chat-d/knowledge-worker/src/domain/ads/rules.js";
import { plainReport } from "../worker-chat-d/knowledge-worker/src/workflows/runAdsReport.js";

const token = process.env.META_ADS_TOKEN;
if (!token) { console.error("Thiếu META_ADS_TOKEN."); process.exit(1); }
const meta = createMetaAdsIntegration();
const accounts = await meta.listAccounts(token);
console.log(`Token truy cập được ${accounts.length} ad account:`);
for (const a of accounts) console.log(`  ${a.id}  ${a.name}  (${a.currency})`);

const targets = process.argv[2] ? accounts.filter((a) => a.id === process.argv[2]) : accounts.slice(0, 3);
const report = [];
for (const a of targets) {
  const campaigns = await meta.fetchCampaigns({ token, accountId: a.id });
  const evaluation = evaluateAccount(campaigns);
  report.push({ label: a.name || a.id, currency: a.currency, evaluation });
  console.log(`\n${a.name}: ${campaigns.length} campaign trong 14 ngày, anomaly=${evaluation.anomaly}`);
  for (const c of evaluation.campaigns.slice(0, 10)) {
    console.log(`  [${c.label}] ${c.name}  chi=${c.current.spend.toFixed(2)} roas=${c.current.roas.toFixed(2)} freq=${c.current.frequency.toFixed(1)} cờ=${c.flags.join(",") || "-"}`);
  }
}
console.log(`\n--- Báo cáo (không model) ---\n${plainReport(report)}`);
