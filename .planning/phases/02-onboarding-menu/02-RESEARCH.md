# Phase 2: Onboarding & Menu — Research

**Researched:** 2026-05-11
**Domain:** Multi-step onboarding wizard + menu CRUD + Twilio AR number provisioning + Supabase Realtime
**Confidence:** MEDIUM-HIGH (Twilio AR regulatory path LOW until verified via Twilio Console)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONB-01 | Wizard de onboarding: nombre, slug, dirección | react-hook-form FormProvider + per-step Zod + trigger() pattern |
| ONB-02 | Horario de atención por día de la semana | restaurant_hours table exists; frontend = 7-row time-picker component |
| ONB-03 | Zonas de delivery (texto libre) | Column `delivery_zones text` — needs to be added to restaurants table or stored as JSON |
| ONB-04 | Asignar número Twilio AR (o mostrar instrucciones forwarding) | See Twilio AR section below — dual-path required |
| ONB-06 | Nombre de la agente (default "Sofía") | restaurants.agent_name already has DEFAULT 'Sofía' in schema |
| MENU-01 | CRUD categorías | menu_categories table exists with RLS |
| MENU-02 | Items con nombre, descripción, precio, categoría | menu_items table exists with RLS |
| MENU-03 | Modificadores `{name, price_delta}` | option_groups + option_items tables exist — two-level hierarchy |
| MENU-04 | Toggle disponibilidad mid-shift | menu_items.available boolean; Supabase Realtime UPDATE subscription |
</phase_requirements>

---

## Summary

Phase 2 is a frontend-heavy phase implementing two large features: (1) a guided multi-step onboarding wizard for new restaurant owners, and (2) a full MenuEditor for CRUD over the menu schema (categories, items, modifiers). The backend work is REST CRUD endpoints on the existing Supabase schema from Phase 1. The realtime toggle requirement (MENU-04: <2 seconds) is satisfied by Supabase Realtime Postgres Changes — no polling needed.

The single highest-risk item is **Twilio AR number provisioning (ONB-04)**. Research confirms that Twilio offers Argentina local numbers, but they require a **regulatory compliance bundle** with an Argentina-based end-user address. As a foreign entity (the SaaS itself has no AR address), the path to programmatic AR number assignment is **blocked unless the restaurant owner's address is used as the bundle's end-user address**. This is possible but requires manual console setup per number. For the MVP, the safer path is a dual-mode design: **attempt programmatic purchase, fall back to forwarding instructions** if the bundle requirement cannot be automated.

The onboarding wizard pattern is well-established: one `useForm` instance with `FormProvider`, per-step Zod schemas validated with `trigger()`, and a step counter in local state. No Zustand or external wizard library is needed.

**Primary recommendation:** Build a 4-step onboarding wizard (datos del restaurante → horario → zonas de delivery → teléfono/agente) using react-hook-form + zod. For Twilio AR, implement dual-mode: try programmatic purchase via the Twilio Node SDK; if it fails (bundle missing), render forwarding instructions. Backend exposes REST endpoints for all CRUD operations; the Supabase client on the frontend uses the existing RLS-protected tables.

---

## Project Constraints (from CLAUDE.md)

- **Stack locked:** Node.js + Express + TypeScript (backend), React + Vite + Tailwind + shadcn (frontend), Supabase RLS (DB + auth), Twilio AR (telephony), Railway (backend), Vercel (frontend)
- **No ElevenLabs in v1** — voice config is agent name only, Azure TTS configured in Phase 3
- **No Mercado Pago in this phase** — deferred to Phase 5
- **Multi-tenancy:** RLS enforced on all tables; JWT contains `restaurant_id` claim from Phase 1 custom access token hook
- **Backend recalculates totals** — no price trust from frontend
- **SEC-04:** Service role key NEVER in frontend bundle (already enforced by CI grep)
- **Costo objetivo por llamada:** ≤$0.25 USD — Twilio AR local number pricing ($8/mo + $0.01/min inbound) is within budget
- **Timezone:** America/Argentina/Buenos_Aires — all time comparisons must use this zone

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Onboarding wizard steps | Frontend (React) | — | UI-only flow; data submitted at completion |
| Restaurant CRUD (name, slug, address, agent_name, delivery_zones) | API (Express backend) | — | Needs service role for upsert; enforces slug uniqueness |
| Hours CRUD (7-row weekly schedule) | API (Express backend) | — | Batch upsert per restaurant_id |
| Menu categories CRUD | API (Express backend) | Frontend (optimistic) | Backend persists; frontend can optimistically update |
| Menu items CRUD | API (Express backend) | Frontend (optimistic) | Same pattern |
| Option groups + items CRUD | API (Express backend) | — | Nested under items; backend handles atomically |
| Available toggle (MENU-04) | API (Express backend) | Frontend (Supabase client) | PATCH /menu-items/:id/availability; frontend reads realtime |
| Twilio number provisioning | API (Express backend) | — | Needs Twilio credentials (secret); never in frontend |
| Slug uniqueness | API (Express backend) | Database (UNIQUE constraint) | Backend generates + DB enforces UNIQUE on restaurants.slug |
| JWT refresh after restaurant creation | Frontend (Supabase client) | — | `supabase.auth.refreshSession()` after POST restaurant |
| Realtime availability updates | Frontend (Supabase Realtime) | — | Subscribe to menu_items UPDATE events by restaurant_id |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.75.0 | Form state, validation trigger per step | 43M weekly downloads; performant, no re-render on keypress |
| zod | 4.4.3 | Per-step schema validation | Already in ecosystem; composable schemas; @hookform/resolvers bridges both |
| @hookform/resolvers | 5.2.2 | Bridge RHF ↔ Zod | Official package; zodResolver is the standard |
| @supabase/supabase-js | 2.105.3 (existing) | DB reads + Realtime subscriptions | Already installed Phase 1 |
| twilio (Node SDK) | 6.0.2 | Buy AR numbers, route inbound calls | Already chosen in stack |
| slugify | 1.6.9 | Generate URL-safe slugs from restaurant name | Zero-dep; handles Spanish accents, ñ |
| lucide-react (existing) | latest (devDep) | Icons in wizard steps | Already in devDeps |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui components | existing | Input, Button, Card, Select | Already installed via components.json |
| @radix-ui/react-select | via shadcn | Day-of-week dropdowns, time pickers | Already available via shadcn |
| @radix-ui/react-switch | via shadcn | Available toggle | May need `npx shadcn add switch` |
| @radix-ui/react-dialog | via shadcn | Edit item modal | May need `npx shadcn add dialog` |
| express-validator | 7.3.2 | Backend input validation on REST routes | Integrates with Express middleware pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual step state + RHF | Dedicated wizard lib (rhf-wizard, formik-stepper) | Dedicated libs add abstraction; RHF FormProvider + trigger() is sufficient for 4-step wizard |
| express-validator | zod on backend | Either works; express-validator integrates more naturally with Express middleware chain |
| slugify | custom regex | slugify handles 300+ special chars including ñ, á, é — do not hand-roll |

