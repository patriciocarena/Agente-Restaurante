# Phase 1: Foundations - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 entrega la infraestructura base sobre la que se construye todo lo demás: monorepo configurado, schema de Supabase completo con RLS estricta, auth funcional (signup/login/verify/reset/logout), y los targets de deploy (Railway + Vercel) conectados a Supabase. No hay features de producto todavía — solo el cimiento seguro y multi-tenant.

Al finalizar Phase 1, un dueño de restaurante puede crear cuenta y loguearse viendo exactamente cero datos de otros restaurantes. Nada más, nada menos.

</domain>

<decisions>
## Implementation Decisions

### Estructura del repositorio

- **D-01:** Monorepo de un solo repositorio con estructura:
  - `/apps/backend` — Node.js + Express + TypeScript (deploy a Railway)
  - `/apps/frontend` — React + Vite + Tailwind (deploy a Vercel)
  - `/packages/shared` — tipos TypeScript compartidos entre backend y frontend (OrderItem, MenuCategory, etc.)
  - Tooling: `pnpm workspaces`. No Turborepo — demasiado overhead para equipo chico.

### Schema de menú (enriquecido desde Phase 1)

- **D-02:** El schema de `menu_items` soporta option groups con cardinalidad desde el día 1. Motivación: Wonder Hamburguesería (piloto) tiene ítems sin precio base (el precio lo determina la opción elegida) y grupos con min/max selecciones.

  Tablas requeridas en Phase 1 schema:

  ```
  menu_items
    id, restaurant_id, category_id, name, description
    base_price (nullable — null cuando el precio depende de la opción)
    available (boolean, default true)
    sort_order, created_at, updated_at

  option_groups
    id, menu_item_id, name
    min_selections (int, default 0 — 0 = opcional)
    max_selections (int, default 1 — 1 = elegí uno)
    sort_order

  option_items
    id, option_group_id, name
    price_delta (int, default 0 — puede ser positivo, negativo, o el precio absoluto cuando base_price es null)
    is_default (boolean)
    sort_order
  ```

  Nota para el planner: cuando `menu_items.base_price` es NULL, `option_items.price_delta` actúa como precio absoluto de esa opción. Esto permite modelar "Hamburguesa Veggie — elegí Mixta $X o Garbanzos $Y" sin base price.

### RLS + JWT (aislamiento multi-tenant)

- **D-03:** `restaurant_id` se inyecta en el JWT de Supabase vía `app_metadata`. Mecanismo: trigger en Postgres que se dispara en `INSERT INTO restaurants` y llama `auth.admin.updateUserById()` para agregar `restaurant_id` al `app_metadata` del usuario. Supabase incluye `app_metadata` automáticamente en el JWT.

- **D-04:** Las RLS policies usan `(auth.jwt()->>'restaurant_id')::uuid` para filtrar filas. Todas las tablas con datos del restaurante deben tener policies `FOR ALL` que verifiquen `restaurant_id = (auth.jwt()->>'restaurant_id')::uuid`.

  Tablas con RLS estricta: `restaurants`, `menu_categories`, `menu_items`, `option_groups`, `option_items`, `orders`, `order_items`, `restaurant_counters`, `restaurant_hours`, `subscriptions`.

- **D-05:** El frontend usa exclusivamente la Supabase anon key. La service role key solo existe en el backend (Railway) y nunca en el bundle del frontend.

### Encriptación de teléfonos de clientes (SEC-05)

- **D-06:** Cifrado en disco de Supabase (AES-256, activado por defecto) es suficiente para v1. No se implementa pgcrypto column-level encryption.

- **D-07:** Política de no-log en el código: `customer_phone` nunca se incluye en `console.log`, `logger.error`, mensajes de error al cliente, ni trazas de Sentry/Datadog. Se anota explícitamente en los comments del código donde aplique.

### Schema adicional requerido en Phase 1

