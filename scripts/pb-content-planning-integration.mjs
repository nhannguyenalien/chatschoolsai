#!/usr/bin/env node
import { createPocketBaseClient } from "../worker-chat-d/knowledge-worker/src/repositories/pocketbase/client.js";
import { createContentPlanningRepository } from "../worker-chat-d/knowledge-worker/src/repositories/pocketbase/contentPlanningRepository.js";

const baseUrl = process.env.PB_URL?.replace(/\/$/, "");
const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASS;
if (!baseUrl || !email || !password) throw new Error("PB_URL, PB_ADMIN_EMAIL and PB_ADMIN_PASS are required.");
const url = new URL(baseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
  throw new Error(`Refusing integration test against non-loopback PocketBase host '${url.hostname}'.`);
}

async function authenticate() {
  const body = JSON.stringify({ identity: email, password });
  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.token) return data.token;
    if (response.status !== 404) throw new Error(`PocketBase authentication failed: ${data.message || response.status}`);
  }
  throw new Error("No supported PocketBase superuser endpoint found.");
}

const token = await authenticate();
const client = createPocketBaseClient({ baseUrl, token });
const repository = createContentPlanningRepository(client);
const suffix = crypto.randomUUID();
let topic;
let winningClaim;
let winningScheduleClaim;

try {
  topic = await repository.createTrendTopic({
    tenant: `integration-${suffix}`, site_id: "", report_id: `report-${suffix}`, rank: 1,
    title: "Atomic claim integration topic", category: "integration", primary_keyword: "atomic claim",
    topic_json: "{}", overall_score: 100, status: "imported", duplicate_check_json: "",
  });
  const claimedAt = new Date().toISOString();
  const attempts = await Promise.all([
    repository.tryClaimRecommendation({ tenant: topic.tenant, topicId: topic.id, reservationId: crypto.randomUUID(), claimedAt }),
    repository.tryClaimRecommendation({ tenant: topic.tenant, topicId: topic.id, reservationId: crypto.randomUUID(), claimedAt }),
  ]);
  const winners = attempts.filter(Boolean);
  const losers = attempts.filter((claim) => claim === null);
  if (winners.length !== 1 || losers.length !== 1) {
    throw new Error(`Atomic claim failed: expected one winner and one loser, got ${winners.length}/${losers.length}.`);
  }
  winningClaim = winners[0];
  console.log(`PASS atomic claim contention: winner=${winningClaim.id}, loser=null`);

  const scheduleAttempts = await Promise.all([
    repository.tryClaimSchedule({ tenant: topic.tenant, siteId: `site-${suffix}`, planId: `plan-${suffix}`, itemId: `item-${suffix}`, slot: "2026-08-06T03:00:00.000Z", reservationId: crypto.randomUUID(), claimedAt }),
    repository.tryClaimSchedule({ tenant: topic.tenant, siteId: `site-${suffix}`, planId: `plan-${suffix}`, itemId: `item-${suffix}`, slot: "2026-08-06T03:00:00.000Z", reservationId: crypto.randomUUID(), claimedAt }),
  ]);
  const scheduleWinners = scheduleAttempts.filter(Boolean);
  const scheduleLosers = scheduleAttempts.filter((claim) => claim === null);
  if (scheduleWinners.length !== 1 || scheduleLosers.length !== 1) {
    throw new Error(`Atomic schedule claim failed: expected one winner and one loser, got ${scheduleWinners.length}/${scheduleLosers.length}.`);
  }
  winningScheduleClaim = scheduleWinners[0];
  console.log(`PASS atomic schedule contention: winner=${winningScheduleClaim.id}, loser=null`);
} finally {
  if (winningScheduleClaim?.id) await repository.releaseScheduleClaim(winningScheduleClaim.id);
  if (winningClaim?.id) await repository.releaseRecommendationClaim(winningClaim.id);
  if (topic?.id) await repository.deleteTrendTopic(topic.id);
}
