# SECURITY.md — Phase 1 (Foundations)

**Phase:** 01 — Foundations
**Audited:** 2026-05-08
**ASVS Level:** 1
**Auditor:** gsd-secure-phase (claude-sonnet-4-6)

---

## Summary

| Metric | Count |
|--------|-------|
| Threats in register | 18 |
| CLOSED | 16 |
| OPEN | 2 |
| Unregistered flags | 1 |

---

## Threat Verification

### Plan 01-01 threats

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-01-01-01 | Information Disclosure | mitigate | CLOSED | `.env.example` contains only placeholder values (no real keys). `.gitignore` line 3 excludes `.env`, line 4 excludes `.env.local`. `VITE_SUPABASE_SERVICE_ROLE_KEY` does not appear in `.env.example` (verified: file contains only `SUPABASE_SERVICE_ROLE_KEY=` without VITE_ prefix). |
| T-01-01-02 | Tampering | mitigate | CLOSED | `package.json` contains `"packageManager": "pnpm@9.15.0"` (confirmed). |
| T-01-01-03 | Information Disclosure | mitigate | CLOSED | `packages/shared/src/index.ts` line 159: `// PII (D-07, Ley 25.326 AR): NEVER log this field` appears on the `customer_phone` field. "NEVER log" string confirmed present. |

### Plan 01-02 threats

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-01-02-01 | Information Disclosure | mitigate | CLOSED | `supabase/migrations/0001_initial_schema.sql`: all 10 tables have `ENABLE ROW LEVEL SECURITY` immediately after `CREATE TABLE`. Confirmed present for: restaurants, menu_categories, menu_items, option_groups, option_items, orders, order_items, restaurant_counters, restaurant_hours, subscriptions (lines 27, 46, 71, 92, 127, 168, 191, 211, 230, 254). |
| T-01-02-02 | Information Disclosure | mitigate | CLOSED | `option_groups` uses `menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = ...)` pattern (migration lines 97–108). `option_items` uses double-JOIN through `option_groups -> menu_items` (lines 131–143). |
| T-01-02-03 | Tampering | accept | CLOSED | Accepted: standard JWT signing by Supabase Auth. No action required. |
| T-01-02-04 | Elevation of Privilege | mitigate | CLOSED | Migration lines 316–318 contain: `GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin` and `REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public`. Lines 317–318 also revoke `public.restaurants` from `authenticated, anon, public`. |
| T-01-02-05 | Information Disclosure | accept (D-06) | CLOSED | Accepted per D-06 (AES-256 at-rest sufficient for v1; no pgcrypto). Migration line 158 contains `-- PII: D-07, never log` comment on `customer_phone` column. |
| T-01-02-06 | Information Disclosure | accept | CLOSED | Accepted UX trade-off. Frontend Dashboard handles `restaurant_id === null` by showing the "Configurar restaurante" empty state (Dashboard.tsx confirmed). |
| T-01-02-07 | Repudiation | mitigate | CLOSED | Migration line 161: `call_id text UNIQUE` confirmed on the `orders` table. |

