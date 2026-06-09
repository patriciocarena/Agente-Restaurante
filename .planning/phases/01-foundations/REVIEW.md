# Phase 1 — Foundations: Code Review

**Reviewed:** 2026-05-08
**Depth:** Standard (full file read, per-file analysis)
**Files Reviewed:** 15
**Reviewer:** Claude (gsd-code-reviewer)

---

## Files Reviewed

**Backend**
- `apps/backend/src/index.ts`
- `apps/backend/src/lib/supabase.ts`
- `apps/backend/src/lib/logger.ts`
- `apps/backend/src/lib/mercadopago.ts`
- `apps/backend/src/routes/health.ts`
- `apps/backend/src/__tests__/health.test.ts`
- `apps/backend/src/__tests__/logger.test.ts`
- `apps/backend/src/__tests__/rls.test.ts`
- `apps/backend/src/__tests__/rls.helpers.ts`

**Frontend**
- `apps/frontend/src/lib/supabase.ts`
- `apps/frontend/src/lib/auth.ts`
- `apps/frontend/src/pages/Login.tsx`
- `apps/frontend/src/pages/Signup.tsx`
- `apps/frontend/src/pages/ForgotPassword.tsx`
- `apps/frontend/src/pages/AuthCallback.tsx`
- `apps/frontend/src/pages/Dashboard.tsx`
- `apps/frontend/src/pages/Onboarding.tsx`
- `apps/frontend/src/pages/ProtectedRoute.tsx`
- `apps/frontend/src/App.tsx`

---

## Summary

Phase 1 is a solid foundation. The auth flow, RLS scaffolding, and logger are well-structured. No catastrophic bugs were found. However, there are several real correctness and reliability issues worth fixing before Phase 2 builds on top of them:

1. **CRITICAL (1):** `mercadopago.ts` crashes the backend at startup if `MERCADO_PAGO_ACCESS_TOKEN` is undefined — even though the CLAUDE.md and code comments explicitly say it's a Phase 5 concern.
2. **HIGH (2):** The `ForgotPassword` form silently swallows errors; the `Dashboard` never redirects a user whose JWT has no `restaurant_id` claim (undefined restaurant → infinite loading).
3. **MEDIUM (3):** `rls.helpers.ts` leaks a Supabase admin client on every `destroyTestTenant` call; `AuthCallback` has a missing `?type=recovery` handler branch; Login validates password length but not email format.
4. **LOW (2):** `health.test.ts` uses `let app: any`; `useSession` calls `getSession` and subscribes in a single effect with no error handling on the initial fetch.

---

## CRITICAL

### CR-01: `mercadopago.ts` crashes backend at startup when `MERCADO_PAGO_ACCESS_TOKEN` is not set

**File:** `apps/backend/src/lib/mercadopago.ts:5`

