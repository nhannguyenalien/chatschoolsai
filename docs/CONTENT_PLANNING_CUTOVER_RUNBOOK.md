# Content Planning production cutover runbook

Status: prepared only. Nothing in this runbook authorizes a production write, deployment, CMS canary, reconciliation mutation, or cron change.

## Required approval record

Before each gate, record all of the following in the change ticket:

- Approver and approval timestamp.
- Exact tenant and `pages_config` site record ID.
- Environment and Cloudflare Worker/Pages project names.
- PocketBase backup location and verified restore timestamp.
- Canary content plan, PocketBase post/target IDs, and expected deterministic CMS document ID.
- Observation-window owner and start/end time.

Approval is per gate. Approval for a PocketBase migration or deployment does not authorize CMS publishing or cron cutover.

## Gate 0 — release preflight (read-only/local)

1. Preserve and review the current worktree diff.
2. Run `npm test` in `worker-chat-d/knowledge-worker`.
3. Run `npx wrangler deploy --dry-run` with Node 22 or newer.
4. Run `node scripts/pb-content-planning-migrate.mjs` without `--apply`.
5. Rerun the deterministic and live read-only Skillgo shadows.
6. Confirm the dashboard Pages project and its rollback artifact; it is not identifiable from this repository alone.
7. Confirm Skillgo remains the only owner of the daily planning cron.

Stop if any test, shadow comparison, backup check, target identity, or deployment target is ambiguous.

## Gate 1 — schema and application deployment

Requires separate deployment approval and a recoverable PocketBase backup.

1. Apply the additive PocketBase migration with `--apply` only after setting `PB_BACKUP_CONFIRMED=yes` and the approved production credentials.
2. Verify all Content Planning collections and the `pages_config`, `posts`, and `bot_configs` extensions.
3. Deploy the Worker and dashboard to the named targets.
4. Verify `/health`, API authentication, tenant isolation, plan list, and analytics read using the approved tenant.
5. Keep every Content Planning plan paused and do not enable the Skillgo Sanity publishing profile yet.

Rollback: deploy the previous Worker/dashboard artifacts. Additive PocketBase fields may remain unused; restore the backup only if the migration damaged existing data.

## Gate 2 — live canary CMS

Requires explicit approval naming one site and one canary post. Do not use a broad tenant-wide dispatch.

1. Confirm the selected plan is paused and all unrelated Content Planning targets remain `pending`.
2. Set `pages_config.extra_config.contentPlanningProfile` to `skillgo-blog-v1` only for the approved Sanity site.
3. Generate and review one source blog. Complete every configured translation dependency.
4. Record the expected deterministic Sanity ID: `dashpoc-blog-<PocketBase post id>`.
5. Approve only the canary target and invoke one tenant-scoped publish dispatch.
6. Verify exactly one source document, expected translated documents, references, images, SEO fields, locale fields, and public rendering.
7. Retry the same target once and verify `createOrReplace` reconciles the same IDs without duplicates.

Pass: PocketBase target is `published`, CMS IDs match, retries are idempotent, and no unrelated target changed.

Fail/rollback: pause the plan, disable the site profile, stop dispatch, and preserve both PocketBase and CMS records for reconciliation. Do not auto-delete CMS documents.

## Gate 3 — reconciliation drill

Requires explicit approval because the recovery half of the drill may mutate live state.

Exercise one approved scenario at a time:

- Stale target left in `publishing`.
- Partial source/translation approval compensation.
- Partial draft rejection cleanup.
- PocketBase target says `error` while the deterministic CMS document already exists.

For every scenario, capture before/after IDs and timestamps, prove tenant/site ownership, and choose one outcome: reconcile to the existing CMS document, retry the same deterministic target, or leave closed for manual repair. Never create a replacement post with a new identity merely to clear an error.

Pass: the runbook owner can identify the authoritative record, return the workflow to one consistent state, and prove no duplicate or cross-tenant mutation occurred.

Rollback: pause the plan and dispatcher for that site, disable the profile, and restore only from the pre-approved backup or immutable CMS revision.

## Gate 4 — cron ownership cutover

Requires final cutover approval after the canary and reconciliation observation windows close.

1. Re-run both shadow comparisons and confirm the approved plan uses `UTC` at `03:00` for Skillgo parity.
2. Pause Skillgo planning immediately before the ownership boundary; record its last successful run and queue state.
3. Enable the named Dashpoc planning cron/configuration for only the approved site.
4. Observe the first scheduled run through topic claim, generation, review gate, dependencies, and publish dispatch.
5. Confirm one scheduler owned the slot and no duplicate queue item, draft, target, or CMS document exists.

Rollback during the observation window: disable the Dashpoc planning cron first, verify no Dashpoc run is active, then re-enable the original Skillgo cron. Never leave both schedulers enabled for the same site/cadence.

## Completion evidence

Attach test output, dry-run bundle output, migration log, dashboard smoke evidence, canary IDs, reconciliation before/after snapshots, cron configuration before/after, and the rollback decision owner. Course/lesson generation and translation are intentionally excluded and remain a future industry-specific extension.
