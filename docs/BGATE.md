# BGate checkout integration

API reference: https://billing.schoolsai.work/docs/

The dashboard uses its PocketBase session token for GET
`/api/account/billing/plans`, POST `/api/account/billing/checkout`, and GET
`/api/account/billing/payments/{order_id}`. The Worker refreshes the token to
resolve account identity. Product, provider, amount and currency are server-owned;
the browser never receives the API key. Payment lookup checks order ownership.

## Configuration

Secrets (`wrangler secret put`): `BGATE_API_KEY`, `BGATE_CATALOG_JSON`, and
`BGATE_WEBHOOK_SECRET` (optional until the webhook is registered). Locally they live in the
ignored `worker-chat-d/knowledge-worker/.dev.vars`.

Whop only. Catalog (prices are server-owned):

| id | product | amount | notes |
|---|---|---|---|
| monthly | schoolsai-pro-monthly | 19 USD | `billing_interval: monthly`, Whop auto-renew |
| yearly | schoolsai-pro-yearly | 199 USD | `billing_interval: yearly` |
| addon | schoolsai-messages-1000 | 7 USD | `kind: addon`, one-off, +1000 messages |

Required PocketBase fields on `tenants` (create with `POST /tenants/setup-billing-fields`,
`X-Admin-Secret`): `pro_expires_at`, `message_bonus_granted`, `message_bonus_used`, `bonus_orders`.
Without them activation fails closed.

## Fulfillment

- **Pro**: after a `paid` order that matches the catalog, the worker reads
  `GET /entitlements/{account}/{product}`. Only `active: true` with a future `expires_at` sets
  `plan_id=pro` and `pro_expires_at`. Past expiry the account is treated as Free (100 chat/month,
  100 MB). Sync runs on payment check, on opening the billing page, from the webhook, and lazily
  when an expired Pro account chats (throttled 10 min).
- **Add-on**: a `paid` matching order credits 1000 messages once per order id
  (`bonus_orders` is the replay guard). Credits never expire and are spent after the monthly
  limit (`message_bonus_granted` is raised by the worker, `message_bonus_used` by the quota object).
- **Webhook**: `POST https://apic.schoolsai.work/api/billing/bgate-webhook`; HMAC-SHA256 over
  `timestamp.raw_body`, 5-minute window. The payload only triggers an entitlement re-read.
- A browser redirect is never proof of payment.

## Live smoke check — 2026-09-29

- Arbitrary USDT product `schoolsai-integration-check`, nominal amount 1 USDT.
- POST checkout: HTTP 201, order `3e3250c1-bcab-4cc2-aae1-c367df89a584`, pending.
- Exact requested transfer amount: 1.009634 USDT on TRON/TRC20.
- Replay with the same idempotency key: HTTP 200, same order, no duplicate.
- GET payment: HTTP 200, pending.
- GET entitlement: HTTP 200, active false.
- No funds transferred; paid/fulfillment flow and Whop were not live-tested.
- Raw checkout response is stored under ignored `.wrangler/bgate/` locally.

## Validation

From `worker-chat-d/knowledge-worker`, run:

```sh
node --test test/bgate.test.js test/billing-usage.test.js
```

15 tests pass, covering account/price binding, idempotency, safe errors,
configuration, allowed providers, ownership checks, paid verification and existing
quota behavior. These automated tests mock BGate; the live smoke check above was
performed separately. Full authenticated browser and production deployment remain
untested.
