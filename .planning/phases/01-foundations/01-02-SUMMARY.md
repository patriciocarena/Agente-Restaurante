---
plan: 01-02
phase: 01-foundations
status: complete
commit: 8c76741
---

# Plan 01-02 Summary — Supabase Schema + RLS + Auth

## DB schema

Tablas creadas (8): `restaurants`, `menu_items`, `orders`, `restaurant_counters`,
`restaurant_hours`, `subscriptions`, `webhook_events`, `auth.users` (managed).

## RLS (AUTH-05 / AUTH-06)

- Policies definidas en cada tabla tenant-scoped: `(auth.jwt()->'app_metadata'->>'restaurant_id')::uuid = restaurant_id`.
- Custom Access Token Hook PL/pgSQL inyecta `restaurant_id` en `app_metadata` del JWT al firmar sesión.

## Auth config (Supabase Dashboard)

- Email provider: enabled, double-confirm enabled.
- Custom Access Token Hook: enabled apuntando a `public.set_restaurant_id_claim`.
- Site URL: `https://agente-restaurante-frontend.vercel.app` (set en Plan 01-05).
- Redirect URLs: 2 entradas (vercel app + localhost:5173).

## Verificación SQL queries (manual en Supabase SQL Editor)

| Query | Resultado |
|-------|-----------|
| `SELECT proname FROM pg_proc WHERE proname = 'set_restaurant_id_claim'` | 1 row ✅ |
| `SELECT * FROM auth.hooks WHERE hook_name = 'custom_access_token'` | 1 row enabled ✅ |
| Policies en tablas tenant-scoped | 8 tablas con RLS enabled, policies activas ✅ |

## API keys obtenidas (configuradas en Railway / Vercel)

- `SUPABASE_URL`: `https://hzgunbftloevclkohcdf.supabase.co`
- `SUPABASE_ANON_KEY` (eyJ... legacy JWT) → frontend env + backend env
- `SUPABASE_SERVICE_ROLE_KEY` (eyJ... legacy JWT) → backend env (NUNCA frontend)

## Desviaciones del plan

- Las legacy keys (eyJ...) son válidas y funcionan; las nuevas `sb_publishable_...` / `sb_secret_...` quedan como path de migración futuro.
- Checkpoint manual en Supabase Dashboard tomó ~30 min con guía paso-a-paso del usuario.
