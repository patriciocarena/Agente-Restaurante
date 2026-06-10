# Phase 3: Voice MVP (Tier 1) - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 8 new/modified files
**Analogs found:** 7 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/backend/src/lib/vapi.ts` | service/lib | request-response (external API) | `apps/backend/src/lib/twilio.ts` | role-match |
| `apps/backend/src/lib/system-prompt.ts` | utility | transform (DB rows → string) | `apps/backend/src/lib/forwarding-instructions.ts` | partial |
| `apps/backend/src/routes/vapi-webhook.ts` | route/controller | event-driven (inbound webhook) | `apps/backend/src/routes/phone.ts` | role-match |
| `apps/backend/src/routes/menu-items.ts` *(modify)* | route/controller | CRUD | `apps/backend/src/routes/menu-items.ts` | exact (self) |
| `apps/backend/src/routes/menu-categories.ts` *(modify)* | route/controller | CRUD | `apps/backend/src/routes/menu-categories.ts` | exact (self) |
| `apps/backend/src/routes/onboarding.ts` *(modify)* | route/controller | request-response | `apps/backend/src/routes/onboarding.ts` | exact (self) |
| `supabase/migrations/0003_phase3_vapi.sql` | migration | batch (DDL) | `supabase/migrations/0002_phase2_columns.sql` | role-match |
| `apps/backend/src/__tests__/vapi-webhook.test.ts` | test | — | `apps/backend/src/__tests__/menu-items.test.ts` | role-match |
| `apps/backend/src/__tests__/system-prompt.test.ts` | test | — | `apps/backend/src/__tests__/phone.test.ts` | role-match |

---

## Pattern Assignments

### `apps/backend/src/lib/vapi.ts` (service/lib, request-response)

**Analog:** `apps/backend/src/lib/twilio.ts`

**Rationale:** Both are lazy-singleton external API client wrappers with typed result shapes and env-var fail-fast validation.

**Imports pattern** (twilio.ts lines 1–7):
```typescript
import twilio from 'twilio';

let _twilioClient: ReturnType<typeof twilio> | null = null;
```
Copy this lazy-singleton pattern:
```typescript
import { VapiClient } from '@vapi-ai/server-sdk';

let _vapiClient: VapiClient | null = null;
```

**Client init pattern** (twilio.ts lines 8–20):
```typescript
export function getTwilioClient() {
  if (!_twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Missing required env vars: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }
    _twilioClient = twilio(accountSid, authToken);
  }
  return _twilioClient;
}
```

**Result interface pattern** (twilio.ts lines 22–26):
```typescript
export interface PhoneProvisionResult {
  mode: 'us-forwarding';
  phoneNumber: string;
  sid: string;
}
```
Replicate with:
```typescript
export interface VapiAssistantResult {
  assistantId: string;
}
```

**External API call pattern** (twilio.ts lines 31–43): single async function, named and exported, that calls the external API and returns a typed result. Errors bubble up (caller does the try/catch — see onboarding.ts lines 79–86).

**Key differences for vapi.ts:**
- Export two functions: `createVapiAssistant(restaurant)` and `syncAssistantPrompt(restaurantId)`
- `syncAssistantPrompt` must swallow Vapi errors and `logger.error` without rethrowing (so menu edit always succeeds even if Vapi is down — see RESEARCH.md Anti-Patterns)
- Client init requires only `VAPI_API_KEY`

---

### `apps/backend/src/lib/system-prompt.ts` (utility, transform)

**Analog:** `apps/backend/src/lib/forwarding-instructions.ts` (partial — same pure-function utility shape)

**No close analog exists** for the DB-read + string-build pattern; the RESEARCH.md Pattern 4 (lines 372–428) is the primary reference.

**Forwarding instructions pattern** (forwarding-instructions.ts — pure export of constants + URL builder):
```typescript
export function getForwardingDocsUrl(): string { ... }
export const forwardingInstructions: string = `...`;
```
`system-prompt.ts` follows the same "pure utility, import wherever needed" convention — but its main export is async: `export async function buildSystemPrompt(restaurantId: string): Promise<string>`.

**Supabase query pattern to copy from** `apps/backend/src/routes/menu-items.ts` lines 29–43:
```typescript
const { data: items, error: itemsErr } = await supabaseAdmin
  .from('menu_items')
  .select(
    `id, restaurant_id, category_id, name, description, base_price, available,
     sort_order, ...`
  )
  .eq('category_id', category_id as string)
  .eq('restaurant_id', req.restaurantId)
  .order('sort_order', { ascending: true });

