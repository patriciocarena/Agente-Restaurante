# Phase 1: Foundations - Research

**Researched:** 2026-05-07
**Domain:** Supabase RLS + pnpm monorepo + Railway/Vercel deploy + Twilio AR availability
**Confidence:** HIGH (core stack), MEDIUM (Twilio AR local numbers)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Monorepo: `/apps/backend` (Node.js + Express + TypeScript → Railway), `/apps/frontend` (React + Vite + Tailwind → Vercel), `/packages/shared` (TypeScript types). Tooling: `pnpm workspaces`. No Turborepo.
- **D-02:** `menu_items` schema con `option_groups` + `option_items` y cardinalidad (min/max) desde Phase 1. `base_price` nullable (precio determinado por opción cuando es null).
- **D-03:** `restaurant_id` en JWT vía Custom Access Token Auth Hook de Supabase (no trigger + admin API call). El hook corre antes de emitir el token y agrega `restaurant_id` a `app_metadata`.
- **D-04:** RLS policies usan `(auth.jwt()->'app_metadata'->>'restaurant_id')::uuid`. Tablas con RLS estricta: `restaurants`, `menu_categories`, `menu_items`, `option_groups`, `option_items`, `orders`, `order_items`, `restaurant_counters`, `restaurant_hours`, `subscriptions`.
- **D-05:** Frontend usa solo Supabase anon key. Service role key solo en backend (Railway), nunca en bundle frontend.
- **D-06:** Cifrado en disco de Supabase (AES-256) es suficiente para v1. No se implementa pgcrypto.
- **D-07:** `customer_phone` nunca se loggea — ni en `console.log`, `logger.error`, Sentry, ni mensajes de error al cliente. Anotado en comments del código.
- **D-08:** `restaurant_counters`: `{id, restaurant_id (UNIQUE), last_order_number (int, default 0)}`.
- **D-09:** `subscriptions`: `{id, restaurant_id, mp_preapproval_id, status (trial|active|past_due|suspended|cancelled), current_period_end, created_at, updated_at}`.
- **D-10:** Mercado Pago SDK client singleton inicializado en el backend (sin API calls reales). Phase 5 asume que ya existe.

### Claude's Discretion

- Estructura exacta de `packages/shared` (qué tipos exportar primero).
- Configuración de `tsconfig.json` y `eslint`.
- Nombrado de variables de entorno (seguir convenciones estándar de Supabase/Railway/Vercel).
- Seeding de datos de test para development.

### Deferred Ideas (OUT OF SCOPE)

- pgcrypto column-level encryption — deferido, reevaluar si hay auditoría de compliance.
- Schema simple de menu_items — descartado, se usa schema enriquecido desde Phase 1.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | El dueño puede crear cuenta con email + password | Supabase `signUp()` con email/password — soportado en free plan |
| AUTH-02 | El dueño recibe email de verificación al crear cuenta | Supabase Auth envía email automático; `emailRedirectTo` configurable |
| AUTH-03 | El dueño puede iniciar sesión y mantener sesión activa cross-browser-refresh | Supabase maneja refresh tokens + `onAuthStateChange`; PKCE flow para SPAs |
| AUTH-04 | El dueño puede recuperar password vía email link | Supabase `resetPasswordForEmail()` — built-in |
| AUTH-05 | Cada cuenta solo ve datos de su propio restaurante (RLS estricto) | Custom Access Token Hook + RLS con `(auth.jwt()->'app_metadata'->>'restaurant_id')::uuid` |
| AUTH-06 | Claims del JWT incluyen `restaurant_id` para frontend con anon key + RLS | Custom Access Token Hook (disponible en free plan) — inyecta claim en `app_metadata` |
| AUTH-07 | El dueño puede cerrar sesión desde cualquier página | `supabase.auth.signOut()` — built-in |
| SEC-04 | Service role key del backend nunca expuesta al frontend | Variable de entorno sin prefijo `VITE_` → no incluida en bundle; validable con `vite build --mode production` |
| SEC-05 | Customer phone numbers cifrados en reposo; no en logs | Supabase AES-256 at rest por defecto; política de no-log implementada en código |
</phase_requirements>

---

## Summary

Phase 1 establece los cimientos: monorepo pnpm, schema Supabase completo con RLS multi-tenant, auth funcional (signup → verificación → login → logout → reset), y deploy conectado (Railway + Vercel). Es greenfield — no hay código existente.

