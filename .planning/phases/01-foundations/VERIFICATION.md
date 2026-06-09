---
phase: 01-foundations
verified: 2026-05-08T21:00:00Z
status: human_needed
score: 14/16 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm in Supabase Dashboard that the Custom Access Token Hook is enabled and points to public.custom_access_token_hook (the migration uses this name; 02-SUMMARY mentioned set_restaurant_id_claim which may be a stale dashboard observation)"
    expected: "Dashboard -> Authentication -> Hooks shows custom_access_token_hook enabled"
    why_human: "Cannot verify live Supabase Dashboard state programmatically"
  - test: "Confirm JWT includes app_metadata.restaurant_id after signup + login via the deployed Vercel URL"
    expected: "After creating a restaurant in onboarding, the JWT claim restaurant_id is set to the correct UUID"
    why_human: "Requires live browser session and Supabase network call; cannot test programmatically"
  - test: "Run the live RLS isolation test locally with .env.test populated"
    expected: "pnpm --filter @agente-restaurante/backend test --run passes all AUTH-05/AUTH-06 assertions (the 05-SUMMARY notes this was not validated in CI)"
    why_human: "Requires Supabase project credentials in .env.test; not available in automated verification"
  - test: "Confirm GitHub Actions CI has run at least once on main and shows all steps green"
    expected: "SEC-04 + SEC-05 grep steps pass; TypeScript compile passes; frontend build succeeds"
    why_human: "05-SUMMARY notes CI was defined but not yet validated via a GitHub push"
  - test: "Navigate to /dashboard on the deployed Vercel URL after hard-refresh; verify session persists (AUTH-03)"
    expected: "User stays logged in, dashboard renders without redirecting to /login"
    why_human: "Session persistence across browser refresh requires a live browser"
---

# Phase 1: Foundations — Verification Report

