# Cross-Layer Delivery Checklist

Use this checklist when a spec touches more than one layer: API, authentication,
authorization, database, transactions, cache, queue, background job, upload,
webhook, real-time channel, or production hardening.

It is a design/verification aid, not a second workflow. Do not create a new
skill or command for it.

## Design

1. **Contract** — request/response shape, validation, error semantics,
   idempotency, pagination, compatibility, and versioning.
2. **Trust boundary** — who authenticates, who authorizes, what is public, what
   is tenant-scoped, and what is never logged.
3. **Data ownership** — which layer owns each state transition; what is
   authoritative; what is derived or cached.
4. **Transactions** — explicit boundaries; partial-failure behavior; retry
   safety; duplicate submission behavior.
5. **Migration** — additive and reversible first; backfill plan; uniqueness,
   indexes, concurrency, retention, rollback.
6. **Asynchrony** — queue/cache/upload/webhook/SSE/WebSocket ownership, expiry,
   delivery guarantee, reconnection, and failure recovery.
7. **Operations** — timeouts, bounded retries with backoff, typed errors,
   structured logs, metrics, and rollback.

## Implementation and verification

8. **Smallest vertical slice** — persistence, domain, API, client state, and
   observable result for one coherent user outcome.
9. **Security** — no secrets, tokens, credentials, or sensitive payloads in
   code, logs, errors, fixtures, or examples.
10. **Tests** — success, validation failure, permission failure, concurrency,
    boundary, and retry/duplicate paths.
11. **Compatibility** — existing callers, stored data, generated contracts, and
    type checks still pass.
12. **Unverified boundaries** — name any external service, credential, or
    environment that blocked end-to-end validation. Do not claim a pass.

## Rollback

For every irreversible or compatibility-breaking change, record:

- the rollback step;
- the data that would be lost or need repair;
- how the rollback itself is verified.

If rollback is unsafe, stop before applying the change and present the safer
alternative.
