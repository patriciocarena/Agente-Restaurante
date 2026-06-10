---
phase: 03-voice-mvp-tier-1
plan: "03"
subsystem: backend/webhook
tags: [vapi, webhook, orders, call-logs, security, idempotency, multi-tenant]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: ["POST /api/vapi/tool-calls", "POST /api/vapi/end-of-call-report handling", "orders persistence", "call_logs persistence"]
  affects: ["apps/backend/src/routes/vapi-webhook.ts", "apps/backend/src/index.ts"]
tech_stack:
  added: []
  patterns:
    - "X-Vapi-Secret header auth gate (CALL-01)"
    - "Idempotency by call_id UNIQUE pre-insert check (CALL-02)"
    - "assistantId → vapi_assistant_id tenant routing (CALL-03)"
    - "Server-side menu validation + unit_price/total recalc from DB (CALL-04/05/06)"
    - "Server-side business hours check via America/Argentina/Cordoba timezone (CALL-07)"
    - "Per-tenant atomic order_number via increment_order_counter RPC (CALL-08)"
    - "Transcript writeback to orders on end-of-call-report (CALL-09)"
    - "call_logs upsert on end-of-call-report (OBS-01)"
    - "PII guard: customer_phone stored in DB but never passed to logger (T-03-09)"
key_files:
  created:
    - apps/backend/src/routes/vapi-webhook.ts
  modified:
    - apps/backend/src/index.ts
    - apps/backend/src/__tests__/health.test.ts
    - apps/backend/src/__tests__/restaurants.test.ts
    - apps/backend/src/__tests__/menu-categories.test.ts
    - apps/backend/src/__tests__/menu-items.test.ts
decisions:
  - "Business hours: if no restaurant_hours row found for the day, treat as open 24/7 (defensive default)"
  - "order_items insert failure is non-fatal: order was already created, caller gets success response; DB inconsistency logged as error"
  - "end-of-call-report for unknown restaurant returns 200 (not 4xx) — Vapi does not retry 200 responses"
metrics:
  duration_minutes: 12
  tasks_completed: 2
  files_changed: 6
  completed_at: "2026-06-10T13:32:26Z"
requirements_satisfied: [CALL-01, CALL-02, CALL-03, CALL-04, CALL-05, CALL-06, CALL-07, CALL-08, CALL-09, VOICE-06, VOICE-07, VOICE-08, VOICE-11, OBS-01]
---

# Phase 3 Plan 03: Vapi Webhook Handler Summary

**One-liner:** Webhook handler securing the core-value path with X-Vapi-Secret auth, assistantId tenant routing, server-side menu/price validation, idempotent order creation via call_id, and OBS-01 call_logs + CALL-09 transcript writeback on end-of-call-report.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | routes/vapi-webhook.ts — tool-calls + end-of-call-report | 3aecd01 | apps/backend/src/routes/vapi-webhook.ts (425 lines, created) |
| 2 | Mount webhook in index.ts + VAPI_* to REQUIRED_ENV | bdf9e5c | apps/backend/src/index.ts + 4 test files (env stub fix) |

## What Was Built

`apps/backend/src/routes/vapi-webhook.ts` — the core-value path of the entire system. A single POST route at `/api/vapi/tool-calls` that handles both Vapi event types:

**tool-calls (confirm_order):**
1. **CALL-01** X-Vapi-Secret check → 401 on missing or wrong secret
2. **CALL-03** `assistantId` → `restaurants.vapi_assistant_id` lookup for tenant routing
3. **CALL-02** Pre-insert `call_id` idempotency check → returns existing `order_number` without DB write
4. **CALL-07/VOICE-11** Server-side business hours check in `America/Argentina/Cordoba` (UTC-3, no DST) — no order created when closed
5. **CALL-04/05/06** Menu validation: each arg item matched case-insensitively against `available=true` items; `unit_price = base_price + sum(modifier price_deltas)`; `total = sum(qty * unit_price)` — LLM prices never trusted
6. **CALL-08** `increment_order_counter(p_restaurant_id)` RPC for per-tenant atomic order numbering
7. **CALL-09/VOICE-06/07/08** Explicit-whitelist insert into `orders` (no `...args` spread) + `order_items` rows; `customer_phone` (PII) stored in DB but never logged
8. `transcript: null` at insert time — written back on end-of-call-report

**end-of-call-report (OBS-01 + CALL-09):**
1. Same `assistantId` → tenant routing
2. Compute `duration_seconds` from `call.startedAt` / `call.endedAt`
3. `call_logs` upsert (on conflict `call_id`) with cost, transcript, ended_reason
4. CALL-09 transcript writeback: `orders.update({ transcript }).eq('call_id', callId)` — only if transcript non-null and order exists

`apps/backend/src/index.ts` — added `vapiWebhookRouter` import, `app.use('/api/vapi', vapiWebhookRouter)` (no `requireAuth`), and extended `REQUIRED_ENV` with `VAPI_API_KEY` and `VAPI_WEBHOOK_SECRET`.

## Verification Results

```
Test Files  10 passed | 3 skipped (13)
     Tests  41 passed | 11 skipped | 10 todo (62)
```

- `pnpm --filter backend run test vapi-webhook` — 3 passed, 10 todo (GREEN)
- `pnpm --filter backend run test` — full suite 10 passed, 0 failed (GREEN)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] REQUIRED_ENV extension broke existing test files**
- **Found during:** Task 2 verification
- **Issue:** Adding `VAPI_API_KEY` and `VAPI_WEBHOOK_SECRET` to `REQUIRED_ENV` caused `process.exit(1)` in 4 existing test files (health, restaurants, menu-categories, menu-items) that did not set those env vars before importing the app. The plan note "adding them to REQUIRED_ENV will not break the test runner" was incorrect — it only held for the vapi-webhook test file which did set them.
- **Fix:** Added `process.env.VAPI_API_KEY ??= 'fake_for_test'` and `process.env.VAPI_WEBHOOK_SECRET ??= 'fake_for_test'` to the 4 affected test files, consistent with the `??=` pattern already used throughout the test suite.
- **Files modified:** apps/backend/src/__tests__/health.test.ts, restaurants.test.ts, menu-categories.test.ts, menu-items.test.ts
- **Commit:** bdf9e5c

## Threat Surface Scan

All security surfaces were pre-planned in the `<threat_model>`:

| Threat | Mitigation Implemented |
|--------|------------------------|
| T-03-06 Spoofing (fake webhook) | X-Vapi-Secret header check → 401 |
| T-03-07 Duplicate order via retry | call_id UNIQUE pre-insert idempotency check |
| T-03-08 LLM price tampering | unit_price from DB base_price + option_items.price_delta only |
| T-03-09 PII (customer_phone) in logs | customerPhone stored in DB, never passed to logger.* |
| T-03-10 Cross-tenant via spoofed assistantId | All inserts scoped to restaurant resolved by vapi_assistant_id |
| T-03-11 Out-of-hours order bypass | Server-side hours check independent of LLM |

No new security surfaces introduced beyond plan scope.

## Known Stubs

None. All fields are wired to real data sources. `transcript: null` at order insert time is intentional by design — populated by end-of-call-report handler per CALL-09.

## Self-Check

### Files Exist
- [x] apps/backend/src/routes/vapi-webhook.ts — FOUND
- [x] apps/backend/src/index.ts — FOUND (modified)

### Commits Exist
- [x] 3aecd01 — feat(03-03): implement vapi-webhook.ts — FOUND
- [x] bdf9e5c — feat(03-03): mount vapiWebhookRouter in index.ts + fix VAPI env — FOUND

## Self-Check: PASSED
