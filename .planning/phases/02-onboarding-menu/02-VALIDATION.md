---
phase: 02
slug: onboarding-menu
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Covers ONB-01..04, ONB-06, MENU-01..04 across the 6 Plans of Phase 2.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (backend + frontend workspaces) |
| **Config files** | `apps/backend/vitest.config.ts`, `apps/frontend/vitest.config.ts` (jsdom env added in Plan 02-01 Task 3) |
| **Quick run command** | `pnpm -r --if-present run test` |
| **Full suite command** | `pnpm -r --if-present run test && pnpm -r --if-present exec tsc --noEmit` |
| **Live-DB suite command** | `RUN_LIVE=1 pnpm -r --if-present run test` (gated `describeLive` blocks; requires SUPABASE_ANON_KEY in env) |
| **Estimated runtime** | ~30 s mocked / ~90 s with live integration |

---

## Sampling Rate

- **After every task commit:** Run `pnpm -r --if-present run test`
- **After every plan wave:** Run full suite + tsc + SEC-04 grep gate
- **Before `/gsd-verify-work`:** Full suite green AND `RUN_LIVE=1` live suite green
- **Max feedback latency:** 30 seconds for mocked, 90 seconds for live

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | MENU-04, D-17 | T-02-01 | Migration applies additively (IF NOT EXISTS) | string-grep | `grep -q "ADD COLUMN IF NOT EXISTS delivery_zones" supabase/migrations/0002_phase2_columns.sql` | ✅ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | MENU-04, D-17 | T-02-01 | Manual verification: 4 columns + CASCADE + Realtime publication | human-verify | Supabase Dashboard SQL verification queries (6-step) | n/a (manual) | ⬜ pending |
| 02-01-03 | 01 | 0 | ONB-01..06, MENU-01..04 | T-02-03/04 | shadcn primitives + RTL devDeps installed | file-existence | `test -f apps/frontend/src/components/ui/{form,switch,dialog,tabs,textarea,tooltip,sheet,skeleton}.tsx && grep -q '"@testing-library/react"' apps/frontend/package.json` | ✅ W0 | ⬜ pending |
| 02-01-04 | 01 | 0 | MENU-04 | — | Wave 0 test scaffolds + animate-flash-primary keyframe | scaffold | `pnpm -r --if-present run test` (skipped tests count as green) | ✅ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | ONB-01..04 | T-02-06/07/09 | Lazy Twilio singleton; auth middleware; slug + forwarding constants compile | tsc | `pnpm --filter @agente-restaurante/backend exec tsc --noEmit` | ❌ W0 (Task 1 creates) | ⬜ pending |
| 02-02-02 | 02 | 1 | ONB-01..04, ONB-06 | T-02-07/08/10 | 3 routers exposed; defense-in-depth `.eq('restaurant_id', req.restaurantId)`; mass-assignment whitelist | unit + integration | `pnpm -r --if-present run test && grep -c ".eq('restaurant_id', req.restaurantId)" apps/backend/src/routes/restaurants.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | ONB-01, ONB-06 | — | slug.test.ts + phone.test.ts + restaurants.test.ts wired; SC2 covered by describeLive | unit + describeLive | `pnpm -r --if-present run test` (mocked); `RUN_LIVE=1 pnpm -r --if-present run test` (live) | ✅ W0 (Plan 01 scaffolds) | ⬜ pending |
| 02-03-01 | 03 | 1 | MENU-01 | T-03-01/03 | menu-categories CRUD + CASCADE-to-items proven by live test | integration | `pnpm -r --if-present run test`; live: assert post-DELETE menu_items count = 0 | ✅ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | MENU-02, MENU-03, MENU-04 | T-03-01/02/03 | menu-items CRUD incl. nested option_groups; availability hot path | integration | `pnpm -r --if-present run test`; live: PATCH availability + tenant isolation | ✅ W0 | ⬜ pending |
| 02-03-03 | 03 | 1 | D-12 | T-03-06 | Template idempotency (409 template_already_loaded) | unit | `grep -q "template_already_loaded" apps/backend/src/routes/menu-template.ts && node -e "..."` (seed shape check) | ❌ W0 (Task 3 creates JSON) | ⬜ pending |
| 02-04-01 | 04 | 2 | ONB-01..03, ONB-06 | T-04-02/03 | Zod schema + api.ts wrapper + refreshSession orchestration; SEC-04 grep gate green | tsc + grep | `pnpm --filter @agente-restaurante/frontend exec tsc --noEmit && grep -r "VITE_SUPABASE_SERVICE_ROLE\|service_role" apps/frontend/src 2>/dev/null \| wc -l` returns 0 | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | ONB-01..04, ONB-06 | T-04-04/05 | Stepper + Steps 1-4 + TwilioErrorScreen with verbatim UI-SPEC strings | tsc + grep verbatim | `pnpm --filter @agente-restaurante/frontend exec tsc --noEmit && grep -q "Terminar y conectar teléfono" ...` | ❌ W0 | ⬜ pending |
| 02-04-03 | 04 | 2 | ONB-01, ONB-06 | T-04-03 | onboarding.test.tsx: validation, Lun-Dom mapping, Sofía default — covers SC1 (wizard completion) at unit level | unit (RTL) | `pnpm --filter @agente-restaurante/frontend run test` | ✅ W0 (Plan 01 scaffold) | ⬜ pending |
| 02-05-01 | 05 | 2 | MENU-01..04 | T-05-01 | menu-schema + api extensions + useMenu + useMenuRealtime with channel cleanup | tsc | `pnpm --filter @agente-restaurante/frontend exec tsc --noEmit && grep -q "supabase.removeChannel" apps/frontend/src/hooks/useMenuRealtime.ts` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 2 | MENU-01, MENU-04, D-12/13/15 | T-05-01/05 | EmptyState + CategoryList + ItemList + AvailabilityToggle + DeleteCategoryDialog with verbatim UI-SPEC; animate-flash-primary wired — covers SC4 (toggle <2s realtime) at integration | tsc + grep | `pnpm --filter @agente-restaurante/frontend exec tsc --noEmit && grep -q "animate-flash-primary" apps/frontend/src/components/menu/ItemList.tsx` | ❌ W0 | ⬜ pending |
| 02-05-03 | 05 | 2 | MENU-02, MENU-03, D-04, D-10 | T-05-03 | ItemModal with cardinality tooltip + Settings 5 tabs; 5+ RTL tests including describeLive realtime test | unit (RTL) | `pnpm --filter @agente-restaurante/frontend run test` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 3 | ALL phase reqs | T-06-01/02 | App.tsx routing + OnboardingGate + Dashboard surfaces Twilio number — covers SC2 (Twilio visible post-onboarding) | tsc | `pnpm --filter @agente-restaurante/frontend exec tsc --noEmit && grep -q "path=\"/menu\"" apps/frontend/src/App.tsx && grep -q "Tu restaurante está configurado" apps/frontend/src/pages/Dashboard.tsx` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 3 | ALL phase reqs | T-06-04 | 17-step manual UAT: signup→wizard→dashboard→menu→toggle→2nd-tab echo — covers SC1, SC2, SC3, SC4 end-to-end | human-verify (UAT) | Manual: 17-step checklist + screenshots on failure | n/a (manual) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase Success Criteria → Validation Map

| Roadmap SC | Description | Validation Path |
|-----|-------------|-----------------|
| **SC1** | User completes wizard → reaches `/dashboard` | Integration: 02-04-03 (RTL Step 1 validation) + 02-06-02 (UAT steps 5-9 — full signup→wizard→dashboard flow) |
| **SC2** | `restaurants.twilio_number` exists post-onboarding | Integration: 02-02-03 describeLive `POST /api/onboarding/finish` asserts UPDATE persists `twilio_number` + 02-06-01 tsc/grep that Dashboard reads `twilio_number` via `api.getMe()` + 02-06-02 UAT step 8 (number visible in pill) |
| **SC3** | Menu CRUD enforces RLS isolation | Integration: 02-03-01 describeLive cross-tenant 404 + 02-03-02 describeLive `PATCH /menu-items/:id` cross-tenant 404 + 02-03-02 cascade-delete proves menu_items count = 0 |
| **SC4** | Availability toggle reflects in second tab in <2s | Integration: 02-05-02 `animate-flash-primary` wired + 02-05-03 RTL `describeLive` realtime test asserts UPDATE payload delivered + 02-06-02 UAT step 12 (manual 2-tab observation with stopwatch) |

---

## Wave 0 Requirements

- [ ] `supabase/migrations/0002_phase2_columns.sql` — schema additions (Plan 02-01 Task 1)
- [ ] `apps/backend/src/__tests__/restaurants.test.ts` — stubs for ONB-01/02/06 (Plan 02-01 Task 4)
- [ ] `apps/backend/src/__tests__/menu-categories.test.ts` — stubs for MENU-01
- [ ] `apps/backend/src/__tests__/menu-items.test.ts` — stubs for MENU-02..04
- [ ] `apps/backend/src/__tests__/phone.test.ts` — stub with `vi.mock('twilio')` pattern for ONB-04
- [ ] `apps/backend/src/__tests__/slug.test.ts` — stub for slug helper
- [ ] `apps/frontend/src/__tests__/onboarding.test.tsx` — stub for ONB-01..03/06 UI
- [ ] `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` + `jsdom` installed as frontend devDeps
- [ ] `vitest.config.ts` declares `environment: 'jsdom'`
- [ ] `.animate-flash-primary` keyframe in `apps/frontend/src/index.css` (MENU-04 echo)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 0002 applied to live Supabase | D-17, MENU-04 | No Supabase CLI available; Dashboard SQL Editor is the canonical path (Phase 1 carry-forward) | Plan 02-01 Task 2: paste 0002 in Dashboard, run, then run 3 verification queries (columns, FK cascade, publication) |
| Twilio number visible in Dashboard pill post-onboarding | SC2, ONB-04 | Requires live Twilio sandbox + Supabase JWT round-trip; described as part of UAT | Plan 02-06 Task 2 UAT step 8 |
| Availability toggle echoes in <2s on second tab | SC4, MENU-04 | Realtime WebSocket latency cannot be asserted reliably in CI; subjective UX feedback | Plan 02-06 Task 2 UAT step 12 (stopwatch in second tab, observe `animate-flash-primary` flash and OFF state) |
| 4-step wizard renders Lun-first day order | ONB-02 | Visual check that AR convention is honored vs default ISO 0=Sunday | Plan 02-06 Task 2 UAT step 6 |
| DeleteCategoryDialog shows correct N item count | D-15, MENU-01 | UI assertion of dynamic interpolation | Plan 02-06 Task 2 UAT step 15 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (worst case is Plan 02-06 which is the wiring + UAT plan and has 1 automated + 1 manual)
- [x] Wave 0 covers all MISSING references (test files scaffolded in Plan 02-01 Task 4)
- [x] No watch-mode flags (all commands are one-shot)
- [x] Feedback latency < 90s (mocked: ~30s; full incl. live: ~90s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (set to `approved 2026-05-12` after orchestrator review)
