# Phase 1: Foundations - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 17 new files (greenfield — zero source code exists)
**Analogs found:** 0 / 17 (all from RESEARCH.md canonical patterns)

---

## Note on Greenfield Status

This project has no existing source code. The only files in the repository are planning artifacts under `.planning/` and `CLAUDE.md`. Every file listed below is net-new. Pattern assignments come exclusively from the canonical code examples in `01-RESEARCH.md`, which are verified against official documentation (Supabase, pnpm, Railway, Vite, Mercado Pago).

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `pnpm-workspace.yaml` | config | — | none (greenfield) | — |
| `package.json` (root) | config | — | none (greenfield) | — |
| `apps/backend/package.json` | config | — | none (greenfield) | — |
| `apps/backend/tsconfig.json` | config | — | none (greenfield) | — |
| `apps/backend/railway.toml` | config | — | none (greenfield) | — |
| `apps/backend/src/index.ts` | service | request-response | none (greenfield) | — |
| `apps/backend/src/lib/supabase.ts` | utility | request-response | none (greenfield) | — |
| `apps/backend/src/lib/mercadopago.ts` | utility | request-response | none (greenfield) | — |
| `apps/backend/src/routes/health.ts` | route | request-response | none (greenfield) | — |
| `apps/frontend/package.json` | config | — | none (greenfield) | — |
| `apps/frontend/tsconfig.json` | config | — | none (greenfield) | — |
| `apps/frontend/vite.config.ts` | config | — | none (greenfield) | — |
| `apps/frontend/src/main.tsx` | component | request-response | none (greenfield) | — |
| `apps/frontend/src/lib/supabase.ts` | utility | request-response | none (greenfield) | — |
| `apps/frontend/src/pages/Login.tsx` | component | request-response | none (greenfield) | — |
| `apps/frontend/src/pages/Signup.tsx` | component | request-response | none (greenfield) | — |
| `apps/frontend/src/pages/Dashboard.tsx` | component | request-response | none (greenfield) | — |
| `packages/shared/package.json` | config | — | none (greenfield) | — |
| `packages/shared/src/index.ts` | utility | transform | none (greenfield) | — |
| `supabase/migrations/0001_initial_schema.sql` | migration | CRUD | none (greenfield) | — |

---

## Pattern Assignments

### `pnpm-workspace.yaml` (config)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — Pattern 3: pnpm Workspace

**Core pattern:**
```yaml
# pnpm-workspace.yaml — root del monorepo
# Define qué directorios son workspaces
packages:
  - 'apps/*'
  - 'packages/*'
```

---

### `package.json` (root, config)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — Pattern 3 + Pitfall 3

**Core pattern:**
```json
{
  "name": "agente-restaurante",
  "private": true,
  "packageManager": "pnpm@9.x",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test --run",
    "lint": "pnpm -r lint"
  }
}
```

Note on `"packageManager"`: This field is required to avoid Pitfall 3 (Railway/CI not finding pnpm). Corepack reads it and activates the correct pnpm version automatically.

---

### `apps/backend/package.json` (config)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — Pattern 3 (workspace: protocol)

**Core pattern:**
```json
{
  "name": "@agente-restaurante/backend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@agente-restaurante/shared": "workspace:*",
    "@supabase/supabase-js": "^2.105.3",
    "express": "^5.2.1",
    "mercadopago": "^2.12.0"
  },
  "devDependencies": {
    "@types/node": "^25.6.1",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.5",
    "supertest": "^7.2.2"
  }
}
```

---

### `apps/backend/tsconfig.json` (config)

**Analog:** none (greenfield)
**Source pattern:** Standard TypeScript strict config for Node.js backend

**Core pattern:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

### `apps/backend/railway.toml` (config)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — Pattern 4: Railway monorepo config

**Core pattern:**
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

Note: `watchPaths` ensures Railway rebuilds the backend when `packages/shared` changes (types shared between packages).

---

### `apps/backend/src/index.ts` (service, request-response)

**Analog:** none (greenfield)
**Source pattern:** Standard Express 5 entry point + env validation

**Core pattern:**
```typescript
// apps/backend/src/index.ts
import express from 'express';
import { healthRouter } from './routes/health';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Validate required env vars at startup — fail fast
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MERCADO_PAGO_ACCESS_TOKEN'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

app.use(express.json());
app.use('/health', healthRouter);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

export default app;
```

Note: Fail-fast env validation pattern is critical to catch missing env vars at Railway deploy time rather than at first request.

---

### `apps/backend/src/lib/supabase.ts` (utility, request-response)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — "Supabase client — Backend (service role key)"

