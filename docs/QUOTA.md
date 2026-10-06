# Account quota enforcement

Tenant workspaces charge their active owner's account. An account-scoped
`AccountQuota` Durable Object serializes reservations across workspaces before
paid provider requests. Missing ownership, unavailable quota storage, failed
PocketBase updates, and exhausted quota block the provider call. Exhaustion
returns HTTP 429. An explicit limit of zero disables paid usage.

Usage is counted in operations, not dollars or tokens. A reserved operation may
contain multiple provider calls. Reservations remain charged on provider failure
because the provider may already have incurred cost. Public chat also has rate
limits; these do not replace a realistic monthly limit or provider spending cap.

Counters reset by UTC calendar month. Within a month, enforcement takes the
maximum of the durable counter and the PocketBase counter. Lowering the database
counter alone does not refund usage. Limit changes still apply immediately.

Dashboard message reads use the authenticated `/api/account/messages` endpoint,
which checks account membership before reading a workspace's records. Marketplace
AI conversations now persist user and assistant messages. The message page polls
while visible to supplement realtime delivery.

## Production verification — 2026-09-27

- Worker version: `bec967f4-c4e1-4763-b4c5-65ab46a0076e`.
- Pages deployment: `18e0a2f2` (shared authentication script cache invalidated).
- Test suite: 218 passed, including concurrent quota reservations and cross-account
  message access rejection.
- Two live requests in `reschoolsai`: account usage increased from 201 to 203;
  message log and overview showed four messages and one conversation.
- Both live AI requests failed and generated persisted human-handoff responses.
  Provider response health remains unresolved; quota/logging verification does
  not establish successful AI generation.
- The tested account still has a configured limit of 999,999,999 operations per
  month. The owner must choose a practical cap before relying on it for public
  cost protection. No account limit was changed during this verification.

Older missing messages cannot be reconstructed by this change.

## Cost weights

1 unit = one text chat reply. Weights live in
`worker-chat-d/knowledge-worker/src/domain/billing/costs.js` (`COST_TABLE`).

| Operation | Units |
|---|---|
| Chat reply (including knowledge/RAG lookup) | 1 |
| Post text generation | 2 |
| AI image | 8 (post + one AI image = 10) |
| AI video | 0 (customer's own external API) |
| Voice greeting | 1 |
| Voice turn | 4 per minute, billed per 15 s, minimum 1 |
| Document embedding | `ceil(tokens / 5000)`, min 1, max 20 per document (tokens ≈ chars / 4) |

Document embedding is charged once before the provider call. Re-embedding and
storage limits per plan are not implemented yet.
