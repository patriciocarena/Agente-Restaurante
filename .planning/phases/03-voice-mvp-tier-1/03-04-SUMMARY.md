---
phase: 03-voice-mvp-tier-1
plan: "04"
subsystem: backend-vapi-wiring
tags: [vapi, onboarding, menu, fire-and-forget, ONB-05, MENU-05]
dependency_graph:
  requires: ["03-01 (DB schema, menu routers)", "03-02 (lib/vapi.ts exports)"]
  provides: ["Vapi assistant created on onboarding finish", "Menu mutations trigger prompt resync"]
  affects: ["apps/backend/src/routes/onboarding.ts", "apps/backend/src/routes/menu-items.ts", "apps/backend/src/routes/menu-categories.ts"]
tech_stack:
  added: []
  patterns: ["fire-and-forget .catch()", "non-blocking try/catch for Vapi (T-03-12)", "idempotent retry on vapi_assistant_id null"]
key_files:
  created: []
  modified:
    - apps/backend/src/routes/onboarding.ts
    - apps/backend/src/routes/menu-items.ts
    - apps/backend/src/routes/menu-categories.ts
    - apps/backend/src/__tests__/menu-items.test.ts
decisions:
  - "Sync call placed BEFORE the success return (not after) so it executes before response is sent"
  - "syncAssistantPrompt swallows its own errors internally; .catch() is belt-and-suspenders"
  - "Idempotent onboarding retry: if vapi_assistant_id is null on /finish repeat call, recreate assistant"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-10T13:33:25Z"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 4
---

# Phase 3 Plan 04: Vapi Wiring (ONB-05 + MENU-05) Summary

**One-liner:** Wired createVapiAssistant into onboarding /finish and syncAssistantPrompt fire-and-forget into all 7 menu mutation paths, making the voice assistant reflect the live menu.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | onboarding.ts — create Vapi assistant on finish (ONB-05) | 86549a9 | apps/backend/src/routes/onboarding.ts |
| 2 | menu-items.ts + menu-categories.ts — fire-and-forget resync (MENU-05) | 6435f63 | apps/backend/src/routes/menu-items.ts, menu-categories.ts, menu-items.test.ts |

## Task 3: Checkpoint (RESOLVED 2026-06-11)

**Status:** Complete — all manual setup items resolved during orchestrator session:

- Migration 0003 applied to live Supabase via MCP (user-authorized): `call_logs`, `idx_restaurants_vapi_assistant_id`, `increment_order_counter` — all verified present
- "wonder" dev hours seeded: 7 days open 00:00–23:59 (`is_closed = false` verified)
- `VAPI_API_KEY` + `VAPI_WEBHOOK_SECRET` set on Railway via CLI (secret newly generated, also written to local `.env`)
- Phase 3 code deployed to Railway (deployment `d3f90258`, Node 24): webhook `/api/vapi/tool-calls` live, returns 401 without secret
- Deploy fixes required along the way: vapi.ts SDK type errors (817bb6d), node>=22 engines (e242972)

## What Was Built

### Task 1 — ONB-05: onboarding.ts

- Added `import { createVapiAssistant } from '../lib/vapi'`
- Extended the `/finish` select to include `name, agent_name, vapi_assistant_id`
- After successful Twilio provision + restaurant UPDATE, calls `createVapiAssistant` in a try/catch and persists the returned `assistantId` to `restaurants.vapi_assistant_id`
- Failure logs via `logger.error` but does NOT rethrow — Twilio provision is the critical path
- Idempotent early-return branch: if `onboarding_step >= 4` but `vapi_assistant_id` is null (e.g. Vapi was down on original finish), retries assistant creation

### Task 2 — MENU-05: menu-items.ts + menu-categories.ts

- Added imports: `syncAssistantPrompt` from `../lib/vapi` and `logger` from `../lib/logger` in both files
- Inserted fire-and-forget call before each success-path return:
  - `menu-items.ts`: POST / (201), PATCH /:id (200), DELETE /:id (204), PATCH /:id/availability (200) — **4 call sites**
  - `menu-categories.ts`: POST / (201), PATCH /:id (200), DELETE /:id (204) — **3 call sites**
