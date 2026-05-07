---
phase: 1
slug: foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + supertest/jest (backend) |
| **Config file** | `apps/frontend/vitest.config.ts` / `apps/backend/jest.config.ts` — Wave 0 installs |
| **Quick run command** | `pnpm --filter frontend test:run && pnpm --filter backend test` |
| **Full suite command** | `pnpm test` (root workspace) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter frontend test:run && pnpm --filter backend test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | — | Signup crea user en auth.users | integration | `pnpm --filter backend test -- auth.test` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-02 | — | Login retorna JWT válido | integration | `pnpm --filter backend test -- auth.test` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 2 | AUTH-03 | — | JWT incluye `restaurant_id` en app_metadata | unit | `pnpm --filter backend test -- jwt.test` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 2 | AUTH-04 | — | RLS devuelve 0 filas para otro tenant | integration | `pnpm --filter backend test -- rls.test` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 3 | SEC-04 | — | Service role key no en bundle Vite | static | `grep -r "SUPABASE_SERVICE_ROLE" apps/frontend/dist/ && exit 1 || exit 0` | ✅ | ⬜ pending |
| 1-01-06 | 01 | 3 | SEC-05 | — | Phone numbers cifrados en reposo (no en logs) | unit | `pnpm --filter backend test -- encryption.test` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 4 | AUTH-05 | — | Sesión persiste cross-browser-refresh | e2e (manual) | — | — | ⬜ pending |
| 1-01-08 | 01 | 4 | AUTH-06 | — | Email de verificación enviado | integration | `pnpm --filter backend test -- email.test` | ❌ W0 | ⬜ pending |
| 1-01-09 | 01 | 4 | AUTH-07 | — | Tenant isolation: todas las tablas | integration | `pnpm --filter backend test -- rls.test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/__tests__/auth.test.ts` — stubs para AUTH-01, AUTH-02, AUTH-06
- [ ] `apps/backend/src/__tests__/jwt.test.ts` — stubs para AUTH-03
- [ ] `apps/backend/src/__tests__/rls.test.ts` — stubs para AUTH-04, AUTH-07
- [ ] `apps/backend/src/__tests__/encryption.test.ts` — stubs para SEC-05
- [ ] `apps/backend/jest.config.ts` + dependencias jest/ts-jest
- [ ] `apps/frontend/vitest.config.ts` + dependencias vitest

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sesión persiste cross-browser-refresh | AUTH-05 | Requiere browser real con storage | Loguearse en Chrome, cerrar/reabrir pestaña, verificar sesión activa |
| Email de verificación recibido | AUTH-06 | Requiere bandeja de entrada real | Signup con email real, verificar llegada en <2 min |
| Deploy Railway conecta a Supabase | AUTH-07 | Requiere infra en producción | Hacer request al endpoint `/health` de Railway |
| Deploy Vercel conecta a Supabase | AUTH-07 | Requiere infra en producción | Abrir URL de Vercel, verificar auth flow completo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