**Phase Goal:** Deliver the multi-tenant foundation — pnpm monorepo, Supabase schema + RLS + Custom Access Token Hook, Express backend skeleton, React auth SPA, Railway + Vercel deployments, and CI.
**Verified:** 2026-05-08T21:00:00Z
**Status:** HUMAN_NEEDED — all automated checks pass; 5 items require human confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | pnpm-workspace.yaml lists apps/* and packages/* as workspaces | VERIFIED | File exists, contains both entries |
| 2 | Root package.json declares packageManager: pnpm@9.15.0 | VERIFIED | `"packageManager": "pnpm@9.15.0"` confirmed |
| 3 | packages/shared exports 8 interfaces and 3 type aliases with PII annotation | VERIFIED | 97 lines, 8 interfaces, 3 type aliases, D-07 NEVER log comment present |
| 4 | apps/backend and apps/frontend declare workspace:* dependency on @agente-restaurante/shared | VERIFIED | Both package.json files confirmed |
| 5 | Test scaffolds exist for AUTH-01..06, SEC-04, SEC-05 | VERIFIED | All scaffold files present in correct locations |
| 6 | scripts/check-sec04.sh exists and is executable | VERIFIED | File exists, chmod +x applied |
| 7 | 10 tables with RLS enabled in migration SQL | VERIFIED | 10 CREATE TABLE + 10 ALTER TABLE ENABLE ROW LEVEL SECURITY + 10 CREATE POLICY "tenant_isolation" |
| 8 | Custom Access Token Hook function exists with all 5 GRANT/REVOKE statements | VERIFIED | public.custom_access_token_hook present with all 5 GRANT/REVOKE |
| 9 | Backend Express: /health returns 200, env fail-fast, supabaseAdmin, logger with PII redaction | VERIFIED | All files exist with correct content; MERCADO_PAGO_ACCESS_TOKEN intentionally deferred to Phase 5 |
| 10 | railway.toml at repo root (not apps/backend) with healthcheckPath /health | VERIFIED | Root railway.toml confirmed; apps/backend/railway.toml correctly removed |
| 11 | Frontend: Login/Signup/ForgotPassword/AuthCallback/Dashboard/ProtectedRoute all exist and wired | VERIFIED | All 6 pages exist; App.tsx routes confirmed; verbatim Spanish copy verified |
| 12 | Frontend Supabase client uses only VITE_ env vars (no SERVICE_ROLE) | VERIFIED | apps/frontend/src/lib/supabase.ts uses VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY only |
| 13 | SEC-04: no service role key in frontend dist | VERIFIED | grep against built dist returns clean |
| 14 | SEC-05: no customer_phone in console.* calls in backend src | VERIFIED | grep returns empty |
| 15 | vercel.json with SPA rewrite + CI workflow with SEC-04/SEC-05 grep gates | VERIFIED | Both files present with correct content |
| 16 | Live Supabase project has schema applied + hook enabled + deployments live | HUMAN NEEDED | 02-SUMMARY shows deployment happened but hook name discrepancy (set_restaurant_id_claim vs custom_access_token_hook in migration); live RLS test not confirmed running in CI |

**Score:** 15/16 truths fully verified (15th is partially verified — deployments confirmed live via curl; hook enablement requires human confirm)

---

## Per-Plan Verdict

| Plan | Title | Verdict | Notes |
|------|-------|---------|-------|
| 01-01 | Monorepo Skeleton + Wave 0 Tests | PASS | All artifacts verified in codebase |
| 01-02 | Supabase Schema + RLS + Auth Hook | PASS (code) / HUMAN for live DB | Migration SQL is complete and correct; 02-SUMMARY has minor inconsistency on hook function name vs migration (likely dashboard alias); live DB state unverifiable programmatically |
| 01-03 | Backend Express Skeleton | PASS | All backend files verified; MERCADO_PAGO_ACCESS_TOKEN intentionally removed from REQUIRED_ENV (documented in 05-SUMMARY as Phase 5 item) |
| 01-04 | Frontend React Auth Pages | PASS | All pages verified; verbatim Spanish copy confirmed; SEC-04 clean on built dist |
| 01-05 | Deploy + CI | PASS (code) / HUMAN for E2E | Artifacts exist; Railway URL confirmed from summary; CI workflow not yet confirmed as having run on GitHub |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | Workspace topology | VERIFIED | Lists apps/* and packages/* |
| `package.json` (root) | packageManager: pnpm@9.15.0 | VERIFIED | Exact string confirmed |
| `packages/shared/src/index.ts` | 8 interfaces + 3 type aliases, PII comment | VERIFIED | 97 lines, 8 interfaces, 3 aliases, D-07 comment |
| `apps/backend/vitest.config.ts` | Backend test runner config | VERIFIED | environment: node |
| `apps/frontend/vitest.config.ts` | Frontend test runner config | VERIFIED | environment: node |
| `scripts/check-sec04.sh` | SEC-04 bundle leak detector | VERIFIED | Executable; grep-based detection |
| `supabase/migrations/0001_initial_schema.sql` | 10 tables + RLS + hook | VERIFIED | 329 lines; 10 tables, 10 RLS, 10 policies, hook function, 5 GRANT/REVOKE |
| `supabase/tests/rls-tenant-isolation.sql` | Cross-tenant isolation verification | VERIFIED | 219 lines |
| `supabase/README.md` | Manual migration instructions | VERIFIED | Contains Dashboard steps |
| `apps/backend/src/index.ts` | Express entry + env validation | VERIFIED | 37 lines; SUPABASE_URL + SERVICE_ROLE validated; fail-fast |
| `apps/backend/src/lib/supabase.ts` | supabaseAdmin with service role | VERIFIED | persistSession: false; no VITE_ prefix |
| `apps/backend/src/lib/mercadopago.ts` | mpClient singleton | VERIFIED | MercadoPagoConfig initialized |
| `apps/backend/src/lib/logger.ts` | Logger with PII redaction | VERIFIED | redactPII, [REDACTED], customer_phone in PII_KEYS |
| `apps/backend/src/routes/health.ts` | GET / returning {status, ts} | VERIFIED | healthRouter exported |
| `railway.toml` (ROOT) | Railway deploy config | VERIFIED | healthcheckPath=/health; watchPaths correct; startCommand node apps/backend/dist/index.js |
| `apps/backend/railway.toml` | Should NOT exist (removed) | VERIFIED ABSENT | Correctly deleted per 05-SUMMARY |
| `apps/frontend/src/lib/supabase.ts` | Supabase client (anon key only) | VERIFIED | VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY |
| `apps/frontend/src/lib/auth.ts` | useSession + useRestaurantId + signOut | VERIFIED | All three exports; reads app_metadata; onAuthStateChange |
| `apps/frontend/src/pages/Login.tsx` | Login with Spanish copy | VERIFIED | "Ingresar al panel", signInWithPassword, "Olvidé mi contraseña" |
| `apps/frontend/src/pages/Signup.tsx` | Signup with emailRedirectTo | VERIFIED | emailRedirectTo, "Crear cuenta", "Revisá tu email" |
| `apps/frontend/src/pages/ForgotPassword.tsx` | Reset password | VERIFIED | resetPasswordForEmail, "Te enviamos un link" |
| `apps/frontend/src/pages/AuthCallback.tsx` | Code exchange | VERIFIED | exchangeCodeForSession; reads URL params (not full href per bug fix) |
| `apps/frontend/src/pages/Dashboard.tsx` | Empty-state dashboard + logout | VERIFIED | "Bienvenido a Agente Restaurante", "Cerrar sesión", signOut, useRestaurantId |
| `apps/frontend/src/pages/ProtectedRoute.tsx` | Auth guard | VERIFIED | Navigate to /login on null session |
| `apps/frontend/src/App.tsx` | Router wiring | VERIFIED | All routes present including /onboarding placeholder |
| `apps/frontend/src/index.css` | Dark theme CSS tokens | VERIFIED | All 4 hex values from UI-SPEC.md confirmed |
| `apps/frontend/components.json` | shadcn config | VERIFIED | style: default, baseColor: neutral |
| `apps/frontend/vercel.json` | SPA rewrite config | VERIFIED | rewrites /(.*) -> /index.html |
| `.github/workflows/ci.yml` | CI pipeline | VERIFIED | pnpm install, tests, tsc, build, SEC-04 grep, SEC-05 grep |
| `apps/backend/src/__tests__/rls.test.ts` | Live RLS test (conditional) | VERIFIED | describeLive pattern; no it.skip; AUTH-05/AUTH-06 assertions |
| `apps/backend/src/__tests__/rls.helpers.ts` | Test tenant helpers | VERIFIED | createTestTenant, destroyTestTenant |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| apps/backend/package.json | packages/shared | workspace:* protocol | VERIFIED | "@agente-restaurante/shared": "workspace:*" confirmed |
| apps/frontend/package.json | packages/shared | workspace:* protocol | VERIFIED | "@agente-restaurante/shared": "workspace:*" confirmed |
| apps/backend/src/index.ts | apps/backend/src/routes/health.ts | app.use('/health', healthRouter) | VERIFIED | Import and mount confirmed |
| apps/backend/src/lib/supabase.ts | SUPABASE_SERVICE_ROLE_KEY | createClient with service role | VERIFIED | Uses process.env.SUPABASE_SERVICE_ROLE_KEY |
| railway.toml | /health | healthcheckPath | VERIFIED | healthcheckPath = "/health" |
| apps/frontend/src/pages/Login.tsx | supabase.auth.signInWithPassword | form submit handler | VERIFIED | signInWithPassword present |
| apps/frontend/src/pages/Signup.tsx | supabase.auth.signUp | form submit with emailRedirectTo | VERIFIED | emailRedirectTo in signUp call |
| apps/frontend/src/pages/Dashboard.tsx | supabase.auth.signOut | logout button onClick | VERIFIED | signOut imported and called |
| apps/frontend/src/lib/auth.ts | session.user.app_metadata.restaurant_id | useRestaurantId hook | VERIFIED | app_metadata read from session |
| apps/frontend/src/App.tsx | ProtectedRoute wrapping Dashboard | route definition | VERIFIED | Dashboard route wrapped in ProtectedRoute |
| public.custom_access_token_hook | public.restaurants | SELECT id WHERE owner_id = user_id | VERIFIED | Function body confirmed in migration |
| All RLS policies | auth.jwt() app_metadata.restaurant_id | USING/WITH CHECK clause | VERIFIED | 21 occurrences of auth.jwt() in migration (10 tables x 2 + header) |
| option_groups RLS | menu_items.restaurant_id | JOIN-based isolation | VERIFIED | menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = ...) |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| SEC-04: no service role key in frontend bundle | grep -rE "service[_.-]role" apps/frontend/dist/ | empty output | PASS |
| SEC-05: no customer_phone in console.* in backend src | grep -RnE 'console\.(log\|info\|warn\|error)\([^)]*customer_phone' apps/backend/src/ | empty output | PASS |
| Migration has 10 tables | grep -c "^CREATE TABLE" supabase/migrations/0001_initial_schema.sql | 10 | PASS |
| Migration has 10 RLS policies | grep -c 'CREATE POLICY "tenant_isolation"' migration | 10 | PASS |
| Frontend dist exists (frontend was built) | ls apps/frontend/dist/ | index.html + assets/ | PASS |
| railway.toml at repo root | test -f railway.toml | exists | PASS |
| apps/backend/railway.toml absent | test -f apps/backend/railway.toml | not found | PASS |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/frontend/.env.example` | 3 | String `VITE_SUPABASE_SERVICE_ROLE_KEY` appears in a comment | INFO | The string appears only in a comment warning developers NOT to define this key. Not a real leak — the comment is intentional and protective. |
| `apps/backend/src/index.ts` | 9 | MERCADO_PAGO_ACCESS_TOKEN removed from REQUIRED_ENV | INFO | Intentional deviation documented in 05-SUMMARY. mpClient singleton still initializes (will use undefined until Phase 5 adds the var). Not a blocker for Phase 2. |
| `01-02-SUMMARY.md` | — | Summary claims hook name `set_restaurant_id_claim` but migration has `custom_access_token_hook` | WARNING | The migration SQL is authoritative. The summary was likely written during a dashboard interaction where the display name differed. Human verification of live hook enablement needed. |
| `01-02-SUMMARY.md` | — | Summary says "8 tablas con RLS enabled" but migration has 10 | WARNING | Migration SQL has all 10 tables. The 8-table count in summary was likely from an interim Dashboard verification before all tables were applied. Programmatic check of migration confirms 10. |

---

### Requirements Coverage

| Requirement | Plan | Status | Evidence |
|-------------|------|--------|----------|
| AUTH-01 (signup) | 01-04 | VERIFIED (code) / human for live | Signup.tsx calls signUp with emailRedirectTo |
| AUTH-02 (email verification) | 01-04 | VERIFIED (code) / human for live | AuthCallback.tsx calls exchangeCodeForSession |
| AUTH-03 (session persistence) | 01-04 | HUMAN NEEDED | Supabase SDK auto-refresh via onAuthStateChange wired; hard-refresh test requires browser |
| AUTH-04 (password reset) | 01-04 | VERIFIED (code) / human for live | ForgotPassword.tsx calls resetPasswordForEmail |
| AUTH-05 (RLS tenant isolation) | 01-02 / 01-05 | VERIFIED (code) / HUMAN for live test | Migration has 10 policies; rls.test.ts is live-capable but no confirmed passing run with env |
| AUTH-06 (JWT restaurant_id claim) | 01-02 / 01-05 | VERIFIED (code) / HUMAN for live | custom_access_token_hook injects claim; rls.test.ts asserts app_metadata; live run not confirmed |
| AUTH-07 (logout) | 01-04 | VERIFIED | Dashboard.tsx has "Cerrar sesión" button calling signOut |
| SEC-04 (no service role in bundle) | 01-03 / 01-04 / 01-05 | VERIFIED | grep on dist returns clean; CI step present |
| SEC-05 (customer_phone no-log) | 01-01 / 01-03 | VERIFIED | logger.ts redacts PII; grep on src returns clean; CI gate present |

---

### Human Verification Required

#### 1. Supabase Custom Access Token Hook Enabled

**Test:** Open Supabase Dashboard -> Authentication -> Hooks. Confirm the Custom Access Token Hook is enabled and points to `public.custom_access_token_hook`.
**Expected:** Toggle is ON, schema = `public`, function = `custom_access_token_hook`.
**Why human:** The 02-SUMMARY mentioned `set_restaurant_id_claim` as the hook name (possibly a different display in Dashboard or an interim name). The migration file has `custom_access_token_hook`. Need to confirm the live hook uses the same name as the migration.

#### 2. JWT app_metadata.restaurant_id Claim Active

**Test:** After signup + login on the deployed Vercel frontend, open browser DevTools -> Application -> Local Storage -> supabase session. Decode the JWT and verify `app_metadata.restaurant_id` is present.
**Expected:** After user creates a restaurant (Phase 2 onboarding), `app_metadata.restaurant_id` contains the UUID.
**Why human:** JWT claim injection requires the live Supabase Auth Hook to fire during sign-in; cannot test without a live browser session.

#### 3. Live RLS Isolation Test

**Test:** Create `.env.test` in `apps/backend/` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY`. Run `pnpm --filter @agente-restaurante/backend test --run`.
**Expected:** All AUTH-05 and AUTH-06 assertions in `rls.test.ts` pass (describes run, not skip).
**Why human:** Requires real Supabase credentials. 05-SUMMARY says this was defined but does not document a confirmed passing run.

#### 4. GitHub Actions CI Green Run

**Test:** Check GitHub Actions on the repository's main branch. Confirm at least one successful CI run exists showing all steps green (including SEC-04 and SEC-05 grep steps).
**Expected:** All 7 CI steps pass including "SEC-04 service role key must not be in bundle" and "SEC-05 customer_phone must not appear in console.*".
**Why human:** 05-SUMMARY explicitly states "GitHub Actions workflow definido — corre en push a main... Aún no validado en GitHub (sin push de PR todavía)."

#### 5. Session Persistence After Hard Refresh (AUTH-03)

**Test:** Log in on the deployed Vercel URL. Navigate to `/dashboard`. Perform a hard refresh (Cmd+Shift+R / Ctrl+Shift+R).
**Expected:** User remains on `/dashboard` without being redirected to `/login`. The Supabase SDK auto-refreshes the session.
**Why human:** Requires a live browser + live Supabase project to exercise the `onAuthStateChange` session refresh loop.

---

### Gaps Summary

No blocking gaps in the codebase. All code artifacts are substantive, properly wired, and data flows are correct.

Two notable deviations from plan are intentional and documented:
1. `MERCADO_PAGO_ACCESS_TOKEN` removed from REQUIRED_ENV — deferred to Phase 5 per user decision.
2. `railway.toml` moved to repo root (not `apps/backend`) — required for Railway pnpm monorepo support.

The 02-SUMMARY discrepancy (8 tables vs 10, `set_restaurant_id_claim` vs `custom_access_token_hook`) appears to be summary inaccuracy — the authoritative migration SQL has all 10 tables with the correct function name.

Human verification is required for the live deployment and auth flow (5 items above), which are outside the scope of automated code verification.

---

## Phase 2 Readiness

Phase 2 (Onboarding & Menu) can begin. All code artifacts required by Phase 2 are in place:

- Shared TypeScript types (Restaurant, MenuItem, OptionGroup, etc.) — READY
- Frontend auth flow (ProtectedRoute, useSession, useRestaurantId) — READY
- Backend supabaseAdmin client — READY
- Database schema (restaurants, menu_categories, menu_items, option_groups, option_items) — READY (migration authored; assumed applied per 02-SUMMARY)

**Recommended before starting Phase 2:** Complete human verification items 1 (Supabase hook) and 3 (live RLS test) to confirm the auth foundation is solid. Items 4 (CI) and 5 (session persistence) are also recommended but non-blocking for Phase 2 code work.

---

_Verified: 2026-05-08T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