### Plan 01-03 threats

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-01-03-01 | Elevation of Privilege | mitigate | CLOSED | `apps/backend/src/lib/supabase.ts` line 9 reads `process.env.SUPABASE_SERVICE_ROLE_KEY!` with no `VITE_` prefix. The word `VITE_` does not appear anywhere in that file. CI step "SEC-04 service role key must not be in bundle" in `.github/workflows/ci.yml` line 29 runs `bash scripts/check-sec04.sh` after the frontend build. |
| T-01-03-02 | Information Disclosure | mitigate | CLOSED | `apps/backend/src/lib/logger.ts`: `PII_KEYS` set (line 6) includes `customer_phone`. `redactPII` walker replaces it with `'[REDACTED]'` (line 17). The `console.log` call inside `emit()` (line 36) operates only on the already-redacted `line` object — it never receives a raw `customer_phone` value. `logger.test.ts` asserts the rendered output contains `[REDACTED]` and not the raw phone number. CI step at `.github/workflows/ci.yml` line 32 runs `! grep -RnE 'console\.(log|info|warn|error)\([^)]*customer_phone' apps/backend/src/`. Manual scan of `apps/backend/src/` (index.ts, health.ts, lib/supabase.ts, lib/mercadopago.ts, lib/logger.ts) confirms zero direct `console.*customer_phone` calls in production code. |
| T-01-03-03 | Denial of Service | mitigate | CLOSED | `apps/backend/src/index.ts` lines 10–22: env validator loop checks `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; calls `process.exit(1)` on missing key. Note: `MERCADO_PAGO_ACCESS_TOKEN` was intentionally deferred to Phase 5 per inline comment — see OPEN_THREATS item below. |
| T-01-03-04 | Tampering | accept | CLOSED | Accepted. `/health` returns only `{status, ts}` — no internal state exposed. |
| T-01-03-05 | Repudiation | accept | CLOSED | Accepted. Railway + Vercel + GitHub Actions logs sufficient for v1. |

### Plan 01-04 threats

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-01-04-01 | Elevation of Privilege | mitigate | CLOSED | `apps/frontend/src/lib/supabase.ts` reads only `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`. The string `SERVICE_ROLE` does not appear anywhere in that file. `apps/frontend/.env.example` contains `VITE_SUPABASE_ANON_KEY=` and the explicit comment `# Never define VITE_SUPABASE_SERVICE_ROLE_KEY`. `scripts/check-sec04.sh` greps for `service[_.-]role|SUPABASE_SERVICE_ROLE_KEY` in `apps/frontend/dist/`. |
| T-01-04-02 | Spoofing | accept | CLOSED | Accepted. Supabase `exchangeCodeForSession` verifies code server-side. |
| T-01-04-03 | Information Disclosure | accept | CLOSED | Accepted per UI-SPEC.md copy contract ("Ya existe una cuenta con ese email" is approved). |
| T-01-04-04 | Tampering | mitigate | CLOSED | `apps/frontend/src/pages/ProtectedRoute.tsx`: when `session === null`, renders `<Navigate to="/login" replace />`. `App.tsx` wraps the `/dashboard` route in `<ProtectedRoute>`. |
| T-01-04-05 | Information Disclosure | mitigate | CLOSED | Auth page source files (Login.tsx, Signup.tsx, ForgotPassword.tsx) use Supabase SDK calls; no `console.log` referencing `password` found in production page code. |
| T-01-04-06 | Spoofing | accept | CLOSED | Accepted. Standard SPA threat model (localStorage session storage). CSP hardening deferred to Phase 6. Documented. |

### Plan 01-05 threats

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-01-05-01 | Elevation of Privilege | mitigate | CLOSED | CI workflow `.github/workflows/ci.yml` line 29: `bash scripts/check-sec04.sh` runs after frontend build using only placeholder VITE_ vars (lines 26–27). Vercel env instructions in Plan 05 explicitly state "DO NOT add VITE_SUPABASE_SERVICE_ROLE_KEY". |
| T-01-05-02 | Information Disclosure | mitigate | CLOSED | CI `.github/workflows/ci.yml` lines 31–32: `! grep -RnE 'console\.(log|info|warn|error)\([^)]*customer_phone' apps/backend/src/` runs as a blocking step. Phase 1 has no order-processing routes yet; gate will catch violations in Phase 2+. |
| T-01-05-03 | Tampering | mitigate | CLOSED | `apps/frontend/vercel.json` lines 4–6: `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` ensures all SPA routes are served correctly. |
| T-01-05-04 | Spoofing | accept | CLOSED | Accepted. Supabase Auth code verification is server-side. |
| T-01-05-05 | Information Disclosure | mitigate | CLOSED | `apps/backend/src/__tests__/rls.test.ts` replaced Wave 0 skips with live `describeLive` tests guarded by env var presence. Tests cover: JWT claim, SELECT isolation for restaurants, menu_items, and WITH CHECK enforcement for cross-tenant INSERT. Uses `describe.skip` when secrets absent so CI does not fail without secrets. |
| T-01-05-06 | Repudiation | accept | CLOSED | Accepted. Standard PaaS audit trail. |

---

## Open Threats

### OT-01: MERCADO_PAGO_ACCESS_TOKEN removed from Phase 1 env validation

**Threat Reference:** T-01-03-03 (Denial of Service — missing env var causes silent broken state)

**Plan declares:** `REQUIRED_ENV` should include `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `MERCADO_PAGO_ACCESS_TOKEN`.

**Actual implementation:** `apps/backend/src/index.ts` lines 10–12 only validates `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `MERCADO_PAGO_ACCESS_TOKEN` was removed with an inline comment: "MERCADO_PAGO_ACCESS_TOKEN se agrega en Phase 5 (billing). No es requerido en Phase 1."

**Risk:** If the MP client is instantiated at module load time (`apps/backend/src/lib/mercadopago.ts` calls `new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN! })`), the `!` non-null assertion will pass with `undefined`, and the MP SDK will initialize with an invalid token. When Phase 5 billing routes start making actual API calls, they will fail at runtime rather than at startup.

**Severity:** LOW for Phase 1 (no billing calls). Increases to MEDIUM when Phase 5 is merged.

**Recommendation:** Before Phase 5 billing routes go live, re-add `MERCADO_PAGO_ACCESS_TOKEN` to `REQUIRED_ENV` in `apps/backend/src/index.ts`. This is a planned deviation that needs a Phase 5 prerequisite gate.

---

### OT-02: `.env.test` not covered by .gitignore