if (itemsErr) return res.status(500).json({ error: itemsErr.message });
```
In system-prompt.ts the error handling is: if query fails, throw (caller handles it).

**Filter pattern** — only include `available=true` items (copy `.filter(item => item.available)` inline after the DB call, not in the Supabase query, so the logic is explicit).

---

### `apps/backend/src/routes/vapi-webhook.ts` (route/controller, event-driven)

**Analog:** `apps/backend/src/routes/phone.ts`

**Rationale:** phone.ts is the closest existing Express route that calls external services (Twilio), uses supabaseAdmin, and does multi-step validation with early-return error pattern. The webhook route is architecturally different (no requireAuth, HMAC check instead), but the code structure is identical.

**Imports pattern** (phone.ts lines 1–9):
```typescript
import { Router, Request, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { provisionUsForwardingNumber } from '../lib/twilio';
import { getForwardingDocsUrl, forwardingInstructions } from '../lib/forwarding-instructions';
import { logger } from '../lib/logger';

export const phoneRouter = Router();

phoneRouter.use(requireAuth);
```
For vapi-webhook.ts: omit `requireAuth` import and `.use(requireAuth)`. Add `express` import for `express.json()` inline middleware. Security is `X-Vapi-Secret` header check, not JWT.

**Early-return error pattern** (phone.ts lines 27–32):
```typescript
if (restaurantErr) {
  logger.error('restaurant fetch failed', { error: restaurantErr.message });
  return res.status(400).json({ error: 'restaurant_fetch_failed' });
}

if (!restaurant) {
  return res.status(404).json({ error: 'no_restaurant' });
}
```
Copy this exact shape for each validation step in the webhook handler.

**Try/catch wrapper pattern** (phone.ts lines 17–86): entire handler body inside `try { ... } catch (error) { logger.error(...); return res.status(500)... }`. Copy this outer shell.

**Supabase update + defense-in-depth** (phone.ts lines 60–68):
```typescript
const { error: updateErr } = await supabaseAdmin
  .from('restaurants')
  .update({ ... })
  .eq('id', restaurant.id)
  .eq('owner_id', authedReq.userId); // defense-in-depth
```
In the webhook: equivalent is `.eq('restaurant_id', restaurantId)` on every insert/update.

**Idempotency pattern for the webhook** — check if `call_id` already exists in `orders` BEFORE inserting. If exists, return existing order number without error (not in existing code; this is a new pattern). Use:
```typescript
const { data: existingOrder } = await supabaseAdmin
  .from('orders')
  .select('order_number')
  .eq('call_id', callId)
  .maybeSingle();
if (existingOrder) {
  return res.json({ results: [{ toolCallId, result: `Pedido #${existingOrder.order_number} ya confirmado.` }] });
}
```

**PII guard pattern** (logger.ts lines 1–6):
```typescript
// SEC-05 / D-07: customer_phone is PII under Ley 25.326 AR. Never write it raw to logs.
const PII_KEYS = new Set(['customer_phone', 'phone', 'caller_phone']);
```
In the webhook: `const customerPhone = message.customer?.number;` — store in `orders.customer_phone` but NEVER pass `customerPhone` to any `logger.*` call. Use `logger.info('order created', { restaurant_id, order_number })` without phone.

**Route mounting pattern** — this route is mounted WITHOUT `requireAuth` and the CONTEXT.md says mount in `index.ts` as a public route. See index.ts lines 38–45 for the `.use(...)` pattern. Add to index.ts:
```typescript
import { vapiWebhookRouter } from './routes/vapi-webhook';
// ...
app.use('/api/vapi', vapiWebhookRouter);
```
IMPORTANT: Mount the vapi route BEFORE `app.use(express.json())` is NOT required for Mode A (X-Vapi-Secret plain comparison). Global `express.json()` is fine for Mode A. The route uses inline `express.json()` for clarity.

---

### `apps/backend/src/routes/menu-items.ts` *(modify — add syncAssistantPrompt call)*

**Analog:** Self (exact). No structural change needed.

**Where to add the Vapi sync call** — at the end of the successful path in:
- `POST /` handler (after line 188 `return res.status(201).json(...)`)
- `PATCH /:id` handler (after line 315 `return res.json(...)`)
- `DELETE /:id` handler (after line 333 `return res.status(204).send()`)
- `PATCH /:id/availability` handler (after line 355 `return res.json(data)`)

**Pattern to follow** (same as RESEARCH.md Pattern 5, copy this shape):
```typescript
// Fire-and-forget Vapi sync — menu edit must succeed even if Vapi is down
syncAssistantPrompt(req.restaurantId).catch((err) => {
  logger.error('vapi sync failed after menu edit', { error: String(err), restaurant_id: req.restaurantId });
});
```
Note: `syncAssistantPrompt` already wraps Vapi errors internally per the pattern in `lib/vapi.ts`, so calling `.catch()` here is belt-and-suspenders. Do NOT `await` the sync call — return the HTTP response first.

**Import to add** at top of menu-items.ts:
```typescript
import { syncAssistantPrompt } from '../lib/vapi';
import { logger } from '../lib/logger';
```
(logger import may already exist — check before adding)

---

### `apps/backend/src/routes/menu-categories.ts` *(modify — add syncAssistantPrompt call)*

**Analog:** Self (exact). Same pattern as menu-items.ts modification above.

**Where to add** — end of successful paths in `DELETE /:id` handler only. Creating or renaming a category does NOT change which items are available, so sync is only needed on DELETE (which may remove items from the prompt).

Actually, any category change could affect the prompt structure. Add sync to:
- `POST /` (new category added — prompt needs updating)
- `PATCH /:id` (category renamed — prompt needs updating)
- `DELETE /:id` (category + items removed — prompt needs updating)

Same fire-and-forget pattern as menu-items.ts.

---

### `apps/backend/src/routes/onboarding.ts` *(modify — add createVapiAssistant call)*

**Analog:** Self (exact). Structure unchanged; add Vapi assistant creation after Twilio provisioning succeeds.

**Where to add** — after the successful Twilio provision and restaurant update (after line 104 in the current file), before the final `return res.json(...)`:

```typescript
// Create Vapi assistant (ONB-05)
try {
  const assistantId = await createVapiAssistant({
    id: restaurant.id,
    name: restaurant.name,
    agent_name: restaurant.agent_name ?? 'Sofía',
  });
  await supabaseAdmin
    .from('restaurants')
    .update({ vapi_assistant_id: assistantId })
    .eq('id', restaurant.id);
} catch (vapiErr) {
  // Log but don't fail onboarding — Vapi assistant can be created in a retry
  logger.error('vapi assistant creation failed', {
    restaurant_id: restaurant.id,
    error: String(vapiErr),
  });
}
```

**Import to add** at top of onboarding.ts:
```typescript
import { createVapiAssistant } from '../lib/vapi';
```

This follows the same "log but don't fail" pattern used throughout the codebase for non-critical side effects.

---

### `supabase/migrations/0003_phase3_vapi.sql` (migration, DDL batch)

**Analog:** `supabase/migrations/0002_phase2_columns.sql`

**Header comment pattern** (0002 lines 1–9):
```sql
-- 0002_phase2_columns.sql
-- Phase 2 (Onboarding & Menu) — agrega columnas operacionales a restaurants, ...
-- Apply via Supabase Dashboard SQL Editor (no CLI available, Phase 1 pattern).
-- Decisions touched: D-01 ...
```
Copy this header format: filename, phase description, apply method, decisions covered.

**Section header pattern** (0002 lines 11–15):
```sql
-- =============================================================================
-- SECTION: restaurants — operational columns
-- Columnas necesarias para el wizard de onboarding y la asignación de teléfono.
-- =============================================================================
```
Use same section headers for each logical block in 0003.

**IF NOT EXISTS pattern** (0002 line 19):
```sql
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_zones text;
```
Use `IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency.

**RLS policy pattern** (0001 lines 170–172):
```sql
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON call_logs FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);
```
Exact pattern to copy for the `call_logs` table RLS. The expression `(auth.jwt()->'app_metadata'->>'restaurant_id')::uuid` is the project-standard RLS expression — do not vary it.

**Verification block pattern** (0002 lines 89–108): SQL Editor verification queries at the bottom of the migration. Add equivalent verification queries for 0003 (check index exists, check call_logs columns).

---

### `apps/backend/src/__tests__/vapi-webhook.test.ts` (test, unit)

**Analog:** `apps/backend/src/__tests__/menu-items.test.ts`

**Env setup pattern** (menu-items.test.ts lines 1–11):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.SUPABASE_ANON_KEY ??= 'fake_for_test';
process.env.TWILIO_ACCOUNT_SID ??= 'fake_for_test';
process.env.TWILIO_AUTH_TOKEN ??= 'fake_for_test';
process.env.TWILIO_DEFAULT_AREA_CODE ??= '415';
process.env.MERCADO_PAGO_ACCESS_TOKEN ??= 'fake_for_test';
process.env.NODE_ENV = 'test';
```
For vapi-webhook.test.ts: add `process.env.VAPI_WEBHOOK_SECRET ??= 'test_secret';` and `process.env.VAPI_API_KEY ??= 'fake_for_test';`.

**App import pattern** (menu-items.test.ts lines 13–16):
```typescript
let app: any;
beforeAll(async () => {
  app = (await import('../index')).default;
});
```
Copy exactly — dynamic import after env vars are set.

**Unauthorized test pattern** (menu-items.test.ts lines 20–25):
```typescript
it('GET / returns 401 without Authorization header', async () => {
  const res = await request(app).get('/api/menu-items?category_id=test');
  expect(res.status).toBe(401);
});
```
For webhook tests: equivalent is `401 without X-Vapi-Secret header` and `401 with wrong secret`.

**Describe structure** (menu-items.test.ts lines 18–76):
```typescript
describe('MENU-02/03/04 menu-items CRUD + nested + availability', () => {
  describe('Mocked unit tests', () => {
    it('...', ...);
  });
  // Live integration tests — commented out for CI
  /*
  describe('Live integration tests (RLS + nested writes)', () => { ... });
  */
});
```
Follow same two-level describe: outer names the requirements (CALL-01..09, OBS-01), inner separates "Mocked unit tests" from commented-out "Live integration tests".

---

### `apps/backend/src/__tests__/system-prompt.test.ts` (test, unit)

**Analog:** `apps/backend/src/__tests__/phone.test.ts`

**Simple unit test pattern without supertest** (phone.test.ts lines 1–56):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set env vars BEFORE importing anything that uses them
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.NODE_ENV = 'test';

describe('buildSystemPrompt (ONB-05, MENU-05, VOICE-13)', () => {
  it('returns a string containing the restaurant name', ...);
  it('includes only available=true items', ...);
  it('includes prompt injection resistance instruction', ...);
});
```
system-prompt.ts functions don't need the full Express app; test them by mocking `supabaseAdmin` with `vi.mock('../lib/supabase')` or by providing a real DB in integration mode (commented out).

---

## Shared Patterns

### Webhook Security (X-Vapi-Secret)

**Source:** New pattern — no existing analog in codebase. Closest shape is auth.ts middleware.

**Apply to:** `vapi-webhook.ts` only.

**Pattern:** Compare header value to env var. Reject 401 with `{ error: 'unauthorized' }` on mismatch. Never log the secret value itself.

```typescript
// From auth.ts lines 38-44 — shape of unauthorized early-return:
const token = req.headers.authorization?.replace('Bearer ', '');
if (!token) return res.status(401).json({ error: 'unauthorized' });
// ...
if (error || !user) return res.status(401).json({ error: 'invalid token' });
```
Adapt to:
```typescript
const secret = req.headers['x-vapi-secret'];
if (!secret || secret !== process.env.VAPI_WEBHOOK_SECRET) {
  logger.warn('vapi webhook unauthorized', {});
  return res.status(401).json({ error: 'unauthorized' });
}
```

### Error Handling (try/catch outer wrapper)

**Source:** `apps/backend/src/routes/phone.ts` lines 17–86 and `apps/backend/src/routes/onboarding.ts` lines 17–43

**Apply to:** All new route handlers (`vapi-webhook.ts`).

```typescript
try {
  // ... handler logic ...
} catch (error) {
  logger.error('POST /retry-provision unexpected error', { error: String(error) });
  return res.status(500).json({ error: 'internal_server_error' });
}
```

### Supabase Admin Query + Early Return

**Source:** `apps/backend/src/routes/menu-items.ts` lines 27–43 and `apps/backend/src/routes/phone.ts` lines 24–34

**Apply to:** All DB operations in `vapi-webhook.ts` and `system-prompt.ts`.

```typescript
const { data: restaurant, error: restaurantErr } = await supabaseAdmin
  .from('restaurants')
  .select('id, onboarding_step, twilio_number')
  .eq('owner_id', authedReq.userId)
  .maybeSingle();

if (restaurantErr) {
  logger.error('restaurant fetch failed', { error: restaurantErr.message });
  return res.status(400).json({ error: 'restaurant_fetch_failed' });
}
```

### Mass-Assignment Guard (whitelist only)

**Source:** `apps/backend/src/routes/menu-categories.ts` lines 73–89 and `apps/backend/src/routes/menu-items.ts` lines 193–206

**Apply to:** All inserts in `vapi-webhook.ts` — explicitly name every column in the insert object, never spread `req.body` or LLM arguments directly.

```typescript
// Good (explicit whitelist):
await supabaseAdmin.from('orders').insert({
  restaurant_id: restaurantId,
  order_number: orderNumber,
  customer_name: args.customer_name,
  fulfillment_type: args.fulfillment_type,
  delivery_address: args.delivery_address ?? null,
  call_id: callId,
  total: calculatedTotal,   // server-recalculated
});
// Never: .insert(args) or .insert(req.body)
```

### Logger PII Redaction

**Source:** `apps/backend/src/lib/logger.ts` lines 1–43

**Apply to:** `vapi-webhook.ts` — any `logger.*` call must never include `customer_phone` or raw phone numbers. The `redactPII` function covers `PII_KEYS = ['customer_phone', 'phone', 'caller_phone']` automatically if the field name matches, but the webhook variable is named `customerPhone` — do not log it at all.

### Env Var Fail-Fast Pattern

**Source:** `apps/backend/src/index.ts` lines 17–29

**Apply to:** `VAPI_API_KEY` and `VAPI_WEBHOOK_SECRET` must be added to the `REQUIRED_ENV` array in index.ts when they become mandatory for the webhook to function:

```typescript
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPI_API_KEY',           // add
  'VAPI_WEBHOOK_SECRET',    // add
] as const;
```

### Route Mounting Without Auth

**Source:** `apps/backend/src/index.ts` lines 38–45 — all routes currently use `requireAuth` inside them.

**Apply to:** `vapiWebhookRouter` must be mounted in index.ts WITHOUT adding requireAuth. The router itself handles security via X-Vapi-Secret. The mounting line:
```typescript
app.use('/api/vapi', vapiWebhookRouter);
```
goes AFTER `app.use(express.json())` (Mode A does not need raw body).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/backend/src/lib/system-prompt.ts` (DB-query portion) | utility | transform | No existing file reads DB to build a string prompt. RESEARCH.md Pattern 4 (lines 372–428) is the reference. The file shape follows the utility module convention (pure async export), but the query + template logic has no codebase analog. |

---

## Metadata

**Analog search scope:** `apps/backend/src/` (all `.ts` files), `supabase/migrations/` (all `.sql` files)

**Files scanned:** 27 TypeScript files + 2 SQL migrations

**Pattern extraction date:** 2026-06-09

**Critical notes for planner:**

1. **`vapi-webhook.ts` mounts without `requireAuth`** — this is the only public route in the codebase. index.ts currently has all routers using `requireAuth` internally. The planner must note this explicitly in the plan to avoid accidentally adding the middleware.

2. **`menu-items.ts` and `menu-categories.ts` modifications are additive only** — only the `syncAssistantPrompt` fire-and-forget call is added at the end of existing success paths. No existing handler logic changes.

3. **`onboarding.ts` modification adds Vapi assistant creation as a non-blocking step** — Twilio provisioning is the critical path; Vapi creation failure must not roll back the onboarding step to avoid re-provisioning a new Twilio number.

4. **`restaurant.vapi_assistant_id` column already exists** (0001_initial_schema.sql line 22, confirmed) — migration 0003 does NOT add this column, only the index and `call_logs` table.

5. **The `restaurant_hours` timezone check** uses `America/Argentina/Cordoba` (UTC-3, no DST). No existing code does timezone arithmetic — this is a new pattern. Use `new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Cordoba', hour12: false })` to get the current local time string for comparison.
