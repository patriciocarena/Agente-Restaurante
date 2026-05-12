# Phase 02: Onboarding & Menu — Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 32 (new/modified)
**Analogs found:** 24 / 32 (8 greenfield — no Phase 1 analog)

> Pattern excerpts below are **copy targets**. Planners must reference these by path + line range, not paraphrase. All file paths absolute from repo root unless prefixed `apps/...`.

---

## File Classification

### Backend — `apps/backend/src/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `routes/restaurants.ts` | route/controller | CRUD (request-response) | `apps/backend/src/routes/health.ts` | role-match (only existing route is trivial health) |
| `routes/menu-categories.ts` | route/controller | CRUD | `apps/backend/src/routes/health.ts` | role-match |
| `routes/menu-items.ts` | route/controller | CRUD + nested transaction | `apps/backend/src/routes/health.ts` | role-match |
| `routes/phone.ts` | route/controller | request-response (Twilio I/O) | `apps/backend/src/routes/health.ts` | role-match |
| `routes/onboarding.ts` (POST /finish, /resume) | route/controller | CRUD + side-effect (Twilio) | `apps/backend/src/routes/health.ts` | role-match |
| `middleware/auth.ts` | middleware | request-response | none (Phase 1 used RLS only, no JWT-extracting middleware existed yet) | **no analog** — see RESEARCH.md Pattern 5 |
| `lib/twilio.ts` | utility (SDK singleton) | external I/O | `apps/backend/src/lib/mercadopago.ts` | **exact** (lazy singleton + env validation) |
| `lib/slug.ts` | utility | pure + DB query | `apps/backend/src/lib/supabase.ts` (admin client usage only) | partial — no direct analog |
| `lib/forwarding-instructions.ts` | utility | pure | `apps/backend/src/lib/logger.ts` (pure module export) | role-match |
| `seeds/hamburgueseria-template.json` | data fixture | static | none | **no analog** — greenfield data file |
| `scripts/seed-wonder.ts` | one-shot script | batch / file-I/O | none | **no analog** — Phase 1 had no scripts |
| `__tests__/restaurants.test.ts` | test (unit + integration) | request-response | `apps/backend/src/__tests__/health.test.ts` + `rls.test.ts` | **exact** (supertest + RLS helpers) |
| `__tests__/menu-categories.test.ts` | test | CRUD | `apps/backend/src/__tests__/rls.test.ts` | exact |
| `__tests__/menu-items.test.ts` | test | CRUD + Realtime stub | `apps/backend/src/__tests__/rls.test.ts` | exact |
| `__tests__/phone.test.ts` | test (mock twilio) | request-response | `apps/backend/src/__tests__/health.test.ts` | role-match |
| `__tests__/slug.test.ts` | test (unit) | pure | `apps/backend/src/__tests__/logger.test.ts` | role-match |

### Frontend — `apps/frontend/src/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pages/Onboarding.tsx` (rewrite) | page | request-response | **current** `apps/frontend/src/pages/Onboarding.tsx` (placeholder) + `pages/Signup.tsx` (form pattern) | partial — wizard concept is new |
| `pages/MenuEditor.tsx` | page | CRUD + Realtime sub | `apps/frontend/src/pages/Dashboard.tsx` (page shell + restaurantId loading states) | role-match |
| `pages/Settings.tsx` | page | CRUD | `apps/frontend/src/pages/Dashboard.tsx` | role-match |
| `components/onboarding/StepDatos.tsx` | component (form sub) | request-response | `apps/frontend/src/pages/Login.tsx` (label + input + error pattern) | role-match |
| `components/onboarding/StepHorario.tsx` | component | form sub | `apps/frontend/src/pages/Login.tsx` (form fields stacking) | partial |
| `components/onboarding/StepDelivery.tsx` | component | form sub | `apps/frontend/src/pages/Login.tsx` | partial |
| `components/onboarding/StepAgente.tsx` | component | form sub | `apps/frontend/src/pages/Login.tsx` | partial |
| `components/onboarding/Stepper.tsx` | component (presentational) | none | none | **no analog** — greenfield |
| `components/menu/CategoryList.tsx` | component (list+CRUD) | request-response | none | **no analog** — first list/sidebar component |
| `components/menu/ItemList.tsx` | component (list+CRUD) | request-response + Realtime | none | **no analog** |
| `components/menu/ItemModal.tsx` | component (modal form) | CRUD with nested write | `apps/frontend/src/pages/Signup.tsx` (multi-field form) | partial |
| `components/menu/AvailabilityToggle.tsx` | component | optimistic + Realtime echo | none | **no analog** |
| `components/menu/EmptyState.tsx` | component (presentational) | none | `apps/frontend/src/pages/Onboarding.tsx` (placeholder centered card) | role-match |
| `hooks/useMenuRealtime.ts` | hook (subscription) | event-driven (pub-sub) | `apps/frontend/src/lib/auth.ts` (`useSession` subscription pattern) | **exact** (subscribe + cleanup) |
| `hooks/useRestaurantSetup.ts` | hook (mutation) | request-response | `apps/frontend/src/lib/auth.ts` | partial |
| `lib/api.ts` | utility (typed fetch wrappers) | request-response | `apps/frontend/src/lib/supabase.ts` (module-level singleton) | partial |
| `components/ui/{form,switch,dialog,tabs,textarea,tooltip,sheet,skeleton}.tsx` | shadcn primitives | none | `apps/frontend/src/components/ui/{button,input,card,label,alert}.tsx` | **exact** (shadcn registry add — files generated by CLI) |
| `__tests__/onboarding.test.tsx` | test (RTL) | request-response | `apps/frontend/src/__tests__/sec04.test.ts` (only frontend test exists; very different) | partial |