**Core pattern:**
```typescript
// apps/backend/src/lib/supabase.ts
// Service role key: bypassea RLS — solo para operaciones admin del backend
// NUNCA exponer al frontend — ver SEC-04
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

Key details:
- `persistSession: false` is mandatory for server-side clients (no cookie/localStorage on Node.js)
- Named `supabaseAdmin` (not `supabase`) to make it obvious this bypasses RLS at every call site

---

### `apps/backend/src/lib/mercadopago.ts` (utility, request-response)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — Pattern 5: Mercado Pago client singleton

**Core pattern:**
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

---

### `apps/backend/src/routes/health.ts` (route, request-response)

**Analog:** none (greenfield)
**Source pattern:** Standard Express health check — used by Railway `healthcheckPath`

**Core pattern:**
```typescript
// apps/backend/src/routes/health.ts
import { Router } from 'express';

export const healthRouter = Router();

// Railway calls GET /health to determine if the service is up
// Must return 2xx; Railway marks the deploy as failed otherwise
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});
```

---

### `apps/frontend/package.json` (config)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — Pattern 3 + standard Vite/React/Tailwind setup

**Core pattern:**
```json
{
  "name": "@agente-restaurante/frontend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "check-sec04": "grep -r 'service.role\\|SUPABASE_SERVICE_ROLE_KEY' dist/ && echo 'ERROR: leak detected' || echo 'OK'"
  },
  "dependencies": {
    "@agente-restaurante/shared": "workspace:*",
    "@supabase/supabase-js": "^2.105.3",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4.2.4",
    "typescript": "^6.0.3",
    "vite": "^8.0.11",
    "vitest": "^4.1.5"
  }
}
```

Note: `check-sec04` script implements SEC-04 validation (RESEARCH.md — Pattern 6). Run after every production build.

---

### `apps/frontend/tsconfig.json` (config)

**Analog:** none (greenfield)
**Source pattern:** Standard TypeScript strict config for browser/React

**Core pattern:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

---

### `apps/frontend/vite.config.ts` (config)

**Analog:** none (greenfield)
**Source pattern:** Standard Vite + React plugin config

**Core pattern:**
```typescript
// apps/frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // VITE_ prefix: only VITE_* env vars are exposed to the browser bundle
  // SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix) stays server-only
});
```

---

### `apps/frontend/src/main.tsx` (component, request-response)

**Analog:** none (greenfield)
**Source pattern:** Standard React 19 entry point with StrictMode

**Core pattern:**
```typescript
// apps/frontend/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

### `apps/frontend/src/lib/supabase.ts` (utility, request-response)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — "Supabase client — Frontend (anon key solamente)"

**Core pattern:**
```typescript
// apps/frontend/src/lib/supabase.ts
// [VERIFIED: Context7 / Supabase official docs]
import { createClient } from '@supabase/supabase-js';

// Solo VITE_ prefix — estas variables van al bundle del browser
// NUNCA agregar VITE_SUPABASE_SERVICE_ROLE_KEY (viola SEC-04)
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

---

### `apps/frontend/src/pages/Signup.tsx` (component, request-response)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — "Auth signup (frontend)" + Pitfall 2 handling

**Imports pattern:**
```typescript
import { useState } from 'react';
import { supabase } from '../lib/supabase';
```

**Core auth pattern:**
```typescript
// Signup con email + password
// emailRedirectTo: callback URL para Supabase email verification (AUTH-02)
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});

// Si !error: mostrar "Revisá tu email para confirmar tu cuenta"
// restaurant_id en JWT será null hasta que el usuario cree su restaurante
// → redirigir a onboarding en Phase 2 si session.user.app_metadata.restaurant_id === null
```

**Pitfall 2 guard (null restaurant_id after first signup):**
```typescript
// Después del login exitoso, verificar si tiene restaurante
const session = await supabase.auth.getSession();
const restaurantId = session.data.session?.user?.app_metadata?.restaurant_id;

if (!restaurantId) {
  // Usuario sin restaurante — mandar a onboarding (Phase 2)
  navigate('/onboarding');
} else {
  navigate('/dashboard');
}
```

---

### `apps/frontend/src/pages/Login.tsx` (component, request-response)

**Analog:** none (greenfield)
**Source pattern:** Supabase Auth signIn + session state

**Core auth pattern:**
```typescript
// signIn con email + password
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// logout desde cualquier página (AUTH-07)
const { error } = await supabase.auth.signOut();