El mecanismo crítico de multi-tenancy es el **Custom Access Token Auth Hook** de Supabase: una función PL/pgSQL que corre antes de emitir el JWT y agrega `restaurant_id` a `app_metadata`. Esto permite que las RLS policies lean `auth.jwt()->'app_metadata'->>'restaurant_id'` sin llamadas extra, y que el frontend use la anon key sin filtros manuales. Este hook está disponible en el **free plan** de Supabase.

Para Twilio AR: los números locales argentinos (+54) existen en Twilio pero requieren documentación regulatoria (ID gubernamental + comprobante de domicilio AR). Para el MVP la alternativa es más simple: **el restaurante desvía su celular/línea fija a un número Twilio US**, que no requiere documentación AR. Esta decisión impacta a Phase 2 (onboarding), no a Phase 1, pero el research está hecho.

**Primary recommendation:** Implementar el Custom Access Token Auth Hook para inyectar `restaurant_id` en el JWT. No usar triggers que llaman a `auth.admin.updateUserById()` — ese approach requiere permisos de service role desde Postgres, es más frágil y más difícil de depurar. El Hook approach es el que Supabase recomienda oficialmente y está documentado en sus guías.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth (signup/login/reset/logout) | Supabase Auth | Frontend (UI) | Auth logic vive en Supabase; frontend solo llama SDK |
| JWT custom claims (restaurant_id) | Database (PL/pgSQL Hook) | — | Hook corre server-side en Postgres antes de emitir token |
| RLS enforcement | Database (Supabase/Postgres) | — | RLS es a nivel DB, no en API ni frontend |
| Session persistence cross-refresh | Browser / Client | Supabase Auth | Supabase JS SDK maneja refresh tokens en localStorage/cookie |
| Service role key security | API / Backend | — | Railway env var; nunca en bundle frontend |
| Schema + migrations | Database | — | Supabase migrations SQL files |
| Monorepo build/deploy (backend) | Railway CI/CD | — | Railway detecta pnpm workspace automáticamente |
| Monorepo build/deploy (frontend) | Vercel CI/CD | — | Vercel detecta Vite automáticamente |
| Shared TypeScript types | Build-time (packages/shared) | — | No hay runtime; es solo tipos exportados |
| Phone encryption at rest | Database | — | Supabase AES-256 at rest, no requiere código custom |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.105.3 | DB client, Auth, Realtime | SDK oficial Supabase; maneja auth state, RLS, realtime |
| express | 5.2.1 | HTTP server backend | Estándar de facto Node.js; Railway lo detecta automáticamente |
| typescript | 6.0.3 | Type safety full-stack | Requerido por spec; permite `packages/shared` de tipos |
| react | 19.2.6 | UI frontend | Requerido por spec |
| vite | 8.0.11 | Build tool frontend | Requerido por spec; Vercel lo detecta sin config |
| tailwindcss | 4.2.4 | CSS utility frontend | Requerido por spec |
| mercadopago | 2.12.0 | MP SDK backend | SDK oficial; se inicializa en Phase 1, se usa en Phase 5 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.21.0 | Run TypeScript sin compilar | Desarrollo local backend; Railway usa el build compilado |
| @types/node | 25.6.1 | TypeScript types para Node | Siempre en backend TypeScript |
| @types/express | Bundled con express 5 | TypeScript types para Express | Siempre con Express + TypeScript |
| vitest | 4.1.5 | Test framework | Tests unitarios backend y frontend; misma API que Jest |
| supertest | 7.2.2 | HTTP test para Express | Tests de integración de endpoints backend |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Access Token Hook | Trigger + admin.updateUserById() | El trigger approach requiere service role en Postgres, es más frágil. El Hook es el approach oficial recomendado por Supabase. |
| pnpm workspaces | Turborepo | Turborepo agrega overhead innecesario para equipo pequeño. D-01 lo decidió explícitamente. |
| Railway | Fly.io, Render | Railway detecta pnpm monorepos automáticamente y tiene soporte de monorepo nativo con watchPaths por servicio. |

**Installation (monorepo root):**
```bash
npm install -g pnpm
pnpm init
# luego instalar por workspace:
pnpm --filter apps/backend add express @supabase/supabase-js mercadopago
pnpm --filter apps/frontend add react react-dom @supabase/supabase-js
```

**Version verification:** Versiones verificadas contra npm registry el 2026-05-07. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser: React + Vite + Tailwind]
        |
        | supabase.auth.signUp() / signIn()
        | (anon key solamente)
        v
[Supabase Auth]
        |
        | Custom Access Token Hook (PL/pgSQL)
        | -- query restaurants WHERE user_id = event.user_id
        | -- jsonb_set(claims, {app_metadata,restaurant_id}, ...)
        v
