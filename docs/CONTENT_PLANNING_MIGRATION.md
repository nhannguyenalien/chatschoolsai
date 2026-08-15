# Content Planning migration: Skillgo → Dashpoc

Status: Phase 0 review + Phase 1 domain foundation + Phase 2 data/import foundation + Phase 3 trend/review/plan-entry/cadence + Phase 4 blog generation foundation, including legacy Sanity history reads. Production deployment is intentionally out of scope until migration and rollback have been exercised.

Phase 2 data foundation is prepared but not applied: nine private PocketBase collections, tenant/site-scoped repositories, required extensions to `pages_config`, `posts`, and `bot_configs`, and a dry-run-first migration. Run `node scripts/pb-content-planning-migrate.mjs` to inspect the plan. Applying it additionally requires `--apply`, admin credentials, and `PB_BACKUP_CONFIRMED=yes`.

Trend parsing now preserves the Skillgo contract: canonical and compact collector payloads, strict ranked-score validation, recovery of complete topics from Telegram-truncated JSON, and stable SHA-256 report identity. The import workflow persists a report and its child topics with reverse-order compensation on partial failure. Recommendation uses the Skillgo Dice threshold (`0.68`) against tenant/site-scoped post and plan history plus original-blog titles read from a configured legacy Sanity site; topic review enforces ownership and state transitions.

The current PocketBase REST flow cannot provide a true multi-record transaction. Compensation is therefore explicit and a failed cleanup raises a distinct `TrendImportCompensationError`; production API integration must alert on that error and preserve the affected record IDs for operator repair.

## Baseline (2026-08-05, Asia/Ho_Chi_Minh)

- Dashpoc: `main`, 27 commits ahead of `origin/main`; local changes in `docs/API.md` and `worker-chat-d/knowledge-worker/src/index.js` are pre-existing POS customer-context work and must be preserved.
- Skillgo snapshot has no `.git` directory, so status, uncommitted diff and commit history cannot be audited from the supplied folder.
- Skillgo tests: 3 files, 11 tests passed.
- Skillgo build: passed (Next.js 16.2.10); only existing workspace-root, middleware-convention and Sass `@import` deprecation warnings were emitted.
- Dashpoc Worker: Wrangler dry-run passed with the bundled Node 24.14.0. The default shell Node 21.4.0 is unsupported by Wrangler 4.
- Dashpoc Content Planning modules and dashboard contract: 115 tests passed after atomic recommendation/schedule/generation claims, translation dependency jobs, compensated multilingual approval, dispatcher fail-closed checks, exact structured blog contract, SVG sanitization/upload, failure restoration, legacy Sanity history reads, idempotent Skillgo-schema publishing, translated Sanity asset reuse/source ordering, tenant/site-scoped GSC/GA4 performance ingest and advisory insights, official-response GSC/GA4 mappers, Telegram controls, dashboard topic/draft review, tenant-scoped plan management, and HTTP conflict mapping for unmet publish dependencies.
- Deterministic shadow baseline: a harness executes Skillgo's original TypeScript recommendation module and Dashpoc's implementation against the same fixtures. Six similarity cases, four recommendation scenarios and the fixed `03:00 UTC` cadence all match.
- Live read-only shadow baseline: the same two engines were run against the current Skillgo Sanity snapshot without mutating any document. All 5 original blogs, 7 queued blog topics and 3 available trend candidates produced the same recommendation (`trendReport-2026-08-05-topic-2`) and duplicate set (0). This is a point-in-time result and must be rerun before cutover.
- Disposable PocketBase integration baseline: all eight private collections and all three existing-collection extensions applied successfully to PocketBase 0.38.2; a second migration run skipped every change idempotently. Modern PocketBase collections receive explicit `created`/`updated` autodate fields, while authentication supports both the current `_superusers` endpoint and the legacy admin endpoint. Concurrent recommendation claims and concurrent schedule claims each produced exactly one winner and one loser. A full authenticated Worker-handler smoke rejected an invalid API key, returned only the seeded tenant's review data, approved a topic into its active plan, exposed the generated draft preview, and returned `409` while translation dependencies were pending. The database lived only on loopback and was removed after the test; no persistent PocketBase migration and no deployment were performed.