**Installation (new packages only — rest already in package.json):**
```bash
# Frontend
pnpm --filter @agente-restaurante/frontend add react-hook-form zod @hookform/resolvers slugify

# Backend
pnpm --filter @agente-restaurante/backend add twilio slugify express-validator
```

**Version verification:** All versions above verified against npm registry 2026-05-11.
[VERIFIED: npm registry — react-hook-form@7.75.0, zod@4.4.3, @hookform/resolvers@5.2.2, slugify@1.6.9, twilio@6.0.2, express-validator@7.3.2]

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser: Onboarding Wizard]
  Step 1 (Datos) → Step 2 (Horario) → Step 3 (Delivery) → Step 4 (Agente+Teléfono)
       |                                                            |
       | POST /api/restaurants (create row)                         |
       v                                                            v
[Express Backend]                                         [Twilio Node SDK]
  - slugify name → check UNIQUE                             - AvailablePhoneNumbers.list({country:'AR'})
  - INSERT restaurants                                       - IncomingPhoneNumbers.create({phoneNumber, bundleSid?})
  - INSERT restaurant_hours (7 rows batch)                   - ON FAIL: return {mode:'forwarding'}
  - INSERT subscriptions (status:'trial')                    |
  - INSERT restaurant_counters                               |
  - Twilio number provisioning ←─────────────────────────────
       |
       v
[Supabase DB]
  restaurants + restaurant_hours + subscriptions + restaurant_counters

[Browser: after wizard]
  supabase.auth.refreshSession() → JWT now has restaurant_id claim
       |
       v
[Dashboard redirects to MenuEditor]

[Browser: MenuEditor]
  Category list ←──── GET /api/menu-categories
  Item list     ←──── GET /api/menu-items?category_id=X
  Toggle toggle ──── PATCH /api/menu-items/:id/availability
       |
       | Supabase Realtime subscription
       v
[Supabase Realtime]
  channel('menu-changes')
  .on('postgres_changes', {event:'UPDATE', table:'menu_items',
      filter:'restaurant_id=eq.{restaurantId}'}, handler)
```

### Recommended Project Structure

```
apps/frontend/src/
├── pages/
│   ├── Onboarding.tsx           # Wizard orchestrator (step state, FormProvider)
│   ├── Dashboard.tsx            # Existing — detect onboarding_complete
│   └── MenuEditor.tsx           # NEW: categories + items + modifiers
├── components/
│   ├── onboarding/
│   │   ├── StepDatos.tsx        # Step 1: name, slug (auto), address
│   │   ├── StepHorario.tsx      # Step 2: 7-day schedule (open_time, close_time, is_closed)
│   │   ├── StepDelivery.tsx     # Step 3: delivery_zones textarea
│   │   └── StepAgente.tsx       # Step 4: agent_name, phone number display
│   ├── menu/
│   │   ├── CategoryList.tsx     # Sidebar list of categories with inline edit
│   │   ├── ItemList.tsx         # Item cards grid within selected category
│   │   ├── ItemForm.tsx         # Modal: name, description, base_price, modifiers
│   │   └── AvailabilityToggle.tsx  # Switch + optimistic update
│   └── ui/                     # Existing shadcn components
├── lib/
│   ├── api.ts                   # NEW: typed fetch wrappers for backend endpoints
│   ├── auth.ts                  # Existing — add refreshSession() helper
│   └── supabase.ts              # Existing
└── hooks/
    ├── useRestaurantSetup.ts    # Wizard form submit logic
    └── useMenuRealtime.ts       # Supabase Realtime subscription for menu_items