[JWT con restaurant_id en app_metadata]
        |
        +----> [Browser recibe JWT]
        |              |
        |              | supabase.from('restaurants').select()
        |              | (JWT incluido automáticamente)
        |              v
        |      [Supabase DB / Postgres]
        |              |
        |              | RLS: (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid = restaurant_id
        |              | Filtra filas automáticamente
        |              v
        |      [Solo filas del tenant correcto]
        |
        +----> [Railway: Node.js + Express]
                       | (service role key — nunca en frontend)
                       | Solo para operaciones admin (Phase 3+)
```

### Recommended Project Structure

```
/ (monorepo root)
├── pnpm-workspace.yaml         # define packages: apps/*, packages/*
├── package.json                # root scripts: lint, test
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── railway.toml        # deploy config (watchPaths, startCommand)
│   │   └── src/
│   │       ├── index.ts        # Express app entry
│   │       ├── lib/
│   │       │   ├── supabase.ts # service role client singleton
│   │       │   └── mercadopago.ts # MP client singleton (Phase 5 placeholder)
│   │       └── routes/
│   │           └── health.ts   # GET /health para Railway
│   └── frontend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── lib/
│           │   └── supabase.ts # anon key client
│           └── pages/
│               ├── Login.tsx
│               ├── Signup.tsx
│               └── Dashboard.tsx
├── packages/
│   └── shared/
│       ├── package.json
│       └── src/
│           └── index.ts        # tipos: Restaurant, MenuItem, OptionGroup, etc.
└── supabase/
    └── migrations/
        └── 0001_initial_schema.sql
```

### Pattern 1: Custom Access Token Hook (RLS multi-tenant)

**What:** Función PL/pgSQL que Supabase Auth invoca antes de emitir el JWT. Agrega `restaurant_id` al claim `app_metadata`.

**When to use:** Siempre que el frontend necesite acceder a datos tenant-aislados con anon key sin filtros manuales.

**Example:**
```sql
-- Source: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
-- [VERIFIED: Context7 / Supabase official docs]

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_restaurant_id uuid;
BEGIN
  claims := event->'claims';

  -- Buscar el restaurant_id del usuario
  SELECT id INTO v_restaurant_id
  FROM public.restaurants
  WHERE owner_id = (event->>'user_id')::uuid
  LIMIT 1;

  -- Asegurar que app_metadata existe
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- Inyectar restaurant_id
  IF v_restaurant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,restaurant_id}', to_jsonb(v_restaurant_id));
  ELSE
    -- Usuario sin restaurante aún (recién registrado) — claim vacío
    claims := jsonb_set(claims, '{app_metadata,restaurant_id}', 'null');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Permisos obligatorios para que el hook funcione
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT ALL ON TABLE public.restaurants TO supabase_auth_admin;
REVOKE ALL ON TABLE public.restaurants FROM authenticated, anon, public;
```

**Habilitación:** Dashboard → Authentication → Hooks → "Custom Access Token" → seleccionar función `public.custom_access_token_hook`. Disponible en free plan. [VERIFIED: supabase.com/docs]

**Implication:** Cuando un usuario se registra y aún no tiene restaurante, el claim es `null`. El frontend debe redirigir al onboarding (Phase 2) si `restaurant_id === null`.

### Pattern 2: RLS Policy con custom claim

**What:** Política FOR ALL en cada tabla que filtra por `restaurant_id` del JWT.

```sql
-- Source: Supabase official docs + verified pattern
-- [VERIFIED: Context7 / Supabase llms_txt]

-- Habilitar RLS en tabla
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Política estándar para tablas con restaurant_id
CREATE POLICY "tenant_isolation"
ON restaurants FOR ALL
TO authenticated
USING (
  id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
)
WITH CHECK (
  id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
);