## Deployment topology found in the repository

| Surface | Deployment evidence | Current target |
| --- | --- | --- |
| Backend | `worker-chat-d/knowledge-worker/wrangler.jsonc` | Cloudflare Worker `knowledge-worker`, custom domain `apic.schoolsai.work` |
| Backend legacy config | `worker/wrangler.toml` | Also names `knowledge-worker`; does not contain the current routes/crons and must not be used for release |
| Dashboard | Static files in `dash-tabler/` | Runtime URLs default to `chat.schoolsai.work`, but no Pages project config or deployment command is committed; the exact Cloudflare Pages project cannot be proven from this repository |
| Skillgo | `.vercel/` and `vercel.json` | Vercel; cron `/api/cron/daily-content` at `0 3 * * *` |

## Behaviour mapping

| Capability | Skillgo behaviour to preserve | Dashpoc now | Gap / incompatible behaviour |
| --- | --- | --- | --- |
| Trend JSON import | Strict 10-topic schema, normalization of collector aliases, truncated Telegram recovery, checksum/idempotent report identity | API and owner-scoped Telegram JSON/text-file flow use the same compensating workflow | Database apply and production canary remain |
| Duplicate prevention | Dice token similarity, threshold `0.68`, compare title and primary keyword against original blogs + queue | Skillgo-compatible domain check reads tenant/site-scoped post + plan history and original `blog` titles from the site's Sanity dataset; unique topic claims prevent concurrent selection | Deterministic and current-Sanity read-only shadows match; eventual history backfill and cutover rerun remain |
| Recommendation | Highest-ranked non-duplicate trend topic; reports duplicate checks | Workflow atomically claims the first eligible ranked topic and persists check metadata | UI integration and AI advisory narrative remain |
| Topic approval | Imported trend remains unavailable until human schedules/approves it | Dashboard and Telegram use the same tenant/site workflow; approve + plan entry is compensated as one operation and reject uses the shared review transition | Production canary remains |
| Queue fallback | Queue FIFO → approved trend → AI fallback; failed queue item is returned to head, failed trend is released | Plan FIFO and atomic generation claim; queued failure restores status with `order=-1`, scheduled failure preserves schedule | Course and AI fallback paths remain |
| Daily generation | One draft course + one draft blog; independent error isolation and Telegram summary | Skillgo-compatible blog generation is in the control plane; course/lesson generation is explicitly deferred to a future industry-specific custom module | Course/lesson is outside the current cutover scope by product decision, not a blog cutover blocker |
| Writing | Structured long-form draft, related-series links, parallel section SVGs, cover best-effort, draft in Sanity | Skillgo-compatible prompt/schema/settings and author; published-only series/tag links; sanitized SVGs stored centrally; canonical HTML post plus selected-site target | Live AI/Sanity draft comparison and final CMS field mapping remain |
| Human review | Web/Telegram publish or hard-delete draft; nothing public before approval | Dashboard and Telegram share the approval gate; draft rejection cancels the item and deletes source/translations, failing closed around publishing | Live canary and operator reconciliation drill remain |
| Translation | On publish, translate to the other locale; blog publishes after one successful job; course publishes only if all lessons translate; skip translation-of/existing translation | Structured blog translation jobs for six parity locales; skips source locale and translations-of; idempotent retry; all-required dependency gate | Blog path implemented locally; course/lesson is deferred to the industry-custom extension |
| Scheduling | Vercel daily cron at `03:00 UTC`; FIFO queue consumption | Dashboard-managed plans expose timezone-aware cadence, full queue state and an explicit scheduler with atomic item/slot claims | Shadow comparison and approved cron ownership cutover remain |
| Publishing | Skillgo publishes Sanity drafts, then triggers translation | Claim target, recover stale claim, publish WordPress/Sanity; approved or due scheduled only; compensated source/translation approval, second fail-closed dispatcher gate, exact Skillgo `blog` mapping and deterministic `createOrReplace` reconciliation | Live CMS canary and operator reconciliation drill remain |
| Telegram | Add topics, import JSON/file, list, approve/reject | Owner-only menu imports JSON/text files, recommends topics, lists the active-plan queue in Telegram-safe chunks, and reviews/approves/rejects drafts through shared workflows; ambiguous plans and publishing races fail closed | Course actions remain |
| Analytics feedback | Trend input can state Search Console availability | Provider-neutral GSC/GA4 snapshots are validated, idempotently stored per tenant/site, and exposed as aggregate advisory insights | Provider OAuth/collectors and any behavior-changing recommendation weighting require a later approved gate |