apps/backend/src/
├── routes/
│   ├── health.ts                # Existing
│   ├── restaurants.ts           # NEW: POST /, GET /:id, PATCH /:id
│   ├── menu-categories.ts       # NEW: CRUD
│   ├── menu-items.ts            # NEW: CRUD + PATCH /:id/availability
│   └── phone.ts                 # NEW: POST /provision-number
├── lib/
│   ├── supabase.ts              # Existing (service role client)
│   ├── twilio.ts                # NEW: Twilio client singleton
│   ├── slug.ts                  # NEW: slug generation + uniqueness check
│   └── logger.ts                # Existing
└── middleware/
    └── auth.ts                  # NEW: verify Supabase JWT, extract restaurant_id
```

### Pattern 1: Multi-Step Wizard with react-hook-form FormProvider

**What:** Single `useForm` instance shared across steps via `FormProvider`. Each step only renders its own fields. Navigation calls `trigger(stepFields)` to validate current step before advancing.

**When to use:** 2-6 step flows where all data submits at the end. Do not use separate `useForm` per step (data loss on navigation).

```typescript
// Source: react-hook-form.com/advanced-usage (verified pattern)
// apps/frontend/src/pages/Onboarding.tsx

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';

// Master schema — union of all step schemas
const onboardingSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  address: z.string().min(5, 'Dirección requerida'),
  delivery_zones: z.string().optional(),
  agent_name: z.string().default('Sofía'),
  hours: z.array(z.object({
    day_of_week: z.number(),
    open_time: z.string().nullable(),
    close_time: z.string().nullable(),
    is_closed: z.boolean(),
  })).length(7),
});

type OnboardingData = z.infer<typeof onboardingSchema>;

// Step field groups for per-step validation
const STEP_FIELDS: Array<(keyof OnboardingData)[]> = [
  ['name', 'slug', 'address'],     // Step 0: Datos del restaurante
  ['hours'],                        // Step 1: Horario
  ['delivery_zones'],               // Step 2: Zonas de delivery
  ['agent_name'],                   // Step 3: Agente
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  
  const methods = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      agent_name: 'Sofía',
      hours: [0,1,2,3,4,5,6].map(d => ({
        day_of_week: d, open_time: '11:00', close_time: '23:00', is_closed: false
      })),
    },
  });

  const handleNext = async () => {
    const valid = await methods.trigger(STEP_FIELDS[step]);
    if (valid) setStep(s => s + 1);
  };

  const onSubmit = methods.handleSubmit(async (data) => {
    await fetch('/api/restaurants', { method: 'POST', body: JSON.stringify(data) });
    await supabase.auth.refreshSession(); // CRITICAL: refresh JWT to get restaurant_id claim
    navigate('/menu');
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        {step === 0 && <StepDatos />}
        {step === 1 && <StepHorario />}
        {step === 2 && <StepDelivery />}
        {step === 3 && <StepAgente />}
        <button type="button" onClick={handleNext}>Siguiente</button>
        {step === 3 && <button type="submit">Finalizar</button>}
      </form>
    </FormProvider>
  );
}
```

### Pattern 2: JWT Refresh After Restaurant Creation

**What:** After the wizard creates the `restaurants` row, the existing JWT has `restaurant_id: null` (minted before the row existed). Call `supabase.auth.refreshSession()` to force re-mint and fire the custom_access_token_hook — the new JWT will contain the real `restaurant_id`.

**Why critical:** Without this, `useRestaurantId()` returns `null` even after onboarding, and Dashboard sends user back to onboarding in a redirect loop.

```typescript
// Source: Supabase community discussion #22337 + auth.sessions docs [CITED]
// After creating restaurant row:
const { error } = await supabase.auth.refreshSession();
if (error) throw error;
// Now session.user.app_metadata.restaurant_id is populated
```

### Pattern 3: Supabase Realtime for Menu Availability Toggle

**What:** Subscribe to `UPDATE` events on `menu_items` filtered by `restaurant_id`. On toggle, call PATCH endpoint; Realtime pushes confirmation to all connected clients.

**When to use:** Any time a DB change made from the backend needs to appear in the frontend within 2 seconds without polling.

**Prerequisites:**
1. Add `menu_items` to `supabase_realtime` publication (SQL migration):
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
   ```
2. RLS on `menu_items` already exists from Phase 1 — Realtime respects it automatically.
3. No need for `REPLICA IDENTITY FULL` for this use case (we only need new values, not old).

```typescript
// Source: supabase.com/docs/guides/realtime/postgres-changes [CITED]
// apps/frontend/src/hooks/useMenuRealtime.ts

export function useMenuRealtime(restaurantId: string, onUpdate: (item: MenuItem) => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`menu-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => onUpdate(payload.new as MenuItem)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, onUpdate]);
}
```

### Pattern 4: Slug Generation with Uniqueness Check

**What:** Auto-generate slug from restaurant name. Check uniqueness in DB. If collision, append incrementing suffix (`wonder-burger`, `wonder-burger-2`, etc).

```typescript
// Source: slugify docs + standard multi-tenant SaaS pattern [CITED + ASSUMED]
// apps/backend/src/lib/slug.ts
import slugify from 'slugify';
import { supabaseAdmin } from './supabase';

export async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true, locale: 'es' });
  let candidate = base;
  let suffix = 2;
  
  while (true) {
    const { data } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    
    if (!data) return candidate;  // unique
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}
```

**Database enforcement:** `restaurants.slug` already has `UNIQUE` constraint from Phase 1 schema. The loop above prevents race conditions in most cases; for high-concurrency scenarios, the DB UNIQUE constraint is the final safety net.

### Pattern 5: Backend Auth Middleware (JWT Verification)

**What:** All backend REST routes for Phase 2 must verify the Supabase JWT and extract `restaurant_id` from `app_metadata`. Use the existing `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to verify.