-- Para tablas hijas (menu_items, orders, etc.) que tienen restaurant_id directo:
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation"
ON menu_items FOR ALL
TO authenticated
USING (
  restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
)
WITH CHECK (
  restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
);
```

### Pattern 3: pnpm Workspace con workspace: protocol

```yaml
# pnpm-workspace.yaml — root del monorepo
# [VERIFIED: Context7 / pnpm.io docs]
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// apps/backend/package.json
{
  "name": "@agente-restaurante/backend",
  "dependencies": {
    "@agente-restaurante/shared": "workspace:*"
  }
}
```

```json
// packages/shared/package.json
{
  "name": "@agente-restaurante/shared",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

### Pattern 4: Railway monorepo config

```toml
# apps/backend/railway.toml
# [CITED: docs.railway.com/deployments/monorepo]
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install --frozen-lockfile && pnpm --filter @agente-restaurante/backend build"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"

[deploy.watchPaths]
include = ["apps/backend/**", "packages/shared/**"]
```

### Pattern 5: Mercado Pago client singleton

```typescript
// apps/backend/src/lib/mercadopago.ts
// [VERIFIED: github.com/mercadopago/sdk-nodejs]
import { MercadoPagoConfig } from 'mercadopago';

// Singleton — se inicializa una vez, se reutiliza en toda la app
// NOTA: En Phase 1 solo se inicializa; los API calls van en Phase 5
export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});
```

### Pattern 6: Verificar que service role key no está en bundle frontend

```bash
# Después de vite build, verificar que SUPABASE_SERVICE_ROLE_KEY no aparece:
grep -r "service_role" apps/frontend/dist/ && echo "LEAK DETECTED" || echo "OK — no leak"
```

La variable de entorno del backend es `SUPABASE_SERVICE_ROLE_KEY` (sin prefijo `VITE_`). Vite solo expone al bundle las variables con prefijo `VITE_`. [VERIFIED: vite.dev/guide/env-and-mode]

### Anti-Patterns to Avoid

- **No usar `auth.users.raw_app_meta_data` directo para actualizar claims desde un trigger:** Requiere llamar `auth.admin.updateUserById()` desde Postgres, lo que necesita la service role key accesible en Postgres. Es más frágil que el hook y crea una superficie de ataque.
- **No poner `SUPABASE_SERVICE_ROLE_KEY` con prefijo `VITE_`:** Quedaría expuesta en el bundle del frontend y cualquier usuario podría bypasear RLS.
- **No crear una sola RLS policy `FOR SELECT`:** Usar `FOR ALL` (o policies separadas por operación) para cubrir INSERT/UPDATE/DELETE también.
- **No asumir que RLS está activo por defecto:** `ALTER TABLE <nombre> ENABLE ROW LEVEL SECURITY` debe ejecutarse explícitamente en cada tabla.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email verification flow | Custom email tokens, expiración, reenvío | Supabase Auth built-in | Maneja tokens, expiración, reenvío, templates |
| Password reset | Custom reset flow | Supabase `resetPasswordForEmail()` | Built-in con email seguro y expiración |
| Session refresh | Manual refresh de JWT | Supabase JS SDK `onAuthStateChange` | SDK maneja refresh automático cross-tab |
| JWT custom claims | Trigger + admin API call manual | Custom Access Token Auth Hook | Hook oficial, más simple y soportado |
| Tenant isolation | Filtros manuales en queries | Supabase RLS con auth.jwt() | RLS es a nivel DB, imposible bypassear desde app layer |
| Monorepo build cache | Scripts custom de build | pnpm workspaces filter | `pnpm --filter` es la forma canónica |

**Key insight:** En Supabase, la seguridad multi-tenant implementada a nivel RLS no puede ser bypasseada desde el application layer. Un bug en el frontend o backend no puede filtrar datos de otro tenant si RLS está correctamente configurado con `(auth.jwt()->'app_metadata'->>'restaurant_id')::uuid`.

---

## Common Pitfalls

### Pitfall 1: RLS no habilitado en tabla nueva

**What goes wrong:** Se crea la tabla pero se olvida `ALTER TABLE X ENABLE ROW LEVEL SECURITY`. Cualquier usuario autenticado puede leer todas las filas.
**Why it happens:** Postgres no habilita RLS por defecto.
**How to avoid:** Incluir `ENABLE ROW LEVEL SECURITY` en la misma migración que el `CREATE TABLE`. Verificar con `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
**Warning signs:** Un tenant ve datos de otro tenant en queries.

### Pitfall 2: JWT sin restaurant_id en el primer login post-signup

**What goes wrong:** El usuario crea cuenta, el hook intenta leer `restaurants WHERE owner_id = user_id` pero el INSERT a `restaurants` aún no ocurrió (porque es el primer login). El claim `restaurant_id` queda `null`. El frontend falla silenciosamente o muestra 0 filas.
**Why it happens:** Signup y creación del restaurante son dos pasos separados. El hook solo ve lo que ya existe en DB.
**How to avoid:** El frontend debe manejar `restaurant_id === null` en el JWT como señal de redirigir al onboarding (Phase 2). Documentar este estado en el hook con un comment claro.
**Warning signs:** Loops de redirect, dashboard vacío después de signup.

### Pitfall 3: pnpm no instalado en CI/CD de Railway

**What goes wrong:** Railway intenta `npm install` en vez de `pnpm install`, falla con frozen-lockfile.
**Why it happens:** Railway detecta pnpm si hay `pnpm-lock.yaml` presente, pero puede no tener la versión correcta.
**How to avoid:** Agregar `"packageManager": "pnpm@9.x"` en el `package.json` raíz (Corepack standard). Railway respeta esto con Railpack builder (default desde 2025).
**Warning signs:** Build logs muestran `npm: command not found` o `pnpm-lock.yaml out of sync`.

### Pitfall 4: VITE_ prefix leaks service role key

**What goes wrong:** Se define `VITE_SUPABASE_SERVICE_ROLE_KEY` en Vercel para un workaround rápido. Queda expuesta en el bundle JS.
**Why it happens:** Confundir variables del frontend con las del backend.
**How to avoid:** Service role key solo en Railway (backend). Frontend usa solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Validar con `grep -r "service_role" apps/frontend/dist/` después del build.
**Warning signs:** Vite build incluye la key; cualquier usuario puede verla en DevTools → Sources.

### Pitfall 5: `option_groups` sin RLS cuando `menu_items` sí tiene

**What goes wrong:** Se agrega RLS a `menu_items` pero se olvida `option_groups` y `option_items`. Un tenant puede leer los option groups de otro tenant via joins o queries directas.
**Why it happens:** Las tablas hijas se olvidan cuando son muchas.
**How to avoid:** Definir RLS en el mismo migration SQL para todas las tablas del schema de una vez. Checklist de tablas: `restaurants`, `menu_categories`, `menu_items`, `option_groups`, `option_items`, `orders`, `order_items`, `restaurant_counters`, `restaurant_hours`, `subscriptions`.
**Warning signs:** Query a `option_groups` sin `restaurant_id` en la tabla — indica que la política usa una condición indirecta que puede no funcionar.

### Pitfall 6: Twilio AR local numbers require documentation

**What goes wrong:** Se intenta comprar un número local +54 en Twilio para el piloto, Twilio rechaza la compra sin documentación regulatoria (ID + domicilio AR).
**Why it happens:** ENACOM exige que Twilio verifique la identidad del adquirente de números AR.
**How to avoid:** Para el MVP usar la alternativa: el restaurante desvía su celular/fija a un número Twilio US (+1). No requiere documentación AR. Decisión final en Phase 2.
**Warning signs:** Twilio Console muestra error "regulatory bundle required" al intentar comprar número AR.

---

## Code Examples

### Schema SQL completo (Migration 0001)

```sql
-- Source: diseñado según D-02..D-09 del CONTEXT.md
-- [ASSUMED: estructura SQL específica, pero basada en decisiones locked]

-- === RESTAURANTS ===
CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  name text NOT NULL,
  slug text UNIQUE,
  address text,
  phone text,
  agent_name text DEFAULT 'Sofía',
  vapi_assistant_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON restaurants FOR ALL TO authenticated
  USING (id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- === MENU CATEGORIES ===
CREATE TABLE menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  name text NOT NULL,
  sort_order int DEFAULT 0
);
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON menu_categories FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- === MENU ITEMS ===
CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  category_id uuid REFERENCES menu_categories,
  name text NOT NULL,
  description text,
  base_price int,  -- nullable: null = precio determinado por option_items
  available boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON menu_items FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- === OPTION GROUPS (pertenecen a menu_items, aislados vía join) ===
-- Nota: option_groups no tiene restaurant_id directo.
-- RLS usa menu_items para la verificación de tenant.
CREATE TABLE option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid REFERENCES menu_items NOT NULL,
  name text NOT NULL,
  min_selections int DEFAULT 0,
  max_selections int DEFAULT 1,
  sort_order int DEFAULT 0
);
ALTER TABLE option_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON option_groups FOR ALL TO authenticated
  USING (
    menu_item_id IN (
      SELECT id FROM menu_items
      WHERE restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
    )
  )
  WITH CHECK (
    menu_item_id IN (
      SELECT id FROM menu_items
      WHERE restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
    )
  );