## Target boundaries

New work must live below `src/domain`, `src/workflows`, `src/adapters`, `src/repositories`, `src/api`, and `src/cron`. `src/index.js` remains composition/routing only. Records are tenant- and site-scoped; planning must never infer one fixed website.

## Migration and rollback gates

The operator checklist, approval boundaries, pass/fail criteria, and rollback sequence are defined in `docs/CONTENT_PLANNING_CUTOVER_RUNBOOK.md`. That runbook is preparatory documentation and does not authorize any live action.

1. Add PocketBase collections idempotently; export a PocketBase backup first.
2. Shadow-import trend reports and compare recommendation/duplicate results with Skillgo fixtures.
3. Dual-write approved plans while Skillgo remains the only cron owner.
4. Run Dashpoc generation in dry-run mode and compare drafts without publishing.
5. Enable publishing for one canary site. Rollback is disabling that site's Content Planning flag; queued Skillgo data and its Vercel cron remain intact.
6. Enable translation dependency gate and verify retry/partial-failure behaviour.
7. Only then disable Skillgo's Vercel cron. Re-enable it as rollback until the observation window closes.

Never run both schedulers as active publishers for the same site/cadence.

## Phase 3 failure modes and trade-offs

- Import consistency: PocketBase REST calls are sequential. Reverse compensation bounds partial writes, but an infrastructure failure during cleanup requires operator repair; a server-side transaction endpoint would remove this exposure.
- Import idempotency: report identity is protected by a unique index and the workflow handles both repeat requests and check/create races. Child-topic persistence still uses compensation because PocketBase REST has no multi-record transaction.
- Recommendation consistency: a private `recommendation_claims` collection has a unique index on `topic_id`. A request must win that insert before updating the topic; losers continue to the next eligible candidate. Update failure releases the claim, and failed release raises `RecommendationClaimCompensationError` with the claim ID for repair.
- History coverage: the repository checks Dashpoc posts and plan items, while a separate adapter queries original Skillgo `blog` documents from the Sanity site (`!defined(translationOf)`). The adapter reuses `pages_config.page_id` and `access_token`, validates the target before constructing a URL, and fails closed so incomplete history cannot produce a false-safe recommendation. The live shadow now covers current original-blog and queue history; later backfill remains a migration gate.
- Site scoping: an empty `siteId` intentionally means tenant-wide recommendation, matching shared planning. A supplied site always narrows both candidates and plan history.
- Plan entry consistency: `(plan_id, trend_topic_id)` is unique. Concurrent losers return the winning item. A newly created item is removed if consuming the source topic fails; failed removal raises `PlanItemCompensationError` with the affected item ID. Human approval and plan entry now run through one workflow; if plan entry fails before leaving a live item, the topic is restored to its previous review state, and failed restoration raises `TopicApprovalCompensationError` for reconciliation.
- Scheduling consistency: `schedule_claims` uniquely protects both `item_id` and `(plan_id, slot)`. The explicit scheduler only reads `active` plans, processes unscheduled `queued` items FIFO, respects the plan timezone/start/end/horizon, leaves item status unchanged, and releases its claim if the `scheduled_at` patch fails. A failed release raises `ScheduleClaimCompensationError` with the claim ID. Skillgo compatibility is the explicit `UTC` + daily `03:00` cadence; no cron is enabled yet.

The disposable-database gate now covers schema creation, idempotent re-run, real unique-index contention, the authenticated dashboard/API path through the actual Worker handler, and concurrent idempotent GSC/GA4 snapshot imports. Cleanup-failure behaviour remains unit-tested because forcing an infrastructure failure during compensation would make the disposable result nondeterministic.

The no-write CMS payload parity gate now covers the Skillgo source/translation field contract, deterministic IDs, source asset reuse and a fail-closed missing-source check. A translated Sanity document omits `seriesId` and `seoTitle` exactly like Skillgo's translator, reuses the published source thumbnail and section assets, and cannot mutate Sanity before its deterministic source document exists.