**Threat Reference:** T-01-01-01 (Information Disclosure — real keys committed to repo)

**Plan declares (01-05 Task 1):** "Developer adds `apps/backend/.env.test` (gitignored — already covered by `.env*` rule in .gitignore from Plan 01)."

**Actual `.gitignore`:** Lines 3–4 list `.env` and `.env.local` explicitly. There is no glob pattern `.env*` that would catch `.env.test`.

**Risk:** If a developer runs the live RLS test locally and creates `apps/backend/.env.test` with `SUPABASE_SERVICE_ROLE_KEY`, the file is NOT gitignored and could be accidentally committed, leaking the service role key to the repository.

**Severity:** HIGH. The service role key bypasses all RLS — its exposure to version control is a critical credential leak.

**Recommendation:** Add `.env.*` or `.env.test` to `.gitignore` before Phase 5 RLS testing is performed locally. The fix is a one-line gitignore addition. This must be done before any developer creates `.env.test`.

---

## Accepted Risks Log

| Risk ID | Threat ID | Category | Rationale | Review Phase |
|---------|-----------|----------|-----------|--------------|
| AR-01 | T-01-02-03 | JWT Tampering | Standard JWT trust model — Supabase signs JWTs with project secret; client cannot forge claims. | Phase 6 |
| AR-02 | T-01-02-05 | PII column-level encryption | AES-256 at-rest (Supabase storage layer) sufficient for v1 per D-06. SEC-05 no-log policy covers application-layer exposure. pgcrypto deferred to v2. | Phase 7 |
| AR-03 | T-01-02-06 | null restaurant_id first login | UX issue, not security. Frontend redirects to onboarding if claim is null. | N/A |
| AR-04 | T-01-03-04 | /health reveals ts timestamp | Returns only `{status, ts}` — no version, env vars, or internal state exposed. | Phase 6 |
| AR-05 | T-01-03-05 | No structured incident timeline | Railway + Vercel + GitHub Actions logs are sufficient for v1. | Phase 6 |
| AR-06 | T-01-04-02 | Auth-callback URL tampering | `exchangeCodeForSession` performs server-side code verification; tampered codes are rejected by Supabase. | N/A |
| AR-07 | T-01-04-03 | Email-already-registered disclosure | UI-SPEC.md copy contract explicitly approves "Ya existe una cuenta con ese email" for UX reasons. | Phase 6 |
| AR-08 | T-01-04-06 | XSS session hijack via localStorage | Standard SPA threat model for v1. Full mitigation (httpOnly cookies) requires server-side auth changes. CSP hardening is a Phase 6 deliverable. | Phase 6 |
| AR-09 | T-01-05-04 | Email-callback tampering | Same as AR-06. Library-level mitigation. | N/A |
| AR-10 | T-01-05-06 | No deployment audit trail | Standard PaaS audit (Vercel + Railway + GitHub Actions logs). | Phase 6 |

---

## Unregistered Threat Flags

No `## Threat Flags` section was found in SUMMARY.md files for Phase 1. No unregistered flags to report.

---

## Phase 2 Latent Risks

The following are not violations in Phase 1 but represent attack surface that Phase 2 must address:

1. **No input validation middleware on Express.** Phase 1 only has a `/health` route that accepts no input. Phase 2 will add webhook routes (Vapi, Mercado Pago). Every new route that accepts a request body must validate and sanitize input before passing it to Supabase or the LLM. Consider `zod` schema validation at the route layer.

2. **SEC-05 grep pattern is narrow.** The CI grep `console\.(log|info|warn|error)\([^)]*customer_phone` only catches direct inline references. If Phase 2 code logs an entire `order` object (which contains `customer_phone`) via `console.log(order)`, the grep will not catch it. The logger's `redactPII` is the correct enforcement path — but developers must be trained to always use `logger.*` instead of `console.*` for any structured object that may contain PII.

3. **Webhook HMAC validation not yet implemented.** Phase 3 will add Vapi webhook routes. CLAUDE.md notes that Vapi HMAC signature validation is required. The absence of HMAC validation in Phase 1 is expected (no webhook routes exist), but it must be added as the first line of defense in the webhook handler — not as an afterthought.

4. **RLS live tests skip in CI without secrets.** The `describeLive` guard means the RLS isolation tests only run locally with `.env.test`. If repo secrets are never added to GitHub Actions, a RLS regression in a future migration would not be caught by CI. Consider adding `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` as GitHub Actions repository secrets so the live RLS test can run in CI.

5. **`railway.toml` location differs from plan.** The plan specifies `apps/backend/railway.toml`, but the actual file is at the repo root (`railway.toml`). This is a valid deviation (root-level toml is the correct pattern for Railway monorepos), but it should be documented in the Phase 1 SUMMARY to avoid confusion.