**Issue:** The module is imported at startup and calls `new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN! })`. When this env var is absent (it is explicitly excluded from `REQUIRED_ENV` in `index.ts` because it's a Phase 5 concern), `accessToken` is `undefined`. The `!` non-null assertion suppresses the TypeScript error but does not prevent the runtime value from being `undefined`. Whether `MercadoPagoConfig` throws on `undefined` or silently stores it, **it will cause the Phase 5 first API call to fail with a cryptic auth error** rather than a clear "token not configured" message, and if the library constructor validates eagerly, the backend crashes on startup in Phase 1 deployments.

**Fix:** Gate initialization behind a value check, and defer the singleton to first use:

```typescript
// apps/backend/src/lib/mercadopago.ts
import { MercadoPagoConfig } from 'mercadopago';

let _mpClient: MercadoPagoConfig | null = null;

export function getMpClient(): MercadoPagoConfig {
  if (!_mpClient) {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) throw new Error('MERCADO_PAGO_ACCESS_TOKEN is not set');
    _mpClient = new MercadoPagoConfig({ accessToken: token, options: { timeout: 5000 } });
  }
  return _mpClient;
}
```

This way nothing crashes in Phase 1, and Phase 5 routes get a clear error at call time. Update callers from `mpClient` to `getMpClient()`.

---

## HIGH

### HI-01: `ForgotPassword` silently swallows all errors — user sees "link sent" even on network failure

**File:** `apps/frontend/src/pages/ForgotPassword.tsx:15-22`

**Issue:** The `handleSubmit` function calls `supabase.auth.resetPasswordForEmail(...)` and ignores its return value entirely. The result is `setSent(true)` unconditionally — whether the request succeeded, failed due to network error, or Supabase returned an error. A user on a flaky connection will be told "we sent you a link" when nothing was sent, causing them to wait indefinitely.

Note: this intentional-looking "always show success for privacy" pattern is acceptable **if deliberate**, but the current code does not even log the error, which means real infrastructure failures go completely undetected.

**Fix:** At minimum, capture and log the error. If the goal is to not reveal whether an email exists, show success to the user but log internally:

```typescript
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setLoading(true);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });
  setLoading(false);
  if (error) {
    // Log for ops visibility — do not expose to user (privacy: don't reveal if email exists)
    console.error('[ForgotPassword] resetPasswordForEmail error:', error.message);
  }
  setSent(true); // Always show "sent" to prevent email enumeration
}
```

---

### HI-02: `Dashboard` shows permanent loading skeleton when `restaurantId` is `null` (no restaurant claim)

**File:** `apps/frontend/src/pages/Dashboard.tsx:26-49`

**Issue:** `useRestaurantId()` returns three values: `undefined` (loading), `null` (authenticated but no `restaurant_id` in JWT app_metadata), or a string UUID. The Dashboard only special-cases `undefined` (shows skeleton). When the value is `null` — which happens if the Custom Access Token Hook hasn't run yet, the hook failed, or the database insert race condition left the user without a restaurant — the component falls through to the `else` branch and renders the "Configurar restaurante" button as if everything is fine.

The real problem: if a user completes signup but the `restaurant_id` claim is missing from their JWT (e.g., Hook not yet deployed in Phase 2, or a rollout issue), they land on Dashboard in a broken half-state: they see the full UI but clicking "Configurar restaurante" will fail because there's no restaurant.

This is not cosmetic — it's a silent data integrity failure that will be hard to diagnose in production.

**Fix:** Add an explicit `null` branch that redirects to `/onboarding` or shows an inline prompt:

```tsx
} : restaurantId === null ? (
  // JWT exists but no restaurant_id claim — redirect to onboarding
  <Navigate to="/onboarding" replace />
) : (
  // restaurantId is a string — fully configured user
  <div className="text-center max-w-sm flex flex-col gap-4">
    ...
  </div>
)}
```

---

## MEDIUM

### ME-01: `destroyTestTenant` creates a new admin Supabase client on every call — minor resource leak in test teardown

**File:** `apps/backend/src/__tests__/rls.helpers.ts:41`

**Issue:** `destroyTestTenant` creates `const admin = createClient(...)` on line 41, which opens a new connection pool for every tenant being destroyed. In the current test suite this is only called twice (tenants A and B), so it is not a problem in practice. But as the test suite grows — and `destroyTestTenant` may be called from many `afterAll` blocks — this accumulates open connections that are never explicitly closed, which can interfere with test teardown and cause "open handles" warnings in Vitest.

**Fix:** Export a shared `createAdminClient` helper and reuse it, or pass the admin client in from the caller:

```typescript
function makeAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

// Or: accept admin client as parameter to destroyTestTenant
export async function destroyTestTenant(t: TestTenant, admin?: SupabaseClient) {
  const client = admin ?? makeAdminClient();
  // ... rest of cleanup
}
```

---

### ME-02: `AuthCallback` does not handle `?type=recovery` — password reset redirects break

**File:** `apps/frontend/src/pages/AuthCallback.tsx:13-39`

**Issue:** `ForgotPassword.tsx` sends the reset link to `/auth/callback?type=recovery`. `AuthCallback` parses the URL for `?code=` (PKCE) and falls back to `getSession()` (implicit/hash flow). When Supabase sends a password reset link using PKCE, the URL contains `?code=xxx&type=recovery`. The code correctly exchanges the code for a session — but then unconditionally navigates to `/dashboard` on line 26. It never checks `?type=recovery`, so users who just clicked a password-reset link are silently signed in and sent to `/dashboard` instead of a "set your new password" screen.

In Phase 1 there is no reset-password page yet, so this is not immediately user-facing. But the handling needs to be in place before Phase 2 ships, because the flow is already wired up end-to-end.

**Fix:** Check `url.searchParams.get('type')` after successful exchange and branch:

```typescript
const type = url.searchParams.get('type');
if (exchangeError) { ... }
if (type === 'recovery') {
  navigate('/reset-password', { replace: true }); // page to be built
} else {
  navigate('/dashboard', { replace: true });
}
```

---

### ME-03: `Login` validates password `length < 8` but not basic email format — misleading UX

**File:** `apps/frontend/src/pages/Login.tsx:28-35`

**Issue:** The form checks `!email` (empty string) but does not validate email format. A user typing `abc` in the email field passes client-side validation and gets a network round-trip before seeing "Email o contraseña incorrectos." This is a minor UX issue, but the inconsistency is notable because `Signup.tsx` uses `<Input type="email" required />` which relies on browser native validation, while `Login.tsx` uses custom validation that is weaker.

**Fix:** Add a simple format check before the network call:

```typescript
if (!email || !email.includes('@')) {
  setEmailError('Ingresá un email válido.');
  return;
}
```

Or align with Signup and add `required` to the Login email input so the browser handles it.

---

## LOW

### LO-01: `health.test.ts` uses `let app: any` — type safety loss in test file

**File:** `apps/backend/src/__tests__/health.test.ts:10`

**Issue:** `let app: any` disables TypeScript checking on the Express app instance. If the default export type of `index.ts` changes (e.g., it stops being an Express `Application`), the test will still compile and only fail at runtime. Since `supertest` accepts `any`, this silences useful type errors.

**Fix:**

```typescript
import type { Application } from 'express';
let app: Application;
```

---

### LO-02: `useSession` in `auth.ts` — initial `getSession()` errors are silently swallowed

**File:** `apps/frontend/src/lib/auth.ts:10`

**Issue:** `supabase.auth.getSession().then(({ data }) => setSession(data.session))` has no `.catch()`. If the initial fetch fails (network error, Supabase unreachable), the promise rejects silently, `session` stays `undefined` forever, and the user sees a permanent loading state with no recovery path. The `onAuthStateChange` subscription is still active and may later resolve the state, but the window between mount and the auth event firing leaves users in a hard-to-debug loading limbo.

This is a LOW because Supabase client typically resolves from local storage without a network call for the initial `getSession()`, so real-world impact is low. But it is worth noting.

**Fix:**

```typescript
supabase.auth.getSession()
  .then(({ data }) => setSession(data.session))
  .catch(() => setSession(null)); // treat fetch failure as signed-out
```

---

## Not Flagged (deliberate design decisions)

- **`supabase.ts` backend uses `!` assertions on env vars:** Acceptable — `index.ts` performs fail-fast validation before these are ever evaluated at runtime. The `!` is a valid "already validated" signal here.
- **`AuthCallback` cancellation guard (`cancelled` flag):** Correct React cleanup pattern. No issue.
- **`ProtectedRoute` three-state session:** Correct — `undefined/null/Session` is the right idiom for Supabase auth + React.
- **`rls.test.ts` skips when env vars absent:** Intentional and correct for a test that requires a live Supabase instance.
- **`rls.test.ts` line 14 — `anonClient` used for INSERT before verifying JWT claims:** The `restaurant_id` claim is set by the Custom Access Token Hook which runs at sign-in time. The INSERT relies on RLS using that claim. This is correct — it is testing the end-to-end path.

---

## Finding Summary

| ID    | Severity | File                                | Issue                                              |
|-------|----------|-------------------------------------|----------------------------------------------------|
| CR-01 | CRITICAL | `lib/mercadopago.ts:5`              | Eager init crashes on missing env var              |
| HI-01 | HIGH     | `pages/ForgotPassword.tsx:15-22`   | Errors silently swallowed, no observability        |
| HI-02 | HIGH     | `pages/Dashboard.tsx:26-49`        | `restaurantId === null` renders broken UI silently |
| ME-01 | MEDIUM   | `__tests__/rls.helpers.ts:41`      | New admin client per `destroyTestTenant` call      |
| ME-02 | MEDIUM   | `pages/AuthCallback.tsx:13-39`     | `?type=recovery` not handled, resets go to dashboard |
| ME-03 | MEDIUM   | `pages/Login.tsx:28-35`            | Email format not validated client-side             |
| LO-01 | LOW      | `__tests__/health.test.ts:10`      | `app: any` loses type safety                       |
| LO-02 | LOW      | `lib/auth.ts:10`                   | `getSession()` rejection not caught               |

---

_Reviewed: 2026-05-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: Standard_