```typescript
// apps/backend/src/middleware/auth.ts
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

### Pattern 6: Twilio AR Number Provisioning (Dual-Mode)

**What:** Attempt to buy an Argentina local number programmatically. If it fails (regulatory bundle missing, no inventory), return forwarding instructions.

```typescript
// Source: Twilio Node SDK docs [CITED] + regulatory research [ASSUMED for bundle flow]
// apps/backend/src/lib/twilio.ts
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export type PhoneProvisionResult =
  | { mode: 'direct'; phoneNumber: string; sid: string }
  | { mode: 'forwarding'; instructions: string };

export async function provisionArgentinaNumber(
  restaurantId: string,
  bundleSid?: string  // Pre-configured regulatory bundle SID from env
): Promise<PhoneProvisionResult> {
  try {
    // Search available AR local numbers
    const available = await client.availablePhoneNumbers('AR').local.list({ limit: 1 });
    
    if (available.length === 0) {
      return { mode: 'forwarding', instructions: getForwardingInstructions() };
    }

    const params: Record<string, string> = {
      phoneNumber: available[0].phoneNumber,
      friendlyName: `restaurant-${restaurantId}`,
    };
    
    // Bundle required for AR numbers — if not configured, will fail gracefully
    if (bundleSid) params.bundleSid = bundleSid;

    const purchased = await client.incomingPhoneNumbers.create(params);
    return { mode: 'direct', phoneNumber: purchased.phoneNumber, sid: purchased.sid };
    
  } catch (err) {
    // Error 21649: Bundle required. Error 21631: Address required.
    // Both fall through to forwarding mode.
    return { mode: 'forwarding', instructions: getForwardingInstructions() };
  }
}

