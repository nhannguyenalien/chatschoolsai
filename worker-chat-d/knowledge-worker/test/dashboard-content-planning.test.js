import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const composerUrl = new URL("../../../dash-tabler/composer.html", import.meta.url);
const analyticsUrl = new URL("../../../dash-tabler/analytics.html", import.meta.url);
const workerUrl = new URL("../src/index.js", import.meta.url);

test("dashboard exposes tenant-scoped topic and draft review controls", async () => {
  const html = await readFile(composerUrl, "utf8");
  assert.match(html, /href="#tab-content-planning"[^>]+data-bs-toggle="tab"/);
  assert.match(html, /\/api\/v1\/content-planning\/review/);
  assert.match(html, /\/approve-to-plan/);
  assert.match(html, /\/items\/\$\{encodeURIComponent\(itemId\)\}\/approve/);
  assert.match(html, /\/items\/\$\{encodeURIComponent\(itemId\)\}\/reject/);
  assert.match(html, /data-content-planning-action="approve-topic" data-index="\$\{index\}"/);
  assert.match(html, /data-content-planning-action="approve-draft" data-index="\$\{index\}"/);
  assert.doesNotMatch(html, /onclick="(?:approve|reject)ContentPlanning/);

  const approveFunction = html.slice(
    html.indexOf("async function approveContentPlanningTopic"),
    html.indexOf("async function rejectContentPlanningTopic"),
  );
  assert.doesNotMatch(approveFunction, /\/review/);
  assert.doesNotMatch(approveFunction, /\/items\/from-topic/);
});

test("dashboard manages plan cadence, queue scheduling and performance analytics", async () => {
  const composer = await readFile(composerUrl, "utf8");
  assert.match(composer, /\/api\/v1\/content-planning\/plans/);
  assert.match(composer, /data-cp-plan-action="schedule"/);
  assert.match(composer, /\/trends\/import/);
  assert.match(composer, /\/trends\/recommend/);
  assert.match(composer, /content-planning-queue/);
  const analytics = await readFile(analyticsUrl, "utf8");
  assert.match(analytics, /\/analytics\/insights\?siteId=/);
  assert.match(analytics, /\/analytics\/import/);
  assert.match(analytics, /advisory-only/);

  const worker = await readFile(workerUrl, "utf8");
  assert.match(worker, /"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"/);
});
