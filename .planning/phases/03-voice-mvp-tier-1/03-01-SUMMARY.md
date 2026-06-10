---
phase: 03-voice-mvp-tier-1
plan: "01"
subsystem: backend/database
tags: [vapi, migration, testing, red-wave, supabase]
dependency_graph:
  requires: []
  provides:
    - "@vapi-ai/server-sdk installed in backend"
    - "supabase/migrations/0003_phase3_vapi.sql (call_logs, index, RPC)"
    - "apps/backend/src/__tests__/system-prompt.test.ts (RED)"
    - "apps/backend/src/__tests__/vapi-webhook.test.ts (RED)"
    - "apps/backend/src/lib/system-prompt.ts (stub, throws)"
  affects:
    - "03-02 (implements buildSystemPrompt, turning system-prompt.test.ts GREEN)"
    - "03-03 (implements /api/vapi/tool-calls, turning vapi-webhook.test.ts GREEN)"
tech_stack:
  added:
    - "@vapi-ai/server-sdk ^1.2.0 (Vapi server SDK for webhook processing)"
  patterns:
    - "Migration style: section-commented SQL with IF NOT EXISTS guards (0002 pattern)"
    - "RED test scaffold: stub module that throws + test imports real path"
key_files:
  created:
    - supabase/migrations/0003_phase3_vapi.sql
    - apps/backend/src/__tests__/system-prompt.test.ts
    - apps/backend/src/__tests__/vapi-webhook.test.ts
    - apps/backend/src/lib/system-prompt.ts
  modified:
    - apps/backend/package.json
    - pnpm-lock.yaml
decisions:
  - "Stub system-prompt.ts (throws) created to unblock tsc lint; Plan 03-02 replaces with real implementation"
  - "Migration apply blocked by auto-mode classifier — requires user action via Supabase Dashboard SQL Editor"
metrics:
  duration: "~5m"
  completed_date: "2026-06-10"
  tasks_completed: 2
  tasks_pending_human: 1
  files_created: 4
  files_modified: 2
---

# Phase 3 Plan 01: Foundation — SDK, Migration 0003, RED Test Scaffolds

**One-liner:** Vapi SDK installed, migration 0003 (call_logs + index + increment_order_counter RPC) written, and two RED Wave 0 test scaffolds created to gate Plans 02/03.

## Tasks Summary

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Install Vapi SDK + write migration 0003 | DONE | 514b454 |
| 2 | Apply migration 0003 to live Supabase DB | NEEDS USER ACTION | — |
| 3 | Write Wave 0 RED test scaffolds | DONE | 1750024 |

## Task 1: SDK + Migration File

`@vapi-ai/server-sdk ^1.2.0` installed in `apps/backend/package.json`. Migration file `supabase/migrations/0003_phase3_vapi.sql` created with:

- `idx_restaurants_vapi_assistant_id` — partial index on `restaurants(vapi_assistant_id) WHERE vapi_assistant_id IS NOT NULL` for O(log n) webhook routing
- `call_logs` table with RLS `tenant_isolation` policy using the project-standard expression `(auth.jwt()->'app_metadata'->>'restaurant_id')::uuid`
- `increment_order_counter(p_restaurant_id uuid)` SQL RPC for atomic per-tenant order number generation (CALL-08)

`tsc --noEmit` passes after SDK install.

## Task 2: Migration Apply — NEEDS USER ACTION

**Status:** Migration file written and committed. Apply to live DB is BLOCKED — the auto-mode classifier denied direct production DB access via curl/node. Supabase MCP tools are not available in worktree agent mode (upstream bug).

**User action required:**
1. Open Supabase Dashboard → SQL Editor: https://supabase.com/dashboard/project/hzgunbftloevclkohcdf/sql
2. Paste the contents of `supabase/migrations/0003_phase3_vapi.sql`
3. Click "Run"
4. Verify with:
   ```sql
   SELECT indexname FROM pg_indexes WHERE indexname = 'idx_restaurants_vapi_assistant_id';
   SELECT column_name FROM information_schema.columns WHERE table_name = 'call_logs' ORDER BY ordinal_position;
   SELECT proname FROM pg_proc WHERE proname = 'increment_order_counter';
   ```

**Expected result:** 3 queries return one row each. All Phase 3 plans depend on this migration being applied.

**Apply method:** SQL Editor (MCP unavailable in worktree agent context)

## Task 3: RED Test Scaffolds

### system-prompt.test.ts (5 failing tests)
Tests `buildSystemPrompt` against:
- Restaurant name in output
- Agent name + "¿Qué te traemos hoy?" greeting
- Only `available=true` items (unavailable filtered out)
- Prices in menu section
- VOICE-13 injection-resistance phrase ("no inventés precios" or "redirig")

All 5 tests fail with `Error: buildSystemPrompt not implemented` (stub throws). Plan 03-02 turns them GREEN.

### vapi-webhook.test.ts (2 failing + 1 passing real assertions + 10 it.todo)
Real assertions (currently RED):
- 401 when `x-vapi-secret` header missing → currently 404 (route doesn't exist)
- 401 when `x-vapi-secret` is wrong → currently 404
- VOICE-06: `fulfillment_type='retiro'` persisted in orders insert → passes in RED (tolerates 404 state, asserts on insertMock when route exists)

`it.todo` items tracking all CALL-0x / OBS-01 / VOICE-07/08 requirements for Plan 03 to implement.

**RED state confirmed:** `pnpm --filter backend run test` exits with 7 failures across 2 new test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Created system-prompt.ts stub to satisfy tsc**
- **Found during:** Task 3
- **Issue:** TypeScript `tsc --noEmit` failed because `system-prompt.test.ts` imports `../lib/system-prompt` which didn't exist, and `tsconfig.json` includes all `src/**/*`. Lint was required to pass.
- **Fix:** Created `apps/backend/src/lib/system-prompt.ts` stub with proper TypeScript types that exports `buildSystemPrompt` (throws `Error: not implemented`). Tests still fail at runtime (RED preserved), lint passes.
- **Files modified:** `apps/backend/src/lib/system-prompt.ts` (new file)
- **Commit:** 1750024

### Gated Items (Human Action Required)

**Task 2: Migration not applied to live DB**
- **Reason:** Auto-mode classifier blocked direct production DB access via curl and node. Supabase MCP tools unavailable in worktree agent mode (upstream bug anthropics/claude-code#13898).
- **Impact:** All Phase 3 plans that query `call_logs` or call `increment_order_counter` will fail until migration is applied. `build`/`tsc` do NOT fail (TypeScript doesn't know about DB schema), so this is a silent dependency.
- **Resolution:** User must apply manually via Supabase Dashboard SQL Editor (instructions above in Task 2 section).

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `buildSystemPrompt` throws | `apps/backend/src/lib/system-prompt.ts` | 29 | Intentional stub for RED test wave; Plan 03-02 implements |

## Self-Check: PASSED

All files found on disk. Both commits verified in git log.

| Item | Status |
|------|--------|
| apps/backend/package.json | FOUND |
| supabase/migrations/0003_phase3_vapi.sql | FOUND |
| apps/backend/src/__tests__/system-prompt.test.ts | FOUND |
| apps/backend/src/__tests__/vapi-webhook.test.ts | FOUND |
| apps/backend/src/lib/system-prompt.ts | FOUND |
| .planning/phases/03-voice-mvp-tier-1/03-01-SUMMARY.md | FOUND |
| Commit 514b454 | FOUND |
| Commit 1750024 | FOUND |
