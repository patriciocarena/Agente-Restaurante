---
plan: 01-04
phase: 01-foundations
status: complete
commit: 2aecbae
---

# Plan 01-04 Summary — Frontend React Auth Pages

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `apps/frontend/src/lib/supabase.ts` | Cliente Supabase con anon key (NO service role — SEC-04) |
| `apps/frontend/src/lib/auth.ts` | Hooks `useSession`, `useRestaurantId`, `signOut` |
| `apps/frontend/src/pages/Login.tsx` | Form de login con validación + manejo de errores |
| `apps/frontend/src/pages/Signup.tsx` | Form de registro con `emailRedirectTo` → /auth/callback |
| `apps/frontend/src/pages/ForgotPassword.tsx` | Reset password vía Supabase magic link |
| `apps/frontend/src/pages/AuthCallback.tsx` | Handler del code exchange post-email-confirmation |
| `apps/frontend/src/pages/Dashboard.tsx` | Welcome + botón "Configurar restaurante" |
| `apps/frontend/src/pages/Onboarding.tsx` | Placeholder Phase 1 (configuración real en Phase 2) |
| `apps/frontend/src/pages/ProtectedRoute.tsx` | Guard auth — redirige a /login si no hay sesión |
| `apps/frontend/src/App.tsx` | Router con 7 rutas (login/signup/forgot/callback/dashboard/onboarding/*) |
| `apps/frontend/src/components/ui/*` | shadcn primitives (button, card, input, label, alert) |

## Theme y copy

- Dark theme por defecto (CSS vars en `globals.css`).
- Copy en español rioplatense ("Iniciá sesión", "¿No tenés cuenta? Registrate").

## Verificación E2E (manual, en producción)

| Flow | Resultado |
|------|-----------|
| Signup con email + password | ✅ Email de confirmación llega |
| Click en link del email → /auth/callback?code=... | ✅ exchangeCodeForSession + redirect a /dashboard |
| Login con email + password | ✅ Acceso al dashboard |
| Click "Configurar restaurante" | ✅ /onboarding (placeholder) |
| Cerrar sesión | ✅ Redirige a /login |

## Desviaciones del plan

- **Bug post-deploy 1**: AuthCallback original llamaba `exchangeCodeForSession(window.location.href)` — la función espera solo el `code`, no la URL. Fix en commit `d48603f`.
- **Bug post-deploy 2**: Dashboard linkeaba a `/onboarding` pero la ruta no existía. Catch-all mandaba al `/login`. Fix: agregar página placeholder `Onboarding.tsx` + ruta protegida.

## TypeScript compile

```
pnpm --filter @agente-restaurante/frontend exec tsc --noEmit → exit 0 ✅
```

## SEC-04 (service role key NO en bundle)

```
scripts/check-sec04.sh → LIMPIO ✅
```
