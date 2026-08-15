import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  recommendTrendTopic, TREND_DUPLICATE_THRESHOLD,
} from "../worker-chat-d/knowledge-worker/src/domain/trends/recommendation.js";
import { createSanityHistoryAdapter } from "../worker-chat-d/knowledge-worker/src/adapters/sanity/history.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillgoRoot = process.env.SKILLGO_ROOT || "/Users/nhannguyen/Desktop/spacehuge/uischoolai/skillgro-v1.4";
const skillgoEnvPath = path.join(skillgoRoot, ".env.local");
if (existsSync(skillgoEnvPath)) {
  for (const line of readFileSync(skillgoEnvPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    process.env[match[1]] = value;
  }
}

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
if (!projectId || !dataset) {
  throw new Error("Live shadow requires NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET.");
}

const site = {
  platform: "sanity",
  page_id: `${projectId}:${dataset}`,
  access_token: process.env.SANITY_API_TOKEN || "",
};
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "v2021-06-07";
const historyAdapter = createSanityHistoryAdapter({ apiVersion });
const blogHistory = await historyAdapter.listHistoricalTopics(site);

const planningQuery = `{
  "candidates": *[_type == "trendTopic" && status == "available"] | order(overallScore desc, report->generatedAt desc, rank asc){ "id": _id, title, primaryKeyword, category, rank, overallScore, trendReason, suggestedAngle, recommendedFormat, recommendedWordCount },
  "queued": *[_type == "topicQueueItem" && contentType == "blog"]{ "title": topic }
}`;
const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(planningQuery)}`;
const headers = { Accept: "application/json" };
if (site.access_token) headers.Authorization = `Bearer ${site.access_token}`;
const response = await fetch(url, { headers });
const payload = await response.json().catch(() => null);
if (!response.ok) throw new Error(`Sanity planning snapshot failed (HTTP ${response.status}).`);
if (!Array.isArray(payload?.result?.candidates) || !Array.isArray(payload?.result?.queued)) {
  throw new Error("Sanity planning snapshot returned an invalid result.");
}

const candidates = payload.result.candidates;
const queued = payload.result.queued
  .filter((item) => typeof item?.title === "string" && item.title.trim())
  .map((item) => ({ title: item.title.trim(), source: "queue" }));
if (!candidates.length) throw new Error("Live shadow found no available trend candidates; comparison is fail-closed.");
const history = [
  ...blogHistory.map(({ title }) => ({ title, source: "blog" })),
  ...queued,
];

const dashpocResult = recommendTrendTopic(candidates, history);
const dashpoc = {
  threshold: TREND_DUPLICATE_THRESHOLD,
  recommendationId: dashpocResult.recommendation?.candidate.id ?? null,
  duplicateIds: dashpocResult.duplicateChecks.map((item) => item.candidate.id),
};

const tempRoot = mkdtempSync(path.join(tmpdir(), "dashpoc-live-shadow-"));
try {
  const snapshotPath = path.join(tempRoot, "snapshot.json");
  writeFileSync(snapshotPath, JSON.stringify({ candidates, history }), { mode: 0o600 });
  const runnerPath = path.join(projectRoot, "scripts/skillgo-live-shadow-runner.ts");
  const skillgoProcess = spawnSync(process.execPath, [path.join(skillgoRoot, "node_modules/tsx/dist/cli.mjs"), runnerPath, snapshotPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      SKILLGO_RECOMMENDATION_MODULE: path.join(skillgoRoot, "src/lib/trendRecommendation.ts"),
    },
  });
  if (skillgoProcess.status !== 0) {
    throw new Error(`Skillgo live shadow runner failed (exit ${skillgoProcess.status ?? "unknown"}).`);
  }
  assert.deepEqual(dashpoc, JSON.parse(skillgoProcess.stdout), "Live Dashpoc recommendation diverged from Skillgo.");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

process.stdout.write(
  `PASS: live read-only shadow (${blogHistory.length} original blogs, ${queued.length} queued topics, ${candidates.length} available trends; recommendation ${dashpoc.recommendationId || "none"}; ${dashpoc.duplicateIds.length} duplicates).\n`,
);