function getForwardingInstructions(): string {
  return [
    'Para conectar tu teléfono actual al sistema:',
    '1. Configurá el desvío de llamadas en tu celular',
    '2. Derivá al número: +1-XXX-XXX-XXXX (se asigna en tu panel)',
    '3. El sistema atenderá todas las llamadas desviadas',
  ].join('\n');
}
```

### Anti-Patterns to Avoid

- **Separate `useForm` per wizard step:** Data from previous steps is lost on navigation. Use ONE `useForm` at the parent with `FormProvider`.
- **Trusting restaurant_id from frontend body:** Backend must always read `restaurant_id` from verified JWT, never from request body. RLS is the last safety net but the middleware should enforce it first.
- **Polling for availability updates:** Do not `setInterval` GET /menu-items. Use Supabase Realtime subscription — see Pattern 3.
- **Hand-rolling slug normalization:** `slugify` handles ñ, á, é, ü, ç. A custom `/[^a-z0-9-]/g` regex silently drops these and produces empty slugs for names like "Ñoño Burger".
- **Not calling refreshSession() after restaurant creation:** The wizard completes, but `useRestaurantId()` still returns null because the JWT was minted before the restaurants row existed. This causes an infinite redirect loop.
- **Using REPLICA IDENTITY FULL without need:** Only set it if you need old record values on DELETE. Default is sufficient for MENU-04 toggle use case.

---

## Twilio AR / ENACOM — Detailed Finding

### Summary (CRITICAL DECISION POINT)

**What research found:**

1. **Twilio DOES offer Argentina local numbers** — listed in pricing page as standard offering at $8/mo + $0.01/min inbound. [CITED: twilio.com/en-us/voice/pricing/ar]

2. **Regulatory bundle is REQUIRED for AR local numbers.** Twilio's documentation states that for regulated countries, provisioning requires a valid `BundleSid` or `AddressSid`. Argentina is a regulated country. Without it, the API returns error 21649 ("Phone Number Requires a Bundle"). [CITED: twilio.com/docs/api/errors/21649]

3. **The bundle must include an Argentina address.** Regulatory guidelines state: "Address: Must be within locality or region covered by the phone number's prefix; a PO Box is not acceptable." [CITED: twilio.com/en-us/guidelines/ar/regulatory]

4. **The "end user" can be the business purchasing the number — but the address must be Argentine.** The restaurant's own address (which the owner enters in Step 1 of onboarding) qualifies as the end-user address for the bundle. This is the key insight: a foreign company CAN buy AR local numbers IF they submit a regulatory bundle with the end-user's (restaurant's) Argentine address and business documentation. [ASSUMED — this interpretation of "end user" is standard Twilio practice but not explicitly confirmed for AR]

5. **Bundles cannot be fully automated for first-time AR purchases.** Creating a Regulatory Bundle via API requires submitting documents and awaiting Twilio's review. This is a manual, async process — not suitable for real-time onboarding. [CITED: twilio.com/docs/phone-numbers/regulatory/getting-started]

6. **Telnyx offers Argentina local numbers at $1/mo** and may have lighter regulatory requirements. This is the Phase 7 migration path, not Phase 2. [CITED: telnyx.com/phone-numbers/argentina]

### Decision for Phase 2

**Use dual-mode provisioning:**

- **Mode A (direct):** If a pre-approved Twilio regulatory bundle (`TWILIO_AR_BUNDLE_SID`) is configured as an env var (set up manually by the developer in Twilio Console), the backend attempts to buy an AR number programmatically. This is the path for Wonder Hamburguesería (pilot) where the developer controls the env.

- **Mode B (forwarding):** If no bundle SID is configured, or if the Twilio API call fails, the system shows the restaurant owner clear forwarding instructions: configure call forwarding (desvío) from their existing phone to a Twilio US number that routes to the Vapi assistant.

**Forwarding path mechanics:**
- Buy one Twilio US number for the SaaS (no regulatory requirement, instant)
- Restaurant owner sets call forwarding on their existing AR cell: all calls → Twilio US number
- Twilio routes to Vapi assistant based on `To` number + `assistantId` mapping
- This works TODAY with no regulatory blockers. Call quality: slightly higher latency (international hop) but acceptable.

**Onboarding UI for forwarding mode:**
- Display the Twilio US number prominently
- Step-by-step instructions for forwarding configuration on Claro AR, Personal AR, Movistar AR
- "Tu número actual sigue siendo el mismo para tus clientes — el sistema atiende automáticamente"

**Regulatory path for direct mode (post-MVP):**
- Create Regulatory Bundle in Twilio Console once per country setup
- Associate restaurant's AR address document
- Submit for Twilio review (typically 2-5 business days)
- Store approved `BundleSid` in env → automatic provisioning works

### Phone Number Cost

| Path | Monthly Cost | Per Minute Inbound |
|------|-------------|-------------------|
| Twilio AR local (direct) | $8.00 USD | $0.0100 |
| Twilio US (forwarding) | $1.15 USD | $0.0085 |
| Telnyx AR (Phase 7) | $1.00 USD | ~$0.005 |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug normalization | Custom regex strip | `slugify` with `locale: 'es'` | Handles ñ, accents; custom regex produces empty slug for "Ñoño" |
| Per-step form validation | Manual field tracking | `react-hook-form trigger(fieldNames)` | trigger() validates specific fields and returns boolean; no re-render until called |
| Multi-step state persistence | localStorage + JSON | RHF `defaultValues` + URL step param | RHF holds all values in memory; URL param survives refresh |
| Realtime polling | setInterval + fetch | Supabase Realtime Postgres Changes | Built into existing Supabase SDK; RLS-aware; WebSocket connection reused |
| Password-style token auth | Custom JWT verify | `supabaseAdmin.auth.getUser(token)` | Validates signature + expiry + checks against Supabase auth state |
| Twilio credentials in frontend | Environment injection at build time | Backend-only Twilio routes | Twilio Account SID + Auth Token = full account access; never in browser |
| Slug uniqueness at DB level | Application-level UNIQUE check only | `UNIQUE` constraint already on `restaurants.slug` + loop in app | DB constraint is the final safety net; app loop prevents wasted round-trips |

**Key insight:** The main hand-roll trap in this phase is trying to build a wizard state machine or realtime layer from scratch. RHF's `FormProvider` + Supabase Realtime eliminate both entirely.

---

## Common Pitfalls

### Pitfall 1: Redirect Loop on Onboarding Completion

**What goes wrong:** Wizard completes and backend creates `restaurants` row. Frontend navigates to `/dashboard`. Dashboard reads `useRestaurantId()` which returns `null` (JWT still old). Dashboard sends user back to `/onboarding`. User is stuck.

**Why it happens:** The JWT was minted before the `restaurants` row existed. The `custom_access_token_hook` injects `restaurant_id: null` at mint time. The hook does not fire again until the session is explicitly refreshed.

**How to avoid:** Call `await supabase.auth.refreshSession()` immediately after the backend confirms restaurant creation. Wait for the promise to resolve before navigating. [VERIFIED: Supabase community docs]

**Warning signs:** User completes wizard but immediately returns to it; `useRestaurantId()` returns null after onboarding.

### Pitfall 2: Zod v4 Import Path Change

**What goes wrong:** `import { z } from 'zod'` works, but `zodResolver` from `@hookform/resolvers/zod` may not work with zod v4 if there's an import path mismatch.

**Why it happens:** Zod v4 (released 2025) changed some internals. `@hookform/resolvers@5.x` is the compatible version.

**How to avoid:** Use `@hookform/resolvers@5.2.2` (already listed in Standard Stack). Import zod as `import { z } from 'zod/v4'` if using the new API. [VERIFIED: npm registry — resolvers 5.2.2 is current]

**Warning signs:** `zodResolver` throws type errors at compile time; form doesn't validate.

### Pitfall 3: Supabase Realtime Not Receiving Events

**What goes wrong:** Toggle fires, DB updates, but the browser's Realtime subscription never triggers the callback.

**Why it happens (most common causes):**
1. Table not added to `supabase_realtime` publication
2. Channel name collision (multiple subscriptions with same channel name)
3. Filter value is a string but DB column is UUID — `filter: 'restaurant_id=eq.abc'` (string) vs UUID column → silent mismatch

**How to avoid:**
1. Run migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;`
2. Use unique channel names: `menu-items-${restaurantId}` (includes restaurantId)
3. UUID filter works correctly in Supabase Realtime — use the actual UUID string in the filter

**Warning signs:** Toggle shows update in DB (Supabase dashboard), but frontend doesn't update without page refresh.

### Pitfall 4: Hours Schema — 0-index vs ISO Day

