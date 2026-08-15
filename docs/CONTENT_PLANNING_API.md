# Content Planning API (pre-deployment)

Status: locally implemented and tested; not deployed. All routes use the existing tenant API key authentication:

```http
Authorization: Bearer <bot_configs.api_key>
Content-Type: application/json
```

`tenant` is never accepted from the request body. When `siteId` is supplied, it must be the PocketBase record ID of a `pages_config` record owned by the authenticated tenant.

## Dashboard review snapshot

```http
GET /api/v1/content-planning/review
```

Returns sanitized recommended topics, active plans, and their `draft`/`review` items for the authenticated tenant. Canonical post output is limited to the fields required for review; repository credentials and internal records are never returned.

## Manage content plans

```http
GET /api/v1/content-planning/plans
```

Returns every tenant-owned plan together with its complete queue, including scheduled and completed items. This is the dashboard source for the plan and schedule views; records from another tenant are never returned.

```http
POST /api/v1/content-planning/plans

{
  "siteId": "pages-config-id",
  "name": "Skillgo daily blog",
  "timezone": "UTC",
  "cadence": { "days": ["all"], "times": ["03:00"] },
  "status": "active"
}
```

Creates a tenant/site-scoped plan and returns `201`. `timezone` must be an IANA timezone, cadence days must be `all` or `sun` through `sat`, and times must use 24-hour `HH:mm` format. Supported statuses are `draft`, `active`, `paused`, `completed`, and `cancelled`.

```http
PATCH /api/v1/content-planning/plans/<plan-id>

{
  "name": "Skillgo daily blog",
  "timezone": "Asia/Ho_Chi_Minh",
  "cadence": { "days": ["mon", "wed", "fri"], "times": ["09:00"] },
  "status": "paused"
}
```

Updates only supplied fields after rechecking tenant ownership. An empty patch is rejected. Any status other than `active` prevents new cadence assignment; it does not rewrite already scheduled items.

## Import a trend report

```http
POST /api/v1/content-planning/trends/import

{
  "siteId": "optional-pages-config-id",
  "trendJson": "{...the complete collector JSON payload...}"
}
```

Returns `201`. `duplicate` is `false` for a new import and `true` when the same SHA-256 identity was already imported or another request won the unique-index race. A partial child write is compensated in reverse order; incomplete compensation is surfaced as an operational error.

## Recommend a topic

```http
POST /api/v1/content-planning/trends/recommend

{
  "siteId": "optional-pages-config-id",
  "threshold": 0.68
}
```

Returns the first ranked candidate that does not duplicate tenant/site history. Omitting `threshold` preserves Skillgo's `0.68` default. The response includes `historyCount` and a `historySources` breakdown (`pocketbase`, `legacySanity`).

For a Sanity `siteId`, Dashpoc also queries the site's existing `blog` documents using the existing `pages_config` contract (`page_id = projectId:dataset`, optional `access_token`). It deliberately excludes translated documents with `!defined(translationOf)`, matching Skillgo's trend duplicate check. This dependency is fail-closed: an invalid configuration or unavailable Sanity history returns `500` and no recommendation is claimed.

## Review a topic

```http
POST /api/v1/content-planning/topics/<topic-id>/review

{
  "siteId": "optional-pages-config-id",
  "action": "approve"
}
```

`action` is `approve` or `reject`. The workflow checks record ownership and only permits the Skillgo-compatible state transitions.

## Add an approved topic to a content plan

```http
POST /api/v1/content-planning/plans/<plan-id>/items/from-topic

{
  "topicId": "trend-topic-id",
  "contentType": "blog",
  "scheduledAt": "2026-08-10T03:00:00.000Z"
}
```

The plan and topic must belong to the authenticated tenant and the same site. Only an `approved` topic can enter a `draft` or `active` plan. A new item starts as `queued`, then the topic becomes `consumed`. Repeated or concurrent requests return the existing unique plan item instead of duplicating it.

For human review clients, use the combined operation instead of issuing review and plan-entry requests separately:

```http
POST /api/v1/content-planning/topics/<topic-id>/approve-to-plan

{
  "planId": "content-plan-id",
  "contentType": "blog",
  "scheduledAt": "2026-08-10T03:00:00.000Z"
}
```

This checks topic, plan, tenant and site ownership, approves the topic, and adds it to the plan through one compensated workflow. If plan entry fails before leaving a live item, the topic returns to its prior review state. Telegram and the Composer dashboard both use this operation.

## Assign cadence slots to a content plan

```http
POST /api/v1/content-planning/plans/<plan-id>/schedule

{
  "horizonDays": 90
}
```

Only an `active` plan owned by the authenticated tenant can be scheduled. `cadence_json` uses `{ "days": ["all"], "times": ["03:00"] }` (or `sun` through `sat`) and times are interpreted in the plan's IANA `timezone`. The scheduler processes unscheduled `queued` items FIFO, leaves their workflow status unchanged, skips occupied slots, and atomically claims both the item and `(plan, slot)` before assigning `scheduled_at`. `horizonDays` is optional and must be an integer from 1 through 366.

To preserve Skillgo exactly, initialize the migration plan with timezone `UTC` and daily time `03:00`. This endpoint is explicit only; no Dashpoc cron has been enabled.

## Generate a blog draft

```http
POST /api/v1/content-planning/items/<item-id>/generate
{}
```