-- === OPTION ITEMS ===
CREATE TABLE option_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id uuid REFERENCES option_groups NOT NULL,
  name text NOT NULL,
  price_delta int DEFAULT 0,
  is_default boolean DEFAULT false,
  sort_order int DEFAULT 0
);
ALTER TABLE option_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON option_items FOR ALL TO authenticated
  USING (
    option_group_id IN (
      SELECT og.id FROM option_groups og
      JOIN menu_items mi ON mi.id = og.menu_item_id
      WHERE mi.restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
    )
  )
  WITH CHECK (
    option_group_id IN (
      SELECT og.id FROM option_groups og
      JOIN menu_items mi ON mi.id = og.menu_item_id
      WHERE mi.restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
    )
  );

-- === ORDERS ===
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  order_number int NOT NULL,
  status text DEFAULT 'NUEVO',  -- NUEVO|EN_PREPARACION|LISTO|ENTREGADO
  customer_name text,
  customer_phone text,  -- PII: nunca loggear (D-07)
  fulfillment_type text NOT NULL,  -- 'retiro' | 'delivery'
  delivery_address text,
  call_id text UNIQUE,  -- idempotencia (CALL-02)
  transcript text,
  total int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON orders FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- === ORDER ITEMS ===
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders NOT NULL,
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  menu_item_id uuid REFERENCES menu_items,
  name text NOT NULL,
  quantity int NOT NULL,
  unit_price int NOT NULL,
  modifiers jsonb DEFAULT '[]',
  note text
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON order_items FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- === RESTAURANT COUNTERS (D-08) ===
CREATE TABLE restaurant_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL UNIQUE,
  last_order_number int DEFAULT 0
);
ALTER TABLE restaurant_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON restaurant_counters FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- === RESTAURANT HOURS ===
CREATE TABLE restaurant_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  day_of_week int NOT NULL,  -- 0=Dom, 1=Lun, ..., 6=Sab
  open_time time,
  close_time time,
  is_closed boolean DEFAULT false
);
ALTER TABLE restaurant_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON restaurant_hours FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- === SUBSCRIPTIONS (D-09) ===
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL UNIQUE,
  mp_preapproval_id text,
  status text DEFAULT 'trial',  -- trial|active|past_due|suspended|cancelled
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON subscriptions FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);
```

### Supabase client — Frontend (anon key solamente)

```typescript
// apps/frontend/src/lib/supabase.ts
// [VERIFIED: Context7 / Supabase official docs]
import { createClient } from '@supabase/supabase-js';