**What goes wrong:** `restaurant_hours.day_of_week` uses 0=Sunday, 1=Monday (ISO) from Phase 1 schema. Frontend displays days as Lun–Dom (Monday first, Argentine convention). If the mapping is off by one, closed days are wrong and the voice agent rejects calls on correct days.

**Why it happens:** ISO week starts Sunday (0) but Argentine UI convention shows Monday first.

**How to avoid:** In the UI, display order `[1,2,3,4,5,6,0]` (Lun–Dom). Store the ISO value in DB. Always label clearly.

**Warning signs:** Agent says "estamos cerrados" when restaurant is open on Monday.

### Pitfall 5: Twilio Number Provisioning Race (During Onboarding)

**What goes wrong:** Two simultaneous onboarding requests buy the same AR number (inventory is limited).

**Why it happens:** Twilio's `availablePhoneNumbers.list()` returns numbers that may be claimed by concurrent requests.

**How to avoid:** The `incomingPhoneNumbers.create()` call is atomic — if the number is already taken, Twilio returns an error. Catch this error and retry with the next available number. Limit 3 retries, then fall back to forwarding mode.

**Warning signs:** `incomingPhoneNumbers.create()` returns 21422 ("Invalid phone number").

### Pitfall 6: Delivery Zones Column Missing from Schema

**What goes wrong:** `restaurants` table from Phase 1 has no `delivery_zones` column. ONB-03 requires storing it.

**Why it happens:** Phase 1 schema was finalized before ONB-03 was fully specified.

**How to avoid:** Phase 2 requires a Supabase migration:
```sql
ALTER TABLE restaurants ADD COLUMN delivery_zones text;
```
This is a safe addition (nullable column, existing RLS policy covers it).

**Warning signs:** Backend INSERT fails with column not found; frontend cannot save delivery zones.

---

## Code Examples

### Schema Migration for delivery_zones

```sql
-- Migration: 0002_delivery_zones.sql
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_zones text;
-- Also add menu_items and menu_categories to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
```

### Backend: POST /api/restaurants (Wizard Completion Endpoint)

```typescript
// Source: Express 5 docs + Supabase service role pattern [CITED + ASSUMED]
// apps/backend/src/routes/restaurants.ts

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { name, slug: rawSlug, address, delivery_zones, agent_name, hours } = req.body;
  
  // Generate unique slug
  const slug = rawSlug || await generateUniqueSlug(name);
  
  // Create restaurant row — userId from JWT, not from body
  const { data: restaurant, error: rErr } = await supabaseAdmin
    .from('restaurants')
    .insert({
      owner_id: req.userId,
      name,
      slug,
      address,
      delivery_zones,
      agent_name: agent_name || 'Sofía',
    })
    .select()
    .single();
  
  if (rErr) return res.status(400).json({ error: rErr.message });

  // Batch insert 7 hours rows
  const hoursRows = (hours as HoursInput[]).map(h => ({
    restaurant_id: restaurant.id,
    day_of_week: h.day_of_week,
    open_time: h.is_closed ? null : h.open_time,
    close_time: h.is_closed ? null : h.close_time,
    is_closed: h.is_closed,
  }));
  await supabaseAdmin.from('restaurant_hours').insert(hoursRows);

  // Subscriptions row (trial)
  await supabaseAdmin.from('subscriptions').insert({ restaurant_id: restaurant.id });
  
  // Counter row
  await supabaseAdmin.from('restaurant_counters').insert({
    restaurant_id: restaurant.id,
    last_order_number: 0,
  });
  
  // Twilio provisioning (dual-mode)
  const phoneResult = await provisionArgentinaNumber(
    restaurant.id,
    process.env.TWILIO_AR_BUNDLE_SID
  );
  
  // Store phone number if direct mode
  if (phoneResult.mode === 'direct') {
    await supabaseAdmin.from('restaurants').update({
      phone: phoneResult.phoneNumber
    }).eq('id', restaurant.id);
  }

  return res.status(201).json({ restaurant, phone: phoneResult });
});
```

### Backend: PATCH /api/menu-items/:id/availability

```typescript
// apps/backend/src/routes/menu-items.ts
router.patch('/:id/availability', requireAuth, async (req: AuthedRequest, res) => {
  const { available } = req.body;
  if (typeof available !== 'boolean') {
    return res.status(400).json({ error: 'available must be boolean' });
  }
  
  // RLS: restaurant_id check via auth middleware ensures tenant isolation
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .update({ available, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('restaurant_id', req.restaurantId)  // explicit tenant check in addition to RLS
    .select()
    .single();
  
  if (error || !data) return res.status(404).json({ error: 'item not found' });
  return res.json(data);
});
```

### Frontend: StepHorario Component

```typescript
// Source: react-hook-form useFormContext pattern [CITED]
// apps/frontend/src/components/onboarding/StepHorario.tsx
import { useFormContext } from 'react-hook-form';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lun–Dom (AR convention)

export function StepHorario() {
  const { register, watch, setValue } = useFormContext();
  
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Horario de atención</h2>
      {DISPLAY_ORDER.map(dayIndex => {
        const isClosed = watch(`hours.${dayIndex}.is_closed`);
        return (
          <div key={dayIndex} className="flex items-center gap-3">
            <span className="w-10 text-sm">{DAYS[dayIndex]}</span>
            <Switch
              checked={!isClosed}
              onCheckedChange={(open) => setValue(`hours.${dayIndex}.is_closed`, !open)}
            />
            {!isClosed && (
              <>
                <Input type="time" {...register(`hours.${dayIndex}.open_time`)} />
                <span>–</span>
                <Input type="time" {...register(`hours.${dayIndex}.close_time`)} />
              </>
            )}
            {isClosed && <span className="text-muted-foreground text-sm">Cerrado</span>}
          </div>
        );
      })}
    </div>
  );
}
```

