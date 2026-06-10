---
phase: 03
slug: voice-mvp-tier-1
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-09
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `apps/backend/vitest.config.ts` (or package.json `test` script) — already present from Phases 1/2 |
| **Quick run command** | `pnpm --filter backend run test` |
| **Full suite command** | `pnpm -r --if-present run test` |
| **Estimated runtime** | ~15-30 seconds (backend unit suite, supertest + mocked supabase) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter backend run test` (or scoped, e.g. `pnpm --filter backend run test vapi-webhook`)
- **After every plan wave:** Run `pnpm -r --if-present run test`
- **Before `/gsd-verify-work`:** Full suite (`pnpm -r --if-present run test`) must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CALL-02/03/08, OBS-01 | T-03-01 | RLS on call_logs uses project expression; SDK + migration written | grep | `grep -q '@vapi-ai/server-sdk' apps/backend/package.json && grep -q 'CREATE TABLE IF NOT EXISTS call_logs' supabase/migrations/0003_phase3_vapi.sql` | ✅ (file artifact) | ⬜ pending |
| 03-01-02 | 01 | 1 | CALL-02/03/08, OBS-01 | T-03-01 | Migration applied to live DB; call_logs RLS enabled | infra (manual) | SKIPPED — Supabase MCP list_tables + execute_sql (see plan) | N/A infra state | ⬜ pending |
| 03-01-03 | 01 | 1 | CALL-01..09, OBS-01, ONB-05, VOICE-13, VOICE-06 | T-03-06 | RED scaffolds reference real modules; 401 + VOICE-06 fulfillment_type are real assertions | unit (RED) | `pnpm --filter backend run test system-prompt` / `pnpm --filter backend run test vapi-webhook` (expected RED) | ❌ W0 (this task creates them) | ⬜ pending |
| 03-02-01 | 02 | 2 | ONB-05, MENU-05, VOICE-02/04/05/09/10/12/13 | T-03-04 | Prompt encodes injection resistance + price-free flow; greeting accented exactly | unit | `pnpm --filter backend run test system-prompt` | ❌ W0 (03-01-03) | ⬜ pending |
| 03-02-02 | 02 | 2 | VOICE-05, CALL-05 | T-03-03, T-03-05 | confirm_order has NO price fields; sync swallows Vapi errors | unit + grep | `pnpm --filter backend run lint && grep -q 'es-AR-ElenaNeural' apps/backend/src/lib/vapi.ts && ! grep -q 'unit_price' apps/backend/src/lib/vapi.ts` | ❌ W0 (lint/grep, no dedicated test) | ⬜ pending |
| 03-03-01 | 03 | 3 | CALL-01..09, VOICE-06/07/08/11, OBS-01 | T-03-06..11 | 401 on bad secret; server-side recalc; idempotency; no phone in logs; transcript writeback | unit | `pnpm --filter backend run test vapi-webhook` | ❌ W0 (03-01-03) | ⬜ pending |
| 03-03-02 | 03 | 3 | CALL-01 | T-03-06 | Webhook mounted publicly (no requireAuth); VAPI_* env enforced | unit (full suite) | `pnpm --filter backend run test` | ✅ (existing suite) | ⬜ pending |
| 03-04-01 | 04 | 3 | ONB-05 | T-03-12, T-03-13 | Assistant created on finish; failure logged not thrown; update scoped by owner_id | lint + grep | `pnpm --filter backend run lint && grep -q 'createVapiAssistant' apps/backend/src/routes/onboarding.ts` | ✅ (lint/grep) | ⬜ pending |
| 03-04-02 | 04 | 3 | MENU-05 | T-03-12 | Fire-and-forget resync on every menu mutation; menu edit unaffected by Vapi failure | unit | `pnpm --filter backend run test menu-items` | ❌ W0 (extend existing menu-items.test.ts) | ⬜ pending |
| 03-04-03 | 04 | 3 | — (D-02, D-03 setup) | T-03-14 | Railway secrets set; dev hours open — not in logs/client | infra (manual) | SKIPPED — Railway CLI `railway variables` + Supabase MCP (see plan) | N/A infra state | ⬜ pending |
| 03-05-01 | 05 | 4 | (pre-flight) | — | System callable: assistant exists, backend healthy, hours open | smoke | `curl -s -o /dev/null -w "%{http_code}" https://agente-restaurantebackend-production.up.railway.app/health` | ✅ (curl) | ⬜ pending |
| 03-05-02 | 05 | 4 | VOICE-01..13, CALL-09, OBS-01 | T-03-15, T-03-16 | Live web call → valid priced order; null phone accepted; injection/out-of-menu/out-of-hours refused | manual UAT | MANUAL — guided Vapi web call + Supabase verification (see Manual-Only table) | N/A manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/__tests__/vapi-webhook.test.ts` — RED stubs for CALL-01..09, OBS-01, VOICE-06/07/08 (created in 03-01-03; 401 cases + VOICE-06 fulfillment_type are real assertions, the rest `it.todo`)
- [ ] `apps/backend/src/__tests__/system-prompt.test.ts` — RED stubs for ONB-05, MENU-05, VOICE-13 (created in 03-01-03)
- [ ] Extend `apps/backend/src/__tests__/menu-items.test.ts` — add `vi.mock('../lib/vapi')` MENU-05 sync assertion (in 03-04-02)
- [ ] Install `@vapi-ai/server-sdk`: `pnpm --filter backend add @vapi-ai/server-sdk` (in 03-01-01)
- [ ] Set `VAPI_API_KEY` + `VAPI_WEBHOOK_SECRET` on Railway env (in 03-04-03; needed before end-to-end web-call test)

*Vitest framework + config already exist from Phases 1/2 — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live es-AR greeting + voice quality | VOICE-01, VOICE-02 | TTS audio cannot be asserted in a unit test; requires a human ear | Vapi Dashboard → wonder assistant → "Talk to Assistant"; confirm "Hola, te habla Sofía de Wonder. ¿Qué te traemos hoy?" in an AR voice (03-05 Scenario 1) |
| Full order taken + confirmed by voice | VOICE-03, VOICE-09, VOICE-10, CALL-09 | End-to-end speech flow through Vapi → Gemini → webhook; not unit-testable | 03-05 Scenario 1/2; verify order + order_items + null customer_phone + transcript in Supabase |
| Modifier price recalc on a live call | VOICE-05, CALL-05, CALL-06 | Requires real LLM args; unit test covers the recalc logic, UAT proves the live path | 03-05 Scenario 2; assert persisted total = server recalculation, not spoken figure |
| Out-of-menu refusal | VOICE-04 | LLM behavior over voice | 03-05 Scenario 3; no order row created |
| Prompt-injection resistance (live) | VOICE-13 | Adversarial LLM behavior over voice (prompt is the belt; unit test covers the prompt content) | 03-05 Scenario 4; no free/100-qty order |
| Out-of-hours refusal (live) | VOICE-11, CALL-07 | End-to-end; unit test covers the server hours check | 03-05 Scenario 5; no order row created |
| Migration applied to live DB | CALL-02/03/08, OBS-01 | Live DB state not checkable from local shell | 03-01-02; Supabase MCP list_tables + execute_sql |
| Railway env + dev hours seeded | D-02, D-03 | Railway/live DB state not checkable from local shell | 03-04-03; Railway CLI + Supabase MCP |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify, a `SKIPPED` infra rationale, or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (each plan's code tasks run a Vitest command; only infra/UAT tasks are SKIPPED/MANUAL with rationale)
- [x] Wave 0 covers all MISSING references (03-01-03 creates both test files turned GREEN by Plans 02/03; 03-04-02 extends menu-items.test.ts)
- [x] No watch-mode flags (all commands are single-run `pnpm --filter backend run test`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-09
</content>
