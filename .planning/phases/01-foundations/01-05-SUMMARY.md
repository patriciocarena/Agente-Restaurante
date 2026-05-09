---
plan: 01-05
phase: 01-foundations
status: complete
commit: 9ade1a0
---

# Plan 01-05 Summary — Deploy + CI

## Archivos creados/modificados

| Archivo | Descripción |
|---------|-------------|
| `railway.toml` (raíz) | Builder=NIXPACKS, buildCommand pnpm monorepo-aware, healthcheck /health |
| `apps/frontend/vercel.json` | SPA rewrite: `/(.*)` → `/index.html`, monorepo buildCommand |
| `.github/workflows/ci.yml` | pnpm install → tests → tsc backend & frontend → build frontend → SEC-04 + SEC-05 grep |
| `apps/backend/src/__tests__/rls.test.ts` | Live RLS isolation test (skip si faltan env vars) |
| `apps/backend/src/__tests__/rls.helpers.ts` | createTestTenant / destroyTestTenant via service role admin API |

## Deploy real

| Servicio | URL | Estado |
|----------|-----|--------|
| Backend (Railway) | https://agente-restaurantebackend-production.up.railway.app | ✅ Online — `/health` responde 200 |
| Frontend (Vercel) | https://agente-restaurante-frontend.vercel.app | ✅ Ready |
| Supabase URL config | Site URL + 2 redirect URLs (vercel + localhost) | ✅ Configurado |

## Verificación health

```bash
curl https://agente-restaurantebackend-production.up.railway.app/health
# {"status":"ok","ts":"2026-05-08T20:13:58.413Z"}
```

## Desviaciones del plan

- **Railway monorepo**: Railway por defecto usa npm (no soporta `workspace:*`). Solución: `railway.toml` en raíz con `pnpm install --frozen-lockfile && pnpm --filter ... build`. Root Directory en Railway debe estar **vacío** (no `apps/backend`) para que Nixpacks lea `packageManager: "pnpm@9.15.0"` del root package.json.
- **Doble railway.toml**: hubo un archivo en `apps/backend/railway.toml` que conflictuaba con el de raíz. Borrado (commit `2df0856`).
- **Bind 0.0.0.0**: Express por defecto bind a localhost en algunos Node versions, breaking Railway healthcheck. Fix explicit `app.listen(PORT, '0.0.0.0')` (commit `13ad4c4`).
- **MERCADO_PAGO_ACCESS_TOKEN**: removido de REQUIRED_ENV — se reincorpora en Phase 5 (commit `5da95d9`).
- **Config-as-code path** en Railway settings tuvo que actualizarse manualmente a `railway.toml` después de mover el archivo.

## Pendientes deferidos

| Item | Razón | Cuándo |
|------|-------|--------|
| Mercado Pago integration (env + webhook + plan creation) | Usuario decidió diferir hasta tener flujo de pedidos | Phase 5 |
| Onboarding real (menú, horarios, delivery, número Twilio) | Phase 1 solo necesitaba placeholder para el flow auth | Phase 2 |
| Live RLS test corriendo en CI | Requiere env vars de Supabase en GitHub Secrets | Phase 2+ |

## CI status

GitHub Actions workflow definido — corre en `push` a main y en PRs. Aún no validado en GitHub (sin push de PR todavía).