// Solo VITE_ prefix — estas variables van al bundle del browser
// NUNCA agregar VITE_SUPABASE_SERVICE_ROLE_KEY
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Supabase client — Backend (service role key)

```typescript
// apps/backend/src/lib/supabase.ts
// [VERIFIED: Context7 / Supabase official docs]
import { createClient } from '@supabase/supabase-js';

// Service role key: bypassea RLS — solo para operaciones admin del backend
// NUNCA exponer al frontend
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

### Auth signup (frontend)

```typescript
// apps/frontend/src/pages/Signup.tsx (fragmento)
// [VERIFIED: Context7 / Supabase JS docs]
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});
// Si !error: mostrar "Revisá tu email para confirmar tu cuenta"
// El Custom Access Token Hook no tiene restaurant_id aún (no existe el restaurante)
// → redirigir a onboarding en Phase 2
```

### Verificar no-leak de service role en build

```bash
# SEC-04: ejecutar después de cada build frontend
vite build --mode production
grep -r "service.role\|SUPABASE_SERVICE_ROLE_KEY" apps/frontend/dist/ \
  && echo "ERROR: service role key leaked" \
  || echo "OK: no leak detected"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trigger + `auth.admin.updateUserById()` para custom claims | Custom Access Token Auth Hook (PL/pgSQL) | Supabase 2024 | Hook es más simple, oficial y soportado en free plan |
| ElevenLabs para TTS español | Azure Neural `es-AR-ElenaNeural` | Decisión de proyecto | 85% más barato; voz argentina nativa |
| Turborepo para monorepo | pnpm workspaces (sin Turborepo) | Decisión de proyecto | Menos overhead; Turborepo overkill para equipo chico |
| Nixpacks en Railway | Railpack (builder por defecto desde 2025) | Railway 2025 | Builds más rápidos; detecta pnpm automáticamente |

**Deprecated/outdated:**
- `auth.jwt() ->> 'app_metadata'` (string cast): usar `auth.jwt()->'app_metadata'->>'restaurant_id'` para navegar el JSON correctamente.
- `raw_user_meta_data` para claims de autorización: usar `app_metadata` (no modificable por el usuario).

---

## Twilio Argentina: Research Findings

**Contexto:** El research de Twilio AR está en scope de Phase 1 (flag explícito en ROADMAP). Impacta el diseño del onboarding de Phase 2.