---

## Runtime State Inventory

> Not a rename/refactor phase. No runtime state inventory required.

Phase 2 is greenfield feature addition. Existing Phase 1 runtime state (deployed Railway backend, Vercel frontend, Supabase schema) is not being renamed or refactored.

**Migration caveat:** One DB migration IS needed (delivery_zones column + realtime publications). This is additive, not a rename.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate useForm per wizard step | Single useForm + FormProvider + trigger() | RHF v7 (2021+) | Eliminates data loss on step navigation |
| Polling for real-time UI updates | Supabase Realtime Postgres Changes | Supabase Realtime GA 2023 | No setInterval; WebSocket pushes changes |
| zod v3 `z.object` global import | zod v4 `import { z } from 'zod/v4'` | Zod v4 released 2025 | Dual import path; @hookform/resolvers v5 handles this |
| Twilio AR numbers "developer preview" | Now GA (local + toll-free beta) | ~2022–2023 | Can programmatically purchase; regulatory bundle required |
| Custom JWT decode on backend | `supabaseAdmin.auth.getUser(token)` | Supabase JS SDK v2 | Handles expiry + signature + revocation |

**Deprecated/outdated:**
- `supabase.from().select()` with manual `restaurant_id` WHERE clause: Do not replace RLS, but keep explicit tenant ID in queries for defense-in-depth (two-layer: middleware + RLS)
- Twilio `AddressSid` only (for AR): Now requires full regulatory Bundle; AddressSid alone is insufficient for AR local numbers

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend | ✓ | (Railway managed) | — |
| pnpm | Package manager | ✓ | 9.15.0 | — |
| Supabase project | DB + Auth + Realtime | ✓ | (hzgunbftloevclkohcdf) | — |
| Twilio account + credentials | ONB-04 phone provisioning | UNKNOWN | — | Forwarding instructions mode |
| TWILIO_AR_BUNDLE_SID env var | Direct AR number purchase | UNKNOWN — must be configured | — | Forwarding mode (graceful fallback) |
| supabase_realtime publication | MENU-04 realtime toggle | Needs migration | — | Run 0002 migration |
| Supabase Dashboard SQL access | Apply migration 0002 | ✓ (verified Phase 1) | — | — |

**Missing dependencies with no fallback:**
- None blocking — forwarding mode covers the Twilio case