Only tenant-owned `blog` items in `queued` or `scheduled` state are accepted. The endpoint atomically claims the item, generates the Skillgo-compatible structured draft, resolves published related posts (series first, then tag), creates one canonical PocketBase post and one target for the selected site, and returns `201`. Repeating a completed request returns the existing post with `200`.

The canonical post also stores a versioned `content_json` document. This is the translation source of truth so headings, paragraphs, image alt text and labels can be translated without mutating code, media URLs, internal slugs or Wikipedia URLs.

### `POST /api/v1/content-planning/items/:id/translate`

Translates a generated blog into every locale configured in the tenant-owned site's `translation_languages_json`. The source locale is `default_language`; it is never translated into itself. Supported parity locales are `en`, `vi`, `ja`, `es`, `fr`, `ko`, and `zh`.

Jobs are idempotent per source post, site and target locale. Target locales execute independently in parallel. A completed locale is reused on retry, while a failed locale can be retried. `dependencies_ready` becomes `true` only when every required locale completes; a partial failure returns `502` and keeps publishing closed. A site with no target locales is marked `not_required` without calling AI.

Content Planning posts cannot be approved through the existing posts approval endpoint until this dependency gate is ready. Posts created outside Content Planning retain their existing approval behavior.

### `POST /api/v1/content-planning/items/:id/approve`

Approves the source post and every required translated post together after human review. The workflow rechecks tenant/site ownership, the dependency gate and the presence of every configured locale before changing any pending target. If a later target update fails, earlier target updates are compensated back to `pending`; an incomplete compensation is reported for manual reconciliation.

If the dependency gate is not ready, the endpoint returns `409` with `error` and structured `details`; it never changes a post or publish target in this case.

The publish dispatcher independently rechecks the same dependency gate before claiming a Content Planning target. A target whose dependencies are not ready remains `approved` or `scheduled` and is retried later; it is not mislabeled as a publishing error. Legacy posts remain outside this additional gate.

## Import GSC/GA4 performance snapshots

```http
POST /api/v1/content-planning/analytics/import

{
  "siteId": "pages-config-id",
  "snapshots": [{
    "source": "gsc",
    "externalKey": "https://example.com/blog/topic-a",
    "url": "https://example.com/blog/topic-a",
    "windowStart": "2026-07-01",
    "windowEnd": "2026-07-31",
    "metrics": { "clicks": 20, "impressions": 400, "ctr": 0.05, "position": 4.5 },
    "dimensions": { "query": "topic a" }
  }]
}
```

`source` is `gsc` or `ga4`. GA4 metrics are `sessions`, `engagedSessions`, and `conversions`. A request accepts 1–500 normalized snapshots. Identity is deterministic per provider, external key and observation window, so retries and concurrent imports do not duplicate records. Records and reads are always scoped by the authenticated tenant and an owned `pages_config` site.

Pure adapters under `src/adapters/analytics/` convert official Search Console `rows[].keys` responses (using the request's dimension order) and GA4 `dimensionHeaders`/`metricHeaders` responses into this normalized payload. They perform no network or OAuth operation and fail closed when response columns do not match the request/header contract.

```http
GET /api/v1/content-planning/analytics/insights?siteId=<pages-config-id>&source=gsc
```

The optional source filter is `gsc` or `ga4`. The response contains aggregate totals and derived CTR, engagement rate and conversion rate. It explicitly returns `advisoryOnly: true`: this phase does not alter Skillgo-compatible ranking, duplicate detection or cadence. Provider credential/OAuth collectors and approved recommendation weighting are separate cutover gates.

### `POST /api/v1/content-planning/items/:id/reject`

Rejects a tenant-owned item only while it is in `draft` or `review`, matching Skillgo's hard-delete draft action. The workflow fails closed if any source or translated target is already `publishing` or `published`, marks the item `cancelled`, then deletes translated posts before the source post and clears `post_id`. PocketBase relation cascades remove their targets and media.

PocketBase does not provide a multi-record transaction for this REST flow. If deletion stops partway through, the item remains cancelled, the surviving record IDs and failure are stored for manual reconciliation, and the endpoint returns `409` instead of reopening or publishing an incomplete draft.

Section SVGs are generated and uploaded in parallel. The cover SVG is generated after the canonical post and attached through `media`; section and cover failures are best-effort and do not fail the draft. A required generation failure restores the previous state; a failed queued item receives `order = -1`, while a scheduled item retains its schedule/order.

## Current error contract

- `400`: malformed JSON, invalid trend report, analytics snapshot/source, action, or recommendation threshold.
- `401`: missing or invalid tenant API key (handled by the existing `/api/v1` router).
- `403`: `siteId` is missing from `pages_config` or belongs to another tenant.
- `404`: route not found.
- `409`: invalid workflow state, a plan that is not `active`, publishing already in progress, or incomplete rejection cleanup requiring reconciliation.
- `503`: blog generation AI is not configured.
- `500`: unexpected workflow/infrastructure failure, including unavailable required legacy Sanity history. No recommendation claim is written when history collection fails.
### Sanity publishing profile

Content Planning posts targeting the current Skillgo Sanity dataset require this value on the matching `pages_config.extra_config` record:

```json
{"contentPlanningProfile":"skillgo-blog-v1"}
```

The worker fails closed when this profile is absent. With the profile enabled it writes the exact Skillgo `blog` schema, including `thumb`, `seriesId`, language, `translationOf`, SEO fields and Portable Text section images. Legacy, non-Content-Planning Sanity posts retain the existing generic schema adapter.
