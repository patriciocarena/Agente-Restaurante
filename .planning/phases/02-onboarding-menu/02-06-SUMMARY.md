---
phase: 02-onboarding-menu
plan: 06
subsystem: Frontend Routing & Onboarding Gate
tags: [routing, guards, dashboard, frontend]
completed_date: 2026-05-13
duration_minutes: 45
task_count: 1
completed_tasks: 1
tech_stack:
  patterns:
    - React hooks (useOnboardingGuard)
    - Route guards via wrapper components (OnboardingGate)
    - Conditional rendering based on loading/auth state
  added: []
key_files:
  created:
    - apps/frontend/src/lib/onboarding-guard.tsx
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/pages/Dashboard.tsx
requirements_closed: [ONB-01, ONB-02, ONB-03, ONB-04, ONB-06, MENU-01, MENU-02, MENU-03, MENU-04]
---

# Phase 2 Plan 6: Frontend Routing + Onboarding Guard + Dashboard Wiring Summary

Wave 3 wiring plan: integrated Plans 02-04 (Onboarding wizard) and 02-05 (MenuEditor + Settings) into the main App routing table, built the onboarding guard that gates /menu and /settings behind completion checks, and updated Dashboard to surface the Twilio number + CTAs.

## Task Execution

### Task 1: Onboarding Guard + App Routing + Dashboard Update ✓

**Status:** Completed

**Files Created:**
- `apps/frontend/src/lib/onboarding-guard.tsx` — Hook + component for post-wizard gating

**Files Modified:**
- `apps/frontend/src/App.tsx` — Added /menu and /settings routes with ProtectedRoute + OnboardingGate
- `apps/frontend/src/pages/Dashboard.tsx` — Extended post-onboarding state with Twilio pill + CTAs

**Implementation Details:**

1. **`onboarding-guard.tsx`** exports two entities:
   - `useOnboardingGuard()`: Hook that calls `api.resumeOnboarding()` and returns `OnboardingState` (loading | pending | complete | error)
   - `OnboardingGate`: Wrapper component that checks guard status and redirects pending users to /onboarding; complete users proceed normally
   - Pending state triggered when `has_restaurant === false` OR `onboarding_step < 4`
   - Loading skeleton shown while checking; errors allow access (backend will 401/403 if needed)

2. **`App.tsx` routing updates:**
   - Added imports: `MenuEditor`, `Settings`, `OnboardingGate`
   - New routes (inserted between /onboarding and /reset-password):
     - `/menu`: `<ProtectedRoute><OnboardingGate><MenuEditor /></OnboardingGate></ProtectedRoute>`
     - `/settings`: `<ProtectedRoute><OnboardingGate><Settings /></OnboardingGate></ProtectedRoute>`
   - Existing routes unchanged (/ → /dashboard, /login, /signup, /forgot-password, /auth/callback, /dashboard, /onboarding, /reset-password, * → /login)

3. **`Dashboard.tsx` enhancements:**
   - Extended post-onboarding state (else branch where `restaurantId` is a string)
   - Added state management: `restaurantData`, `loadingData`
   - New `useEffect` to fetch restaurant data via `api.getMe()` when `restaurantId` resolves
   - Updated UI to show:
     - Heading: "Tu restaurante está configurado"
     - Twilio number pill: Phone icon + number from `restaurantData.restaurant.twilio_number`
     - Forwarding docs link: "¿Cómo desvío mi línea? Ver guía" → `restaurantData.restaurant.forwarding_docs_url`
     - Primary CTA: Button linking to `/menu` with text "Cargar tu menú"
     - Ghost CTA: Button linking to `/settings` with text "Configuración"
     - Skeleton loading state while `getMe()` fetches data

**Verification Results:**
- ✓ onboarding-guard.tsx exists and exports both `useOnboardingGuard` and `OnboardingGate`
- ✓ api.resumeOnboarding() called in guard hook
- ✓ App.tsx contains both `/menu` and `/settings` route definitions
- ✓ Both routes wrapped with `ProtectedRoute + OnboardingGate`
- ✓ MenuEditor and Settings components imported correctly
- ✓ Dashboard.tsx displays all required strings: "Tu restaurante está configurado", "Cargar tu menú", forwarding link
- ✓ Dashboard.tsx calls api.getMe() to fetch Twilio number
- ✓ TypeScript compilation passes (`pnpm --filter @agente-restaurante/frontend exec tsc --noEmit`)
- ✓ All tests pass (11 tests, 3 test files)

**Commit:** `895b5dd` — feat(02-06): wire /menu and /settings routes + onboarding guard + Dashboard Twilio number + CTAs

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Verification

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-06-01 | Mitigated | OnboardingGate is UX-only. Backend re-checks auth via requireAuth + RLS on all endpoints. |
| T-06-02 | Mitigated | Direct navigation to /menu before wizard completion redirected to /onboarding by guard. Backend validates `restaurantId` presence on /api/menu-categories. |
| T-06-03 | Accepted | Twilio number displayed as operational identifier per PATTERNS.md carry-forward; RLS ensures user sees only their own number. |
| T-06-04 | Mitigated | UAT result will be recorded in Task 2 checkpoint resume-signal. |

## Next Steps

**Task 2 (Checkpoint: human-verify)** — Manual UAT of end-to-end flow:

The 17-step UAT checklist verifies: signup → wizard 4 steps → Dashboard Twilio pill + CTAs → /menu empty state + template load → realtime availability toggle → settings tabs → sign out/sign back in idempotency.

**When ready to proceed with UAT:**
- Start backend: `pnpm --filter @agente-restaurante/backend run dev`
- Start frontend: `pnpm --filter @agente-restaurante/frontend run dev`
- Open http://localhost:5173/signup
- Execute steps 1–17 from plan (lines 227–251)
- Report "uat passed" or provide step number + failure details

## Self-Check

**Files created:**
- ✓ `apps/frontend/src/lib/onboarding-guard.tsx` exists

**Files modified:**
- ✓ `apps/frontend/src/App.tsx` contains /menu and /settings routes
- ✓ `apps/frontend/src/pages/Dashboard.tsx` shows Twilio number and CTAs

**Commits verified:**
- ✓ `895b5dd` in git log

**Build validation:**
- ✓ TypeScript: 0 errors
- ✓ Tests: 11 passed, 3 files

**Self-Check: PASSED**

---

**Task 1 Complete.** Awaiting user execution of Task 2 UAT before proceeding to phase verification.