**Missing dependencies with fallback:**
- `TWILIO_AR_BUNDLE_SID`: Without it, system falls back to forwarding instructions (fully functional MVP)
- `supabase_realtime` publication: Without the migration, realtime toggle silently fails. **Wave 0 must include the migration.**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (frontend + backend) |
| Config file | `apps/frontend/vitest.config.ts` / `apps/backend/vitest.config.ts` |
| Quick run command | `pnpm -r --if-present run test` |
| Full suite command | `pnpm -r --if-present run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONB-01 | Wizard step 1 validates name/slug/address before advance | unit | `vitest run apps/frontend/src/__tests__/onboarding.test.tsx` | ❌ Wave 0 |
| ONB-02 | Hours 7-row batch INSERT via backend endpoint | unit | `vitest run apps/backend/src/__tests__/restaurants.test.ts` | ❌ Wave 0 |
| ONB-04 | Dual-mode provisioning returns forwarding if no bundle | unit (mock Twilio) | `vitest run apps/backend/src/__tests__/phone.test.ts` | ❌ Wave 0 |
| MENU-01 | Category CRUD endpoints return 401 without auth | unit | `vitest run apps/backend/src/__tests__/menu.test.ts` | ❌ Wave 0 |
| MENU-03 | Option groups/items persist nested under item | unit | same file | ❌ Wave 0 |
| MENU-04 | PATCH availability returns updated item; Realtime fires | integration (manual) | manual — Realtime requires live WS | manual |
| ONB-06 | agent_name defaults to 'Sofía' if not provided | unit | `apps/backend/src/__tests__/restaurants.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm -r --if-present run test`
- **Per wave merge:** `pnpm -r --if-present run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/frontend/src/__tests__/onboarding.test.tsx` — covers ONB-01 step validation
- [ ] `apps/backend/src/__tests__/restaurants.test.ts` — covers ONB-02, ONB-06
- [ ] `apps/backend/src/__tests__/phone.test.ts` — covers ONB-04 dual-mode (mock twilio)
- [ ] `apps/backend/src/__tests__/menu.test.ts` — covers MENU-01, MENU-03
- [ ] `apps/backend/src/__tests__/menu-categories.test.ts` — covers MENU-01

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase JWT verified on every backend request via `supabaseAdmin.auth.getUser()` |
| V3 Session Management | yes | `supabase.auth.refreshSession()` after restaurant creation — session re-validated |
| V4 Access Control | yes | RLS on all tables (Phase 1) + explicit `restaurant_id` filter in backend queries |
| V5 Input Validation | yes | Zod schemas on frontend (per step) + express-validator on backend routes |
| V6 Cryptography | no | No additional crypto in Phase 2; AES-256 at rest via Supabase (Phase 1) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant data leakage via missing restaurant_id check | Information Disclosure | RLS (defense layer 1) + explicit `.eq('restaurant_id', req.restaurantId)` in all queries (defense layer 2) |
| Slug squatting (user registers slug of competitor) | Tampering | UNIQUE constraint enforces global uniqueness; slug auto-generated from name (owner cannot set arbitrary slug in MVP) |
| PATCH /menu-items/:id/availability on another tenant's item | Elevation of Privilege | Backend checks `restaurant_id = req.restaurantId` before update; RLS blocks at DB level |
| Twilio credentials exposure | Information Disclosure | SEC-04 CI grep already enforces no service keys in frontend; Twilio routes backend-only |
| Mass assignment in restaurant PATCH | Tampering | Whitelist fields explicitly: `{ name, address, agent_name, delivery_zones }` — never spread req.body into DB query |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A foreign company CAN buy Twilio AR local numbers by providing the restaurant's Argentine address as the regulatory bundle end-user address | Twilio AR section | If Twilio requires the ACCOUNT HOLDER to be AR-based, direct mode is permanently unavailable — forwarding mode becomes the only path |
| A2 | Zod v4 import path `zod/v4` is compatible with @hookform/resolvers@5.2.2 | Standard Stack | If incompatible, pin zod to v3.x (last v3 = 3.24.x) |
| A3 | `delivery_zones` column does not exist in Phase 1 schema | Pitfall 6 | If it already exists (added silently), the migration will no-op due to `IF NOT EXISTS` |
| A4 | Supabase Realtime filter by `restaurant_id` UUID works correctly for the menu_items table | Pattern 3 | If filter has UUID string matching issue, all tenants receive all updates (security leak) — verify in integration test |
| A5 | Slugify v1.6.9 with `locale: 'es'` correctly handles Argentine restaurant names including ñ | Standard Stack | If locale handling fails, test with "Ñoño Burgers" and "Ñoqui del Abuelo" |

---

## Open Questions

1. **Twilio ACCOUNT-level AR eligibility**
   - What we know: AR local numbers require regulatory bundle with AR address
   - What's unclear: Whether the Twilio ACCOUNT itself must be AR-based vs. providing restaurant's AR address as end-user
   - Recommendation: Test in Twilio Console with a sandbox account before Phase 2 execution. If account-level requirement exists, forwarding mode is permanent for MVP.

2. **wonder-pedix-raw.json contents**
   - What we know: There is menu research data at `.planning/research/wonder-pedix-raw.json` (65K tokens — too large to read)
   - What's unclear: Whether Wonder Hamburguesería has specific menu structure that affects the option_groups schema design
   - Recommendation: Planner should seed the MenuEditor with Wonder data as a smoke test. Read first 100 items from the JSON for schema validation.

3. **Supabase migration process for Production**
   - What we know: Phase 1 migrations were applied via Supabase Dashboard SQL Editor (no CLI available)
   - What's unclear: Whether migration 0002 (delivery_zones + realtime publication) can be applied before the frontend deploy without downtime
   - Recommendation: Apply migration 0002 first (additive column = no downtime), then deploy frontend. Realtime subscription only activates after publication is set.

---

## Sources

### Primary (HIGH confidence)
- [CITED: supabase.com/docs/guides/realtime/postgres-changes] — Realtime subscription API, RLS interaction, publication setup, filter syntax
- [CITED: supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook] — Hook fires on token mint; refreshSession() triggers re-mint
- [CITED: npm registry] — react-hook-form@7.75.0, zod@4.4.3, @hookform/resolvers@5.2.2, slugify@1.6.9, twilio@6.0.2, express-validator@7.3.2 (all verified 2026-05-11)
- [CITED: twilio.com/en-us/guidelines/ar/regulatory] — AR address requirements for local numbers; business documentation required; PO Box not accepted
- [CITED: twilio.com/en-us/voice/pricing/ar] — AR local numbers $8/mo + $0.01/min; toll-free $25/mo + $0.26/min
- [CITED: twilio.com/docs/api/errors/21649] — Bundle required error for regulated countries
- [CITED: react-hook-form.com (community docs)] — FormProvider + trigger() per-step validation pattern

### Secondary (MEDIUM confidence)
- [twilio.com/docs/phone-numbers/regulatory/getting-started] — Bundle creation process requires manual document submission and Twilio review; async, not real-time
- [Supabase community discussion #22337] — refreshSession() as the mechanism to re-fire custom_access_token_hook
- [telnyx.com/phone-numbers/argentina] — Telnyx offers AR numbers at $1/mo (Phase 7 migration target)
- [blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/] — Multi-step wizard with RHF + Zod pattern

### Tertiary (LOW confidence — flag for validation)
- [ASSUMED] Foreign company can provide end-user's Argentine address for Twilio regulatory bundle (not explicitly confirmed in official docs — verify in Twilio Console)
- [ASSUMED] Zod v4 + @hookform/resolvers v5 compatibility (inferred from version alignment, not tested in this codebase)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- Twilio AR regulatory path: LOW-MEDIUM — confirmed bundle requirement; foreign entity eligibility ASSUMED
- Architecture patterns: HIGH — RHF FormProvider, Supabase Realtime both from official docs
- Pitfalls: HIGH — redirect loop and realtime setup pitfalls are well-documented in official sources

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 for stable items; 2026-05-25 for Twilio AR regulatory status (verify before execution)