### Números locales AR (+54)
- Twilio ofrece números locales AR con prefijo +54. [CITED: twilio.com/en-us/guidelines/ar/regulatory]
- **Requisito regulatorio:** Para comprar un número AR, Twilio exige documentación (identity + domicilio AR): ID gubernamental o pasaporte + comprobante de domicilio argentino (factura de servicio, etc.). PO Box no es aceptable.
- **Implication:** Para el MVP con el piloto Wonder, si el dueño es argentino puede proveer la documentación. Pero agrega fricción al proceso de signup.

### Alternativa MVP: Forwarding desde celular del restaurante
- El restaurante desvía su celular o línea fija a un número Twilio US (+1). No requiere documentación AR.
- Twilio admite forwarding entrante desde cualquier número al número US.
- **Costo:** Número Twilio US ~$1/mes + costo de llamadas internacionales (cliente → Twilio US → back). Este costo se transfiere al restaurante (vía plan del SaaS).
- **Decisión de Phase 2:** Elegir entre (a) números AR con documentación requerida en onboarding, o (b) forwarding desde celular sin documentación. Para el MVP con Wonder se recomienda (b). [MEDIUM confidence — basado en docs de Twilio + research web]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `option_groups` y `option_items` se aislan via JOIN a `menu_items` en RLS (no tienen `restaurant_id` directo) | Schema SQL, RLS Pattern | Si el JOIN en RLS es demasiado lento para tablas grandes, agregar `restaurant_id` directo a `option_groups`. Para MVP el volumen es bajo. |
| A2 | El forwarding desde celular argentino a número Twilio US funciona técnicamente sin latencia significativa | Twilio AR section | Si hay latencia excesiva, el voice pipeline Vapi completo puede superar los 800ms NFR |
| A3 | Supabase free plan alcanza para Phase 1 (auth + DB + storage para MVP) | Standard Stack | Supabase free tiene 500MB DB y 50.000 MAU; suficiente para piloto. Si se escala rápido, upgradear a Pro |
| A4 | Railway starter plan alcanza para el backend en Phase 1 ($5/mes) | Environment | No verificado en Railway console; asumir que el plan mínimo soporta una app Node.js con tráfico de piloto |

---

## Open Questions

1. **Twilio AR: ¿tiene Wonder acceso a documentación para número AR local?**
   - What we know: Twilio exige ID + domicilio AR para comprar número +54
   - What's unclear: Si el dueño de Wonder puede o quiere proveer esa documentación durante onboarding
   - Recommendation: Arrancar Phase 2 con la opción de forwarding (sin documentación); agregar opción de número AR como feature posterior

2. **Supabase plan actual del proyecto: ¿free o pro?**
   - What we know: Custom Access Token Hook está disponible en free y pro
   - What's unclear: Si el proyecto ya tiene un proyecto Supabase creado o hay que crearlo
   - Recommendation: Crear el proyecto Supabase en free plan para Phase 1; el hook funciona en free

3. **¿Se necesita Supabase CLI para manejar migrations?**
   - What we know: Las migrations se pueden aplicar vía SQL Editor del dashboard o via CLI
   - What's unclear: Si el equipo usará Supabase CLI (requiere Docker para local dev) o solo el dashboard
   - Recommendation: Para Phase 1 usar el SQL Editor del dashboard (Docker no disponible en este entorno). Introducir CLI en Phase posterior si se necesita local dev completo.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v24.13.1 | — |
| pnpm | Monorepo tooling | ✗ | — | `npm install -g pnpm` como Wave 0 task |
| Docker | Supabase local dev | ✗ | — | Usar Supabase cloud dashboard + SQL Editor |
| Supabase CLI | Migrations CLI | ✗ | — | Usar SQL Editor en Supabase dashboard |
| git | Version control | ✓ | (repo existente) | — |

**Missing dependencies con fallback:**
- `pnpm` — instalar con `npm install -g pnpm` como primer task de Wave 0
- `supabase CLI` — para Phase 1 las migrations se aplican manualmente vía Supabase Dashboard SQL Editor; no hay bloqueo. Agregar CLI cuando haya Docker disponible.