- **D-08:** `restaurant_counters` table (para order_number per-tenant, usado en Phase 3):
  ```
  restaurant_counters: id, restaurant_id (UNIQUE), last_order_number (int, default 0)
  ```
  Mecanismo: `UPDATE restaurant_counters SET last_order_number = last_order_number + 1 WHERE restaurant_id = $1 RETURNING last_order_number`.

- **D-09:** `subscriptions` table schema creada en Phase 1 (Mercado Pago la usa en Phase 5):
  ```
  subscriptions: id, restaurant_id, mp_preapproval_id, status (trial|active|past_due|suspended|cancelled), current_period_end, created_at, updated_at
  ```

- **D-10:** Mercado Pago SDK client singleton inicializado en el backend (solo inicialización, sin API calls reales — eso va en Phase 5). Permite a Phase 5 asumir que el cliente ya existe.

### Claude's Discretion

- Estructura exacta del `packages/shared` (qué tipos exportar primero) — lo decide el planner según las interfaces que necesita Phase 1.
- Configuración de `tsconfig.json` y `eslint` — el planner elige una config razonable para el stack.
- Nombrado de variables de entorno (ej: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc.) — el planner sigue convenciones estándar de Supabase/Railway/Vercel.
- Seeding de datos de test para development — el planner puede incluir un seed script básico con un restaurante de prueba.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Stack completo, constraints, key decisions (especialmente bugs del spec original corregidos)
- `.planning/REQUIREMENTS.md` — AUTH-01..07, SEC-04, SEC-05 son los requirements de esta fase
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 puntos que deben ser TRUE al finalizar)

### Piloto Wonder (insumo para seed y schema design)
- `.planning/research/wonder-menu.md` — Menú completo de Wonder + schema findings section (documenta exactamente por qué el schema simple no alcanza)
- `.planning/research/wonder-pedix-raw.json` — JSON raw del menú de Wonder (148KB). Útil para diseñar el seed script de Phase 2.

### Stack docs (a investigar durante research phase)
- Supabase RLS docs: custom claims via `app_metadata`, trigger pattern para inyectar `restaurant_id`
- Supabase Auth hooks (paid plan) vs trigger approach (free plan) — elegir según plan del proyecto
- pnpm workspaces docs: configuración de workspace con TypeScript project references

No external specs beyond planning docs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Ninguno — proyecto greenfield. Solo existe `CLAUDE.md` en el repo.

### Established Patterns
- Ninguno todavía. Phase 1 establece los patrones que las fases siguientes van a seguir.

### Integration Points
- Phase 2 (Onboarding & Menu) consume el schema de `menu_items`, `option_groups`, `option_items` creado en Phase 1.
- Phase 3 (Voice MVP) consume `restaurant_counters`, `restaurant_hours`, y el Mercado Pago client stub.
- Phase 5 (Billing) consume la tabla `subscriptions` y el MP client singleton.

</code_context>

<specifics>
## Specific Ideas

- El usuario prefiere velocidad sobre perfección en esta fase: "estoy mas concentrado en hacer que funcione el sistema". No agregar complejidad innecesaria.
- El usuario es estudiante de ingeniería industrial, no programador. Las decisiones las tomamos nosotros; el usuario aprueba. Los commits y el código deben ser claros y tener comentarios donde el WHY no es obvio.
- Piloto concreto: Wonder Hamburguesería (Villa Allende, Córdoba). El seed de Phase 2 va a usar el JSON real de Wonder. Phase 1 debe asegurarse que el schema soporte ese menú sin cambios.

</specifics>

<deferred>
## Deferred Ideas

- **Schema de option groups**: El usuario inicialmente quiso simplificar (schema simple + migrar en Phase 2), pero se arrepintió y optó por el schema enriquecido. Decisión final: schema enriquecido desde Phase 1. Registrado para que no haya confusión.
- **pgcrypto column-level encryption**: Deferido. La protección de teléfonos de clientes en v1 se cubre con el cifrado en disco de Supabase + política de no-log. Reevaluar si hay auditoría de compliance.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundations*
*Context gathered: 2026-05-07*