### Database — `supabase/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `migrations/0002_phase2_columns.sql` | migration (DDL) | none | `supabase/migrations/0001_initial_schema.sql` | **exact** (only other migration, same SQL conventions) |

---

## Pattern Assignments

### `apps/backend/src/routes/restaurants.ts` (route, CRUD)

**Analog:** `apps/backend/src/routes/health.ts` (lines 1-9) — trivial but establishes the Express Router export idiom.

**Router export pattern** (`apps/backend/src/routes/health.ts` lines 1-8):
```typescript
import { Router } from 'express';

export const healthRouter = Router();

// Railway probes GET /health. Must return 2xx or the deploy is marked failed.
healthRouter.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
});
```
Copy: export const named `<resource>Router`, mount in `index.ts` with `app.use('/api/<resource>', <resource>Router)`. Always JSON response. Comments on WHY (Railway probe / RLS reason) above the handler.

**Mount pattern** (`apps/backend/src/index.ts` lines 24-25):
```typescript
app.use(express.json());
app.use('/health', healthRouter);
```
Add new router lines following the same one-per-resource style. Keep `app.use(express.json())` before route mounts (already present).

**Service-role admin client usage** (`apps/backend/src/lib/supabase.ts` lines 7-11):
```typescript
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```
Reuse this exact client for privileged writes (e.g., inserting the `restaurants` row at signup, where the JWT doesn't yet carry a `restaurant_id`). For tenant-scoped reads/writes use a per-request anon client built from the user JWT (see `rls.helpers.ts` lines 33-34 for the construction idiom). RESEARCH.md Pattern 5 + Pitfall 6 are the authority for the dual-client rule.

**RLS test reference for endpoint** (`apps/backend/src/__tests__/rls.test.ts` lines 13-15):
```typescript
await A.anonClient.from('menu_items').insert({ restaurant_id: A.restaurantId, name: 'Burger A', base_price: 5000 });
```
Endpoints under `/api/restaurants` etc. must work both via the backend supertest path AND via direct anon-client writes for tenant A (defense-in-depth: RLS + middleware). When writing the route handler, mirror this expectation.

---

### `apps/backend/src/routes/menu-categories.ts` and `routes/menu-items.ts` (route, CRUD)

**Analog:** Same as `restaurants.ts` above. Add nothing new at the Express level.

**Tenant-explicit filter pattern** (from RESEARCH.md line 693 — already cited as PATTERN in CONTEXT.md):
```typescript
const { data, error } = await supabaseAdmin
  .from('menu_items')
  .update({ available, updated_at: new Date().toISOString() })
  .eq('id', req.params.id)
  .eq('restaurant_id', req.restaurantId)  // explicit tenant check in addition to RLS
  .select()
  .single();
```
Every DB call from these routes must include `.eq('restaurant_id', req.restaurantId)` even when using `supabaseAdmin` (which bypasses RLS). This is the Phase 1 D-04 defense-in-depth rule.

**Nested write pattern (option_groups + option_items inside item PATCH):** No Phase 1 analog. Use a single Supabase RPC or a manual sequence inside a try/catch; if any step fails, rollback by deleting the just-inserted parent. The planner decides the exact shape. There is no transactional client in Supabase JS for multi-table writes — accept this constraint and document it in code comments. See PROJECT.md handover for the menu schema (D-02 in `01-CONTEXT.md` lines 28-50).

---

### `apps/backend/src/routes/phone.ts` (route, request-response with Twilio I/O)

**Analog:** `apps/backend/src/routes/health.ts` (structure only) + `apps/backend/src/lib/mercadopago.ts` (external-SDK invocation idiom).

**External SDK invocation idiom** (`apps/backend/src/lib/mercadopago.ts` lines 1-17):
```typescript
// apps/backend/src/lib/mercadopago.ts
// D-10: Lazy singleton — no requiere MERCADO_PAGO_ACCESS_TOKEN hasta Phase 5.
// Usar getMpClient() en lugar de importar mpClient directamente.
import { MercadoPagoConfig } from 'mercadopago';

let _mpClient: MercadoPagoConfig | null = null;

export function getMpClient(): MercadoPagoConfig {
  if (!_mpClient) {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      throw new Error('Missing required env var: MERCADO_PAGO_ACCESS_TOKEN (se activa en Phase 5)');
    }
    _mpClient = new MercadoPagoConfig({ accessToken: token, options: { timeout: 5000 } });
  }
  return _mpClient;
}
```
Apply for Twilio: lazy singleton with `getTwilioClient()`, `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` env vars validated at first call (NOT at import time, so tests that don't touch Twilio don't need to set env). The route handler in `phone.ts` calls `getTwilioClient()` then `client.incomingPhoneNumbers.create(...)`. Error handling: do NOT leak Twilio's raw error message to the response — map to user-friendly Spanish copy per UI-SPEC D-07.

---

### `apps/backend/src/middleware/auth.ts` (middleware — NEW, no Phase 1 analog)

**No analog.** Phase 1 used RLS-only and never decoded JWTs in Express middleware (tests used `supabaseAdmin.auth.admin.createUser` + signed-in anon clients directly). This is the first middleware in the codebase.

**Use RESEARCH.md Pattern 5 verbatim** (RESEARCH.md lines 367-391):
```typescript
import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export interface AuthedRequest extends Request {
  restaurantId: string;
  userId: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'invalid token' });

  const restaurantId = user.app_metadata?.restaurant_id as string | null;
  // Note: during onboarding step 1, restaurant doesn't exist yet — route must handle null
  (req as AuthedRequest).restaurantId = restaurantId ?? '';
  (req as AuthedRequest).userId = user.id;
  next();
}
```
Inject this in every Phase 2 route. Routes that run before `restaurants` exists (e.g., POST `/api/restaurants` itself) must accept `restaurantId === ''` and validate accordingly.

---

### `apps/backend/src/lib/twilio.ts` (utility / SDK singleton)

**Analog:** `apps/backend/src/lib/mercadopago.ts` — see invocation idiom above. Exact pattern (lazy singleton + env at first call + descriptive throw).

Additional reference: RESEARCH.md Pattern 6 (lines 397-446) for the dual-mode provisioning function. CONTEXT.md D-05/D-06 simplifies this to **US-forwarding-only**: the dual-mode `provisionArgentinaNumber` from research is replaced by a simpler `provisionUsForwardingNumber(restaurantId)` that always succeeds via `client.incomingPhoneNumbers.create({ areaCode: process.env.TWILIO_DEFAULT_AREA_CODE ?? '415' })`. No bundle SID logic needed in v1.

---

### `apps/backend/src/lib/slug.ts` (utility)

**No direct analog.** Use the `supabaseAdmin` import idiom from `apps/backend/src/routes/health.ts` (importing it from `'../lib/supabase'`) and the doc-comment style from `apps/backend/src/lib/supabase.ts` lines 1-4:
```typescript
// apps/backend/src/lib/supabase.ts
// Service role key: bypassea RLS — solo para operaciones admin del backend.
// NUNCA exponer al frontend — ver SEC-04. Naming intentionally `supabaseAdmin` so every
// call site reads as a privileged operation.
```
Apply: comments in Spanish explaining WHY, English explaining WHAT. Keep modules tiny (10-20 lines).

Function body: lift verbatim from RESEARCH.md Pattern 4 (lines 343-359). `slugify` already in stack with `locale: 'es'`.

---

### `apps/backend/src/lib/forwarding-instructions.ts` (utility, pure)

**Analog:** `apps/backend/src/lib/logger.ts` — pure module export pattern.

**Module-export idiom** (`apps/backend/src/lib/logger.ts` lines 39-43):
```typescript
export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
```
Export a const object `forwardingInstructions = { movistar: '*21*…#', claro: '**21*…#', personal: '*21*…#' }` (D-08). Consumed by frontend via API or hardcoded constant. CONTEXT.md D-08 says docs URL is configurable via `FORWARDING_DOCS_URL` env var — expose that helper from this module too.

---

### `apps/backend/src/__tests__/restaurants.test.ts` (test — unit + integration)

**Analog 1 (supertest harness):** `apps/backend/src/__tests__/health.test.ts` (lines 1-23).

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Set required env BEFORE importing app so the env validator passes.
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.MERCADO_PAGO_ACCESS_TOKEN ??= 'fake_for_test';
process.env.NODE_ENV = 'test';

let app: any;
beforeAll(async () => {
  app = (await import('../index')).default;
});

describe('GET /health', () => {
  it('returns 200 with status ok and an ISO timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.ts).toBe('string');
    expect(() => new Date(res.body.ts).toISOString()).not.toThrow();
  });
});
```
Copy: env setup BEFORE `import('../index')`. Use `??=` for safe defaults. For Phase 2 add `TWILIO_ACCOUNT_SID ??= 'fake'`, `TWILIO_AUTH_TOKEN ??= 'fake'`, `TWILIO_DEFAULT_AREA_CODE ??= '415'`.

**Analog 2 (RLS live integration):** `apps/backend/src/__tests__/rls.test.ts` (lines 1-21) — gate with `describeLive`.

```typescript
const RUN_LIVE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY);
const describeLive = RUN_LIVE ? describe : describe.skip;