// Session persistence cross-refresh (AUTH-03)
// Supabase SDK maneja esto automáticamente vía localStorage + onAuthStateChange
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') navigate('/login');
  if (event === 'SIGNED_IN') {
    const restaurantId = session?.user?.app_metadata?.restaurant_id;
    navigate(restaurantId ? '/dashboard' : '/onboarding');
  }
});
```

---

### `apps/frontend/src/pages/Dashboard.tsx` (component, request-response)

**Analog:** none (greenfield)
**Source pattern:** Standard auth-guarded page with Supabase anon key + RLS

**Core pattern:**
```typescript
// Consulta autenticada — RLS filtra automáticamente por restaurant_id del JWT
// No se necesita WHERE manual; Supabase lo aplica a nivel DB
const { data, error } = await supabase
  .from('restaurants')
  .select('*')
  .single();

// Si data es null, el restaurante aún no existe → redirigir a onboarding
```

---

### `packages/shared/package.json` (config)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — Pattern 3 (shared package, types-only)

**Core pattern:**
```json
{
  "name": "@agente-restaurante/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Note: `"main": "./src/index.ts"` (not `dist/`) is intentional — this package is types-only at build time, consumed directly by TypeScript's `moduleResolution: bundler`. No compilation step needed for the shared package in Phase 1.

---

### `packages/shared/src/index.ts` (utility, transform)

**Analog:** none (greenfield)
**Source pattern:** TypeScript types derived from the SQL schema in RESEARCH.md

**Core pattern:**
```typescript
// packages/shared/src/index.ts
// Tipos TypeScript que reflejan el schema SQL de 0001_initial_schema.sql
// Consumidos por backend y frontend — mantenerlos en sync con el schema

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  agent_name: string;
  vapi_assistant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  base_price: number | null;  // null = precio determinado por option_items (D-02)
  available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OptionGroup {
  id: string;
  menu_item_id: string;
  name: string;
  min_selections: number;  // 0 = opcional
  max_selections: number;  // 1 = elegí uno
  sort_order: number;
}

export interface OptionItem {
  id: string;
  option_group_id: string;
  name: string;
  price_delta: number;  // cuando MenuItem.base_price es null, actúa como precio absoluto
  is_default: boolean;
  sort_order: number;
}

export type OrderStatus = 'NUEVO' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO';
export type FulfillmentType = 'retiro' | 'delivery';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export interface Order {
  id: string;
  restaurant_id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string | null;
  // customer_phone: NEVER log this field — PII (D-07, Ley 25.326 AR)
  customer_phone: string | null;
  fulfillment_type: FulfillmentType;
  delivery_address: string | null;
  call_id: string | null;
  transcript: string | null;
  total: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  restaurant_id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  modifiers: unknown[];
  note: string | null;
}

export interface Subscription {
  id: string;
  restaurant_id: string;
  mp_preapproval_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}
```

---

### `supabase/migrations/0001_initial_schema.sql` (migration, CRUD)

**Analog:** none (greenfield)
**Source pattern:** RESEARCH.md — "Schema SQL completo (Migration 0001)" + RLS patterns 1 & 2

This file is the most complex. Three sub-patterns must be composed:

**Sub-pattern A — Table + RLS for tables with direct restaurant_id** (source: RESEARCH.md Pattern 2):
```sql
CREATE TABLE <table_name> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  -- ... columns ...
);
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON <table_name> FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);
```

**Sub-pattern B — RLS via JOIN for option_groups (no direct restaurant_id)** (source: RESEARCH.md Schema SQL, Pitfall 5):
```sql
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
```

**Sub-pattern C — Custom Access Token Hook** (source: RESEARCH.md Pattern 1):
```sql
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

  SELECT id INTO v_restaurant_id
  FROM public.restaurants
  WHERE owner_id = (event->>'user_id')::uuid
  LIMIT 1;

  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- null cuando el usuario recién se registra y aún no tiene restaurante
  -- El frontend debe redirigir a onboarding si restaurant_id es null (Pitfall 2)
  IF v_restaurant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,restaurant_id}', to_jsonb(v_restaurant_id));
  ELSE
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

Full SQL migration content is in RESEARCH.md lines 444–625. Compose it as:
1. All `CREATE TABLE` statements in dependency order (restaurants → menu_categories → menu_items → option_groups → option_items → orders → order_items → restaurant_counters → restaurant_hours → subscriptions)
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` immediately after each `CREATE TABLE`
3. `CREATE POLICY "tenant_isolation"` immediately after each `ALTER TABLE`
4. Custom Access Token Hook function + permission grants at the end

---

## Shared Patterns

### SEC-04: Service Role Key Never in Frontend Bundle

**Source:** RESEARCH.md — Pattern 6 + Pitfall 4
**Apply to:** `apps/frontend/package.json` (check-sec04 script), `apps/frontend/src/lib/supabase.ts`, all Vercel env var setup

```bash
# Run after every production build — catches accidental VITE_ prefix on service key
grep -r "service.role\|SUPABASE_SERVICE_ROLE_KEY" apps/frontend/dist/ \
  && echo "ERROR: service role key leaked" \
  || echo "OK: no leak detected"
```

Environment variable naming rule:
- Frontend (Vercel): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — exposed to bundle intentionally
- Backend (Railway): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADO_PAGO_ACCESS_TOKEN` — no `VITE_` prefix, never in frontend

### SEC-05: customer_phone No-Log Policy

**Source:** RESEARCH.md — D-07
**Apply to:** Every file that touches `orders` table or `customer_phone` field (backend routes in Phase 3+)

```typescript
// Pattern: annotate at the field level wherever customer_phone appears
// customer_phone: NEVER include in console.log, logger.error, error messages,
// or Sentry/Datadog traces. PII under Ley 25.326 AR. (D-07)
```

### RLS tenant_isolation Policy

**Source:** RESEARCH.md — Pattern 2
**Apply to:** All SQL migration tables that have `restaurant_id` directly

```sql
-- Template for any table with direct restaurant_id:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON <table> FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);
```

Tables needing this exact pattern: `restaurants`, `menu_categories`, `menu_items`, `orders`, `order_items`, `restaurant_counters`, `restaurant_hours`, `subscriptions`.

Tables needing the JOIN variant: `option_groups`, `option_items` (no direct `restaurant_id` column).

### pnpm workspace: protocol

**Source:** RESEARCH.md — Pattern 3
**Apply to:** `apps/backend/package.json`, `apps/frontend/package.json`

```json
"@agente-restaurante/shared": "workspace:*"
```

This `workspace:*` protocol tells pnpm to link the local package directly without publishing. Never use a version number or a file path — always `workspace:*`.

### Fail-Fast Env Validation at Startup

**Source:** Standard backend pattern (no analog exists, derived from context)
**Apply to:** `apps/backend/src/index.ts`

```typescript
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MERCADO_PAGO_ACCESS_TOKEN'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
```

This causes Railway deploys to fail immediately (not silently) if an env var is missing.

---

## No Analog Found

All files in this phase have no analog — the entire codebase is greenfield. The table below documents reason and authoritative pattern source for each:

| File | Role | Data Flow | Reason | Pattern Source |
|------|------|-----------|--------|----------------|
| `pnpm-workspace.yaml` | config | — | First file ever written | RESEARCH.md Pattern 3 |
| `package.json` (root) | config | — | Greenfield | RESEARCH.md Pattern 3 + Pitfall 3 |
| `apps/backend/package.json` | config | — | Greenfield | RESEARCH.md Pattern 3 |
| `apps/backend/tsconfig.json` | config | — | Greenfield | Standard TypeScript |
| `apps/backend/railway.toml` | config | — | Greenfield | RESEARCH.md Pattern 4 |
| `apps/backend/src/index.ts` | service | request-response | Greenfield | Standard Express 5 |
| `apps/backend/src/lib/supabase.ts` | utility | request-response | Greenfield | RESEARCH.md (backend client) |
| `apps/backend/src/lib/mercadopago.ts` | utility | request-response | Greenfield | RESEARCH.md Pattern 5 |
| `apps/backend/src/routes/health.ts` | route | request-response | Greenfield | Standard Express route |
| `apps/frontend/package.json` | config | — | Greenfield | RESEARCH.md Pattern 3 |
| `apps/frontend/tsconfig.json` | config | — | Greenfield | Standard TypeScript |
| `apps/frontend/vite.config.ts` | config | — | Greenfield | Standard Vite + React |
| `apps/frontend/src/main.tsx` | component | request-response | Greenfield | Standard React 19 |
| `apps/frontend/src/lib/supabase.ts` | utility | request-response | Greenfield | RESEARCH.md (frontend client) |
| `apps/frontend/src/pages/Login.tsx` | component | request-response | Greenfield | Supabase Auth SDK docs |
| `apps/frontend/src/pages/Signup.tsx` | component | request-response | Greenfield | RESEARCH.md auth signup |
| `apps/frontend/src/pages/Dashboard.tsx` | component | request-response | Greenfield | Supabase anon key + RLS |
| `packages/shared/package.json` | config | — | Greenfield | RESEARCH.md Pattern 3 |
| `packages/shared/src/index.ts` | utility | transform | Greenfield | Schema SQL in RESEARCH.md |
| `supabase/migrations/0001_initial_schema.sql` | migration | CRUD | Greenfield | RESEARCH.md full SQL (lines 444–625) |

---

## Metadata

**Analog search scope:** entire repo (`.planning/`, `CLAUDE.md`, `.claude/`)
**Source files scanned:** 15 planning files
**Source code files found:** 0 (fully greenfield)
**Pattern extraction date:** 2026-05-07
**Pattern sources:** RESEARCH.md canonical patterns (all HIGH confidence except Twilio AR)