- Pattern: `syncAssistantPrompt(req.restaurantId).catch((err) => { logger.error(...) })` — never awaited
- `menu-items.test.ts`: Added `vi.mock('../lib/vapi')` with mock resolving fns; added MENU-05 wiring assertion test

## Verification Results

```
pnpm --filter backend run test menu-items
  Test Files  1 passed (1)
       Tests  9 passed (9)
```

Full suite: 40 passed, 2 failed (vapi-webhook 401 tests — pre-existing failures from plan 03-03, not caused by this plan).

Grep checks:
- `grep -c "syncAssistantPrompt(req.restaurantId)" menu-items.ts` → 4
- `grep -c "syncAssistantPrompt(req.restaurantId)" menu-categories.ts` → 3
- `grep "await syncAssistantPrompt"` → no results (correct — fire-and-forget)

## Deviations from Plan

None — plan executed exactly as written for Tasks 1 and 2.

The pre-existing TS errors in `lib/vapi.ts` (type incompatibilities from the Vapi SDK) are out of scope — they existed in commit b0b48dc before this plan's changes and belong to plan 03-02.

## Known Stubs

None introduced by this plan.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Changes are purely additive wiring to existing routes already behind `requireAuth` middleware.

- T-03-12 (Vapi outage DoS): mitigated — all Vapi calls wrapped in try/catch or .catch(), non-blocking
- T-03-13 (cross-tenant): mitigated — `syncAssistantPrompt(req.restaurantId)` uses JWT-derived restaurantId; onboarding update scoped by `owner_id` + `id`

## Checkpoint: Task 3 Status

**Type:** checkpoint:human-action  
**Status:** Blocked — awaiting two manual setup steps

### A) Railway env vars (D-03)

`VAPI_API_KEY` and `VAPI_WEBHOOK_SECRET` need to be set on the Railway backend service. Claude attempted Railway CLI but cannot authenticate autonomously.

**Manual steps:**
1. Open Railway dashboard → backend service → Variables
2. Add `VAPI_API_KEY` = (value from `apps/backend/.env`)
3. Add `VAPI_WEBHOOK_SECRET` = (value from `apps/backend/.env`)
4. Redeploy the service
5. Verify: `railway variables` output shows both vars

### B) Dev business hours for "wonder" restaurant (D-02)

Restaurant ID `64e86521-7aaa-426a-82f4-d26f82680d63` needs open hours 00:00–23:59 all 7 days so web-call tests aren't blocked by CALL-07.

**SQL to run in Supabase SQL Editor:**
```sql
INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
VALUES
  ('64e86521-7aaa-426a-82f4-d26f82680d63', 0, '00:00', '23:59', false),
  ('64e86521-7aaa-426a-82f4-d26f82680d63', 1, '00:00', '23:59', false),
  ('64e86521-7aaa-426a-82f4-d26f82680d63', 2, '00:00', '23:59', false),
  ('64e86521-7aaa-426a-82f4-d26f82680d63', 3, '00:00', '23:59', false),
  ('64e86521-7aaa-426a-82f4-d26f82680d63', 4, '00:00', '23:59', false),
  ('64e86521-7aaa-426a-82f4-d26f82680d63', 5, '00:00', '23:59', false),
  ('64e86521-7aaa-426a-82f4-d26f82680d63', 6, '00:00', '23:59', false)
ON CONFLICT (restaurant_id, day_of_week)
DO UPDATE SET open_time = '00:00', close_time = '23:59', is_closed = false;
```

**Resume signal:** Type "done" once Railway vars are set and the wonder hours query returns 7 open rows.

## Self-Check: PASSED

All files present:
- apps/backend/src/routes/onboarding.ts — FOUND
- apps/backend/src/routes/menu-items.ts — FOUND
- apps/backend/src/routes/menu-categories.ts — FOUND
- apps/backend/src/__tests__/menu-items.test.ts — FOUND
- .planning/phases/03-voice-mvp-tier-1/03-04-SUMMARY.md — FOUND

All commits present:
- 86549a9 feat(03-04): wire createVapiAssistant into onboarding POST /finish (ONB-05) — FOUND
- 6435f63 feat(03-04): wire syncAssistantPrompt fire-and-forget into menu mutations (MENU-05) — FOUND