The analytics feedback contract is local and provider-neutral: callers can ingest already-normalized GSC/GA4 snapshots and read advisory aggregates. It does not yet obtain Google credentials, call either provider API, backfill production data, or influence recommendation ordering. Those changes require an explicit credential/data-retention design and approval before implementation or live execution.

Next operational gate (approval required): run a live CMS draft canary in an explicitly selected isolated dataset, followed by the operator reconciliation drill. Skillgo remains the only cron and publisher owner throughout this gate. Neither action, nor cron cutover, may run from this migration without the owner naming the target and approving the run.

## Deferred industry custom extension

Course/lesson generation and course/lesson translation parity are intentionally deferred from the current blog Content Planning cutover. They will be designed as a separate custom capability with per-industry content models and dependency rules; the current generic control plane must not hard-code an education-specific workflow.

Run the authenticated loopback smoke from `worker-chat-d/knowledge-worker` with `PB_URL`, `PB_ADMIN_EMAIL`, and `PB_ADMIN_PASS` set, then execute `npm run test:content-planning:api-smoke`. The script refuses a non-loopback PocketBase URL, seeds only disposable records, and removes those records in a `finally` cleanup.

Run the deterministic comparison from `worker-chat-d/knowledge-worker` with `npm run test:content-planning:shadow`. Set `SKILLGO_ROOT` only when the supplied Skillgo snapshot is stored elsewhere; the harness reads its original module without modifying that project.

Run the current Sanity comparison with `npm run test:content-planning:shadow:live`. It loads the local Skillgo Sanity configuration, performs reads only, passes an owner-only temporary snapshot to the original Skillgo module, removes that snapshot on completion, and never prints credentials. Missing configuration, invalid responses and an empty candidate set fail closed.

A framework-thin API handler now exists for import, recommendation and review and is composed into the existing API-key router. It derives `tenant` exclusively from authenticated context and verifies every supplied `siteId` against tenant-owned `pages_config` before import/recommend. This code is only locally verified; the endpoints do not exist in production until a later approved deployment.

The Composer dashboard now has a Content Planning review pane backed by one sanitized, tenant-scoped read endpoint. It lists recommended topics and draft/review items across active plans. Topic approval requires exactly one active plan for the same site and calls the compensated approve-to-plan endpoint; draft approval remains disabled until required translation dependencies are ready. No dashboard code reads private Content Planning collections directly.
## Sanity cutover and retry reconciliation

Before enabling publish dispatch for the Skillgo site, set the corresponding `pages_config.extra_config` to:

```json
{"contentPlanningProfile":"skillgo-blog-v1"}
```

The adapter derives a stable Sanity `_id` (`dashpoc-blog-<PocketBase post id>`) and uses `createOrReplace`. A retry after a Worker interruption therefore reconciles the same document instead of creating another blog. Translations deterministically reference the source document ID. Rollback is to pause the content plan/dispatcher and remove the profile; do not delete reconciled Sanity documents automatically. Verify target state and document contents before any manual cleanup.

## Telegram migration and rollback

The PocketBase migration extends `bot_configs` with `content_planning_telegram_state`; it stores only the short-lived `awaiting_trend_json` state. Telegram admin access requires exactly one `bot_configs.owner_telegram_chat_id` match. Import/recommend/queue/review require exactly one active content plan, while callbacks verify the item or topic against that plan's tenant and site instead of inferring a website. Long queue output is split below Telegram's message limit without dropping entries.

Draft approval uses the same translation dependency gate as the API. Draft rejection preserves Skillgo's hard-delete semantics: it refuses any publishing/published target, cancels the item first, then deletes translations and source. A partial PocketBase cleanup is recorded for manual reconciliation and stays closed to publishing.

Set `TELEGRAM_WEBHOOK_SECRET` and register the same value as Telegram's webhook secret before production cutover. When configured, mismatched webhook requests receive `401`; leaving it unset preserves the existing verification webhook during staging. Rollback is to remove the Content Planning keyboard entry or deploy the previous Worker; the additive field can remain unused and no trend/content records need deletion. Do not disable Skillgo cron as part of this Telegram phase.