describeLive('AUTH-05 / AUTH-06 RLS tenant isolation (live)', () => {
  let A: TestTenant;
  let B: TestTenant;

  beforeAll(async () => {
    A = await createTestTenant('rls-a');
    B = await createTestTenant('rls-b');
    // ...
  }, 60_000);

  afterAll(async () => {
    if (A) await destroyTestTenant(A);
    if (B) await destroyTestTenant(B);
  }, 60_000);
```
For Phase 2 tests that require a real Supabase project, mirror this `describeLive` gate so the suite passes in CI without secrets. Mocked unit tests (twilio mock, slug unit) use plain `describe` + supertest as in `health.test.ts`.

**Analog 3 (test tenant helper):** `apps/backend/src/__tests__/rls.helpers.ts` (entire file, 52 lines). Phase 2 will likely need to extend `createTestTenant` to also insert a category + item, or expose a `seedMenu(tenant)` helper. Keep the cascade-delete order in `destroyTestTenant` (lines 41-50) — extend to delete `option_items` and `option_groups` first if Phase 2 tests create them.

**Mock pattern for Twilio in `phone.test.ts`:** No Phase 1 analog. Use `vi.mock('twilio', () => ({ default: vi.fn(() => ({ incomingPhoneNumbers: { create: vi.fn().mockResolvedValue({ phoneNumber: '+14155551234', sid: 'PNxxx' }) } })) }))` at the top of the test file, then import the route handler under test. Tests using `getTwilioClient()` lazy singleton must reset the module between tests with `vi.resetModules()`.

**Skipped-test placeholder pattern** (`apps/backend/src/__tests__/auth.test.ts` lines 1-12 and `jwt.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
// AUTH-01, AUTH-02. Wired in Plan 04 (frontend Signup) + Plan 05 (manual checkpoint).
describe('AUTH-01 signup', () => {
  it.skip('supabase.auth.signUp creates a user with email+password', async () => {
    expect(true).toBe(true);
  });
});
```
For Phase 2, use this exact pattern for tests that depend on integration capabilities not available in CI (e.g., real Twilio sandbox). Always include a comment explaining what plan wires the real test.

---

### `supabase/migrations/0002_phase2_columns.sql` (migration, DDL)

**Analog:** `supabase/migrations/0001_initial_schema.sql` — only existing migration; sets the SQL conventions for this project.

**Header comment style** (`supabase/migrations/0001_initial_schema.sql` lines 1-8):
```sql
-- 0001_initial_schema.sql
-- Phase 1 (Foundations) — multi-tenant schema + RLS + Custom Access Token Hook.
-- Apply via Supabase Dashboard SQL Editor (no CLI available, RESEARCH.md A3).
-- Enable the hook in Dashboard -> Authentication -> Hooks after running this file.
-- Decisions: D-02 (menu schema), D-03 (hook approach), D-04 (RLS expression),
-- D-06 (no pgcrypto; AES-256 at rest is enough), D-07 (PII no-log policy),
-- D-08 (restaurant_counters), D-09 (subscriptions).
```
For 0002: header lists every D-XX touched (D-01 through D-17 from `02-CONTEXT.md`) and explicitly says "Apply via Supabase Dashboard SQL Editor".

**Section/table comment style** (`supabase/migrations/0001_initial_schema.sql` lines 53-57):
```sql
-- =============================================================================
-- TABLE: menu_items
-- D-02: base_price is NULLABLE. When NULL, the item price is determined by
-- the selected option_item.price_delta (e.g., "Hamburguesa Veggie — elegí Mixta
-- o Garbanzos"). This models Wonder Hamburguesería's real menu structure.
-- =============================================================================
```
For each ALTER in 0002, write a fenced comment block with the D-XX motivator. The user is not a programmer — this WHY matters.

**Safe-ALTER pattern** (matching CONTEXT.md D-17):
```sql
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_zones text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS onboarding_step smallint DEFAULT 0 NOT NULL;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS twilio_phone_sid text;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
```
Always use `IF NOT EXISTS`. Verify the columns flagged in CONTEXT.md D-17 comments (`twilio_number`, `agent_name`, `restaurant_hours`) by reading 0001 first — `restaurants.agent_name` exists (line 21), `restaurant_hours` table exists (line 222), `restaurants.phone` exists but `restaurants.twilio_number` does NOT (only generic `phone`). The planner must decide: add `twilio_number` or reuse `phone`. Recommend adding `twilio_number text` as a distinct column for clarity vs `phone` (which Phase 3 may use for the call-from number).

**CASCADE consideration (D-15):** `menu_items.category_id REFERENCES menu_categories` (line 61) has no `ON DELETE CASCADE`. Migration 0002 should `ALTER TABLE menu_items DROP CONSTRAINT menu_items_category_id_fkey, ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES menu_categories ON DELETE CASCADE;` (verify exact constraint name in production first).

**Realtime publication caveat:** 0001 line 5 says "Apply via Supabase Dashboard SQL Editor". The `ALTER PUBLICATION supabase_realtime ...` line needs the `supabase_realtime` publication to already exist (it does by default on a Supabase project). No additional setup.

---

### `apps/frontend/src/pages/Onboarding.tsx` (page — wizard, rewrite of placeholder)

**Analog 1 (page shell):** current `apps/frontend/src/pages/Onboarding.tsx` (lines 15-38).
```tsx
return (
  <div className="min-h-screen bg-background flex flex-col">
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
      <span className="text-sm font-semibold">Agente Restaurante</span>
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        Cerrar sesión
      </Button>
    </header>
    <main className="flex-1 flex items-center justify-center px-4">
      ...
    </main>
  </div>
);
```
Keep the 56px header (matches Phase 1 + UI-SPEC stepper height). Replace the `<main>` content with the stepper bar + step content. The "Cerrar sesión" stays in the header.

**Analog 2 (form field pattern):** `apps/frontend/src/pages/Login.tsx` lines 63-74.
```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="tu@email.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    autoComplete="email"
  />
  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
</div>
```
For RHF-driven steps, wrap field groups in `<div className="flex flex-col gap-1.5">`, use shadcn `<Label htmlFor>`, render error via `formState.errors[field]?.message` as `<p className="text-xs text-destructive">`. Spacing: `gap-1.5` inside a field group; `gap-4` between groups (Login line 80: `className="flex flex-col gap-4"`).

**Analog 3 (loading state in submit button):** `apps/frontend/src/pages/Login.tsx` line 99.
```tsx
<Button type="submit" disabled={loading} className="w-full">
  {loading ? <Loader2 className="animate-spin" size={16} /> : 'Ingresar al panel'}
</Button>
```
"Siguiente" / "Terminar" buttons in the wizard reuse this loading-spinner idiom during the Twilio provisioning wait (UI-SPEC: "Asignando tu número…").

**Analog 4 (error banner pattern):** `apps/frontend/src/pages/Login.tsx` lines 58-62.
```tsx
{error && (
  <Alert variant="destructive">
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```
Use for step-level errors (e.g., backend 500). Per UI-SPEC, inline field errors use the `<p className="text-xs text-destructive">` form, not Alert.

**RHF orchestration:** Lift verbatim from RESEARCH.md Pattern 1 (lines 210-276). One `useForm` + `FormProvider` + `STEP_FIELDS` array + `trigger()` per step. `useState` for the step counter.

**Resume logic (D-02):** Read `restaurants.onboarding_step` on mount using a `useEffect` that fetches via `supabase.from('restaurants').select('onboarding_step').single()`. Use the loading-state pattern from `apps/frontend/src/pages/Dashboard.tsx` lines 35-46 (three-way: `undefined` = loading, `null` = not yet, value = ready).

---

### `apps/frontend/src/pages/MenuEditor.tsx` (page — CRUD + Realtime)

**Analog (page shell + auth gating):** `apps/frontend/src/pages/Dashboard.tsx` (entire file).
```tsx
export default function Dashboard() {
  const navigate = useNavigate();
  const restaurantId = useRestaurantId();

  // Si el usuario está autenticado pero no tiene restaurante asociado (claim null),
  // mandarlo directamente a onboarding.
  useEffect(() => {
    if (restaurantId === null) {
      navigate('/onboarding', { replace: true });
    }
  }, [restaurantId, navigate]);
```
Copy: same `useRestaurantId()` gate at the top of `MenuEditor`, same `useEffect` redirect to `/onboarding` when claim is null. Same `<header className="h-14 bg-card border-b border-border …">` and same loading skeleton (lines 35-46):
```tsx
<div className="flex flex-col gap-3 w-full max-w-sm animate-pulse">
  <div className="h-7 bg-card rounded" />
  <div className="h-4 bg-card rounded w-3/4" />
  <div className="h-10 bg-card rounded" />
</div>
```
For Phase 2, prefer the shadcn `<Skeleton>` primitive (to be added) per UI-SPEC, but the visual treatment matches.

---

### `apps/frontend/src/pages/Settings.tsx` (page — CRUD)

**Analog:** `apps/frontend/src/pages/Dashboard.tsx` — same header, same `useRestaurantId()` gating. Tab body inside reuses the same per-step components from `components/onboarding/` (D-04 says explicitly "Reutiliza los mismos componentes/Zod schemas del wizard"). No new pattern; just composition.

---

### `apps/frontend/src/components/onboarding/StepHorario.tsx` (form sub)

**Analog (RHF context use):** RESEARCH.md Code Example (lines 705-741) verbatim with `useFormContext`. Day-order `[1,2,3,4,5,6,0]` (Lun→Dom AR convention per UI-SPEC).

**Analog (visual):** `apps/frontend/src/pages/Login.tsx` field grouping + UI-SPEC Component Inventory row "Switch" + "Day labels Lun..Dom".

---

### `apps/frontend/src/hooks/useMenuRealtime.ts` (hook — pub-sub)

**Analog:** `apps/frontend/src/lib/auth.ts` lines 5-16 — `useSession` subscription pattern.
```typescript
export function useSession(): Session | null | undefined {
  // undefined = still loading; null = signed out; Session = signed in
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return session;
}
```
Apply: useEffect mounts subscription, returns cleanup. Comment legend `undefined = loading; null = empty; value = ready` carries to `useMenuRealtime`. The actual subscription body is RESEARCH.md Pattern 3 (lines 312-330) — channel name `menu-${restaurantId}`, filter `restaurant_id=eq.${restaurantId}`, cleanup `supabase.removeChannel(channel)`.

---

### `apps/frontend/src/hooks/useRestaurantSetup.ts` (hook — mutation)

**Partial analog:** `apps/frontend/src/lib/auth.ts` — hook export idiom only.
```typescript
export async function signOut() {
  await supabase.auth.signOut();
}
```
Pattern: export named async functions OR a hook returning `{ submit, loading, error }`. Planner decides; both are valid. Use the **refreshSession after restaurant creation** pattern from RESEARCH.md Pattern 2 (lines 285-291) — this is critical (Pitfall 1).

---

### `apps/frontend/src/lib/api.ts` (utility — typed fetch wrappers)

**Partial analog:** `apps/frontend/src/lib/supabase.ts` (lines 1-9) — module-level singleton export idiom, but the use case is different.
```typescript
import { createClient } from '@supabase/supabase-js';

// Solo VITE_ prefix. Estas variables van al bundle del browser.
// NUNCA agregar VITE_SUPABASE_SERVICE_ROLE_KEY (viola SEC-04 / D-05).
export const supabase = createClient(...);
```
For `api.ts`: export named functions (`createRestaurant`, `updateMenuItem`, …) that wrap `fetch` with `Authorization: Bearer ${session.access_token}` from `supabase.auth.getSession()`. Backend base URL via `import.meta.env.VITE_API_URL`. Same SEC-04 comment block: "NUNCA agregar SERVICE_ROLE_KEY al bundle del browser".

---

### `apps/frontend/src/components/ui/*.tsx` (shadcn primitives — generated)

**Analog (exact):** `apps/frontend/src/components/ui/button.tsx` (lines 1-47), `card.tsx` (lines 1-40), `input.tsx` (lines 1-22), `label.tsx`, `alert.tsx`. All Phase 1 ui primitives.

**Idiom: shadcn primitive file structure** (`apps/frontend/src/components/ui/button.tsx` lines 1-7):
```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
```
For Phase 2 shadcn adds (Form, Switch, Dialog, Tabs, Textarea, Tooltip, Sheet, Skeleton): **run `npx shadcn@latest add <component>` — do NOT hand-roll**. The generated files match this exact idiom (`cn(...)` + cva + forwardRef). Verify the `--ring`, `--primary`, `--card` tokens are referenced (already defined in `src/index.css` from Phase 1).

---

### `apps/frontend/src/__tests__/onboarding.test.tsx` (test — RTL)

**Partial analog:** `apps/frontend/src/__tests__/sec04.test.ts` (lines 1-22) — only existing frontend test, but it's a build-output check, not a React component test.

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
// SEC-04: service role key must not appear in built frontend bundle
describe('SEC-04 service role key bundle leak', () => {
  it('check-sec04.sh exits 0 when dist/ has no service role references', () => {
    ...
```
For real component tests, the frontend `vitest.config.ts` (already configured at lines 1-8) supports `.test.tsx`. No `@testing-library/react` is currently in package.json — the planner must add it. Use the same `describe` + `it` Vitest API. Mock `supabase` via `vi.mock('@/lib/supabase', ...)`.

---

## Shared Patterns

### Auth (JWT verify + claim extract) — applies to ALL backend routes

**Source:** RESEARCH.md Pattern 5 (lines 367-391), expressed verbatim above in the `middleware/auth.ts` entry. Phase 1 had NO such middleware; this is the first.

**Application:** Every `router.<verb>(...)` in `restaurants.ts`, `menu-categories.ts`, `menu-items.ts`, `phone.ts`, `onboarding.ts` must compose `requireAuth` as first middleware. Special case: POST `/api/restaurants` (wizard step 1 submit) runs with `restaurantId === ''` because the row doesn't exist yet — the handler creates the row using `req.userId` and then on subsequent steps, the user's JWT carries the new claim only after `supabase.auth.refreshSession()` on the frontend.

### Defense-in-depth tenant filter — applies to ALL backend DB queries

**Source:** RESEARCH.md line 693 (`.eq('restaurant_id', req.restaurantId)`) + Phase 1 D-04 in `01-CONTEXT.md` lines 56-60.

**Application:** Even when using `supabaseAdmin` (which bypasses RLS), every query must include the explicit `.eq('restaurant_id', req.restaurantId)`. Tests in `rls.test.ts` (lines 29-55) prove RLS works at the DB layer; the explicit filter is for the case where a future engineer makes a mistake at the middleware layer.

### PII no-log — applies to ALL backend code

**Source:** `apps/backend/src/lib/logger.ts` lines 1-25.
```typescript
const PII_KEYS = new Set(['customer_phone', 'phone', 'caller_phone']);

export function redactPII<T>(input: T): T {
  ...
```
**Application:** Phase 2 does not handle customer_phone directly (no calls yet). BUT `restaurants.phone` (line 20 of schema) and the new `twilio_number` are operational identifiers, not customer PII — they CAN be logged. The pattern itself does not change; just be aware that the PII_KEYS set is conservative and may match the restaurant's own number. The planner may want to extend `logger.ts` if a new PII key emerges (e.g., `delivery_address` in Phase 3), but Phase 2 does not require changes to logger.

### SEC-04 (no service role in frontend bundle) — enforced by CI

**Source:** `apps/frontend/src/__tests__/sec04.test.ts` + `scripts/check-sec04.sh`.

**Application:** Phase 2 frontend code must NEVER import `SUPABASE_SERVICE_ROLE_KEY`. Always go through backend (`apps/backend/src/lib/supabase.ts`). The `api.ts` typed-fetch layer is the boundary. The existing CI test already covers this; no new test needed.

### Spanish rioplatense copy — applies to ALL user-facing strings

**Source:** UI-SPEC Copywriting Contract + Phase 1 frontend pages.

**Application:** Error messages, button labels, tooltips, alerts — all in "vos" form, no exclamation marks, no "tú" or "usted". Examples from Login.tsx line 30 ("Ingresá tu email."), line 42 ("Email o contraseña incorrectos. Intentá de nuevo."). UI-SPEC lines 144-269 are the authoritative copy contract for every Phase 2 string.

### Path alias `@/` — Vite config

**Source:** Implicit in all Phase 1 frontend imports (e.g., Login.tsx line 4 `import { supabase } from '@/lib/supabase';`). Configured in `apps/frontend/vite.config.ts` (not read but known to work). Phase 2 imports use `@/components/onboarding/StepDatos`, `@/hooks/useMenuRealtime`, etc.

### Frontend page shell template

**Source:** `apps/frontend/src/pages/Onboarding.tsx` lines 16-22 (header) + `apps/frontend/src/pages/Login.tsx` line 49 (page wrapper).

```tsx
<div className="min-h-screen bg-background flex flex-col">
  <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
    <span className="text-sm font-semibold">Agente Restaurante</span>
    <Button variant="ghost" size="sm" onClick={handleSignOut}>Cerrar sesión</Button>
  </header>
  <main className="flex-1 ...">{/* content */}</main>
</div>
```
**Application:** Onboarding (with stepper bar inserted below the header), Settings, and MenuEditor all start from this template. Login/Signup/Forgot/Reset use a centered-card variant (no header) — different page family.

### Test env-var-default idiom

**Source:** `apps/backend/src/__tests__/health.test.ts` lines 4-8.
```typescript
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.MERCADO_PAGO_ACCESS_TOKEN ??= 'fake_for_test';
process.env.NODE_ENV = 'test';
```
**Application:** Every Phase 2 backend test file's top-of-file. Add: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_DEFAULT_AREA_CODE`, `FORWARDING_DOCS_URL`, `SUPPORT_CONTACT_URL` (D-07). Use `??=` for idempotency between test runs.

---

## No Analog Found

Files where Phase 1 offers no pattern. Planner should use the RESEARCH.md pattern (cited inline) or design freely under CLAUDE.md conventions.

| File | Role | Why no analog | Fallback |
|------|------|---------------|----------|
| `middleware/auth.ts` | middleware | First Express middleware in repo | RESEARCH.md Pattern 5 verbatim |
| `lib/slug.ts` | utility (DB + pure) | First DB-querying utility | RESEARCH.md Pattern 4 + supabaseAdmin import |
| `seeds/hamburgueseria-template.json` | data fixture | First seed file | Plain JSON, ~4 categories × ~3 items, no prices (CONTEXT.md D-12) |
| `scripts/seed-wonder.ts` | one-shot script | First script | Standalone ts-node script reading `.planning/research/wonder-pedix-raw.json`, inserting via `supabaseAdmin`. Comment: "Run once for Wonder pilot — never auto-executed." |
| `components/onboarding/Stepper.tsx` | UI component | First custom (non-shadcn) component | Plain Tailwind div + map over step index. UI-SPEC Component Inventory line 277 specifies exact visual treatment |
| `components/menu/CategoryList.tsx` | list+CRUD | First sidebar list | Plain `<ul>` + map + `<button>` rows. UI-SPEC Page Layout `/menu` section + Custom "category row" spec |
| `components/menu/ItemList.tsx` | list+CRUD with realtime | First main-column CRUD list | Map over fetched items, compose `<AvailabilityToggle>` per row. UI-SPEC custom "item row" |
| `components/menu/AvailabilityToggle.tsx` | optimistic component | First optimistic-update component | Local `useState` for the optimistic value, PATCH on toggle, revert on error toast. UI-SPEC line 372-376 |

For all greenfield files, follow `CLAUDE.md` constraints (Spanish comments where WHY non-obvious, English comments for WHAT, no emojis, ≤80-column where natural).

---

## Metadata

**Analog search scope:**
- `apps/backend/src/**` (8 files scanned)
- `apps/frontend/src/**` (16 files scanned)
- `supabase/migrations/**` (1 file scanned)
- `apps/backend/src/__tests__/**` (7 files scanned)
- `apps/frontend/src/__tests__/**` (1 file scanned)

**Files scanned:** 33

**Pattern extraction date:** 2026-05-11

**Key insights for the planner:**
1. **Phase 1 was thin** — only one real route (`health.ts`), one migration (`0001`), no middleware, no business routes. The richest analogs are the auth pages (Login/Signup/AuthCallback) and the RLS test harness (`rls.helpers.ts`, `rls.test.ts`).
2. **The Mercado Pago lazy singleton (`lib/mercadopago.ts`) is the gold-standard pattern for Twilio** — same lazy init, same env-var-at-first-call validation, same explanatory comment style.
3. **`rls.helpers.ts` is the single most reusable test asset.** Every Phase 2 integration test that needs a real tenant should import `createTestTenant` / `destroyTestTenant`. The planner should consider extending it (e.g., a `seedCategory(tenant, name)` helper) rather than duplicating.
4. **Dashboard.tsx is the gold-standard for page-level auth gating** — the three-state `useRestaurantId()` pattern (undefined/null/value) carries directly to MenuEditor and Settings.
5. **No frontend RTL tests exist.** Adding `@testing-library/react` is a Phase 2 prerequisite if any component test will be written.
6. **Migration 0002 must verify before adding.** Per CONTEXT.md D-17, several columns may already exist (`agent_name` definitely does, line 21 of 0001; `twilio_number` does NOT — there's only generic `phone`). `menu_items.category_id` lacks `ON DELETE CASCADE` (D-15 requirement) — migration must rebuild that FK.