**Missing dependencies blocking:**
- Ninguno — el path de desarrollo via cloud dashboard + Railway + Vercel funciona sin Docker ni CLI local.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | Wave 0 — crear `apps/backend/vitest.config.ts` y `apps/frontend/vitest.config.ts` |
| Quick run command | `pnpm --filter @agente-restaurante/backend test --run` |
| Full suite command | `pnpm -r test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Supabase signUp crea usuario | Smoke (manual) | N/A — requiere Supabase cloud | Wave 0: documentar como test manual |
| AUTH-02 | Email de verificación se envía | Manual | N/A | Manual — verificar en email |
| AUTH-03 | Sesión persiste cross-browser-refresh | Manual | N/A | Manual — verificar en browser |
| AUTH-04 | Reset password envía email | Manual | N/A | Manual — verificar en email |
| AUTH-05 | RLS: tenant A no ve datos de tenant B | Integration (SQL) | `psql $DB -f tests/rls-tenant-isolation.sql` | ❌ Wave 0 |
| AUTH-06 | JWT contiene restaurant_id | Unit (hook SQL) | Test manual via `supabase.auth.getSession()` | ❌ Wave 0 |
| AUTH-07 | signOut limpia sesión | Manual | N/A | Manual |
| SEC-04 | service_role_key no en bundle | Build check | `grep -r service.role apps/frontend/dist/` | ❌ Wave 0 — script en package.json |
| SEC-05 | customer_phone no en logs | Code review | `grep -r "customer_phone" apps/backend/src/ \| grep -v "//.*customer_phone"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @agente-restaurante/backend test --run`
- **Per wave merge:** `pnpm -r test --run && grep -r "service.role" apps/frontend/dist/ && echo FAIL || echo OK`
- **Phase gate:** Todos los checks verdes + test manual de RLS (crear 2 cuentas, verificar aislamiento)

### Wave 0 Gaps
- [ ] `apps/backend/vitest.config.ts` — config básica
- [ ] `apps/frontend/vitest.config.ts` — config básica
- [ ] `scripts/check-sec04.sh` — grep para service role key en bundle
- [ ] `supabase/tests/rls-tenant-isolation.sql` — script SQL que verifica aislamiento con 2 tenants
- [ ] Framework install: `npm install -g pnpm` — si pnpm no está disponible

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth (email+password, email verification, session management) |
| V3 Session Management | Yes | Supabase JS SDK maneja refresh tokens automáticamente |
| V4 Access Control | Yes | RLS con `(auth.jwt()->'app_metadata'->>'restaurant_id')::uuid` — multi-tenant isolation |
| V5 Input Validation | Yes (básico en Phase 1) | TypeScript types en `packages/shared`; validación de env vars al startup |
| V6 Cryptography | Yes | Supabase AES-256 at rest (no hand-rolled); customer_phone protegido por at-rest encryption + no-log policy |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant data leak (cross-tenant query) | Information Disclosure | RLS con custom JWT claim; verificación de aislamiento con 2 tenants de prueba |
| Service role key exposure | Elevation of Privilege | Variables sin prefijo VITE_; grep check post-build (SEC-04) |
| customer_phone en logs | Information Disclosure | D-07: no-log policy + comments en código; grep check (SEC-05) |
| JWT tampering | Tampering | Supabase firma JWTs con secret; no se puede modificar el claim sin la clave |
| signup sin email verification | Authentication bypass | Supabase requiere verificación por defecto; no deshabilitar en dashboard |

---

## Sources

### Primary (HIGH confidence)
- `/llmstxt/supabase_llms_txt` (Context7) — RLS policies, Custom Access Token Hook, email auth, signUp/signOut patterns
- `supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook` — disponibilidad en free plan, SQL function pattern
- `supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac` — RBAC + custom claims
- `/websites/pnpm_io` (Context7) — workspace protocol, pnpm-workspace.yaml, dependenciesMeta
- `github.com/mercadopago/sdk-nodejs` — MercadoPagoConfig initialization pattern
- `npm registry` — versiones verificadas de todos los paquetes el 2026-05-07

### Secondary (MEDIUM confidence)
- `docs.railway.com/deployments/monorepo` — Railway pnpm workspace support, railway.toml, watchPaths
- `vite.dev/guide/env-and-mode` — VITE_ prefix, env var exposure rules
- `twilio.com/en-us/guidelines/ar/regulatory` — documentación requerida para números AR

### Tertiary (LOW confidence)
- WebSearch sobre Twilio AR forwarding workaround — basado en múltiples fuentes secundarias, no verificado con Twilio directamente
- Estimación de precios Railway y Supabase free plan para el piloto

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versiones verificadas contra npm registry
- Architecture (RLS + Hook): HIGH — verificado con Supabase official docs + Context7
- pnpm workspaces: HIGH — verificado con Context7 + Railway docs
- Twilio AR: MEDIUM — documentación regulatoria verificada; workaround de forwarding es LOW confidence
- Pitfalls: HIGH — basados en patterns conocidos de Supabase multi-tenancy

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable stack; Twilio AR policy puede cambiar antes)
