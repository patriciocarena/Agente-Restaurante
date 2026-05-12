# Phase 02: Onboarding & Menu - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 02 entrega el camino completo entre "el dueño se registró" y "el menú está listo para que la agente lo lea". Esto incluye:

- **Wizard de onboarding** (4 pasos) que captura datos del restaurante, horario semanal, zonas de delivery, y nombre del agente.
- **Aprovisionamiento de número Twilio US** (forwarding-only en MVP) con instrucciones para desviar la línea del restaurante.
- **Página `/settings`** unificada para editar los settings post-wizard.
- **MenuEditor** completo con categorías, items, option_groups (cardinalidad min/max + price_delta), y toggle de disponibilidad mid-shift via Supabase Realtime.

Al terminar Phase 02 un restaurante recién registrado puede llegar al estado donde tiene horarios cargados, un número desviable y un menú completo. Phase 03 enchufa Vapi para que la agente lea ese menú.

**No incluye** (out of scope):
- Compra de número AR directo via Twilio ENACOM bundle — diferido (ver `<deferred>`).
- Vapi assistant lifecycle / system prompt generation — Phase 03.
- Mercado Pago billing — Phase 05.
- Geocoding o validación de direcciones — v2.

</domain>

<decisions>
## Implementation Decisions

### Onboarding Wizard

- **D-01:** Wizard de **4 pasos**, en este orden:
  1. **Datos del restaurante** — nombre, slug (auto-derivado del nombre con `slugify`), dirección.
  2. **Horario** — 7 filas (Lun-Dom) con time picker `from`/`to` por cada día + checkbox "cerrado". Guarda en `restaurant_hours` (jsonb por día).
  3. **Zonas de delivery** — textarea libre (ej: "Villa Allende centro, Argüello, Saldán"). Guarda en `restaurants.delivery_zones` (text, NULLABLE).
  4. **Voice / Agent name** — input para nombre del agente con default `"Sofía"`.

  Twilio aprovisionamiento ocurre **al apretar "Terminar"** del paso 4, no en un paso explícito. Si falla, se bloquea el wizard (ver D-07).

- **D-02:** **Resume automático** desde el último paso completado. Mecanismo: agregar columna `restaurants.onboarding_step` (smallint, default 0). Cada vez que el usuario apreta "Siguiente" se hace UPSERT del paso completado. Al volver a `/onboarding`, el frontend lee `onboarding_step` y salta al siguiente paso. Si `onboarding_step >= 4`, redirige a `/dashboard`.

- **D-03:** **Validación per-step** con `react-hook-form` + `trigger()` + Zod schemas (uno por paso). El botón "Siguiente" llama `trigger()` solo sobre los campos del paso actual; si pasa, hace UPSERT en backend y avanza. Si falla, muestra errores inline al lado de cada campo.

- **D-04:** Settings post-wizard se editan en una **página `/settings` unificada** (no rutas separadas por categoría). Layout: pestañas o secciones colapsables con: Datos, Horario, Delivery, Voice, Twilio number. Reutiliza los mismos componentes/Zod schemas del wizard.

### Twilio Strategy (forwarding-only MVP)

- **D-05:** **Forwarding-only en v1.** El sistema asigna un número Twilio **US** (no AR), comprado vía Twilio API en `provisionNumber()`. El dueño desvía su línea fija/celular hacia ese número (instrucciones via doc externa — ver D-08). Razones:
  - Evita el bundle ENACOM y su documentación manual.
  - Cero fricción regulatoria: funciona desde el día 1.
  - Wonder (el piloto) no necesita un número AR — los clientes seguirán llamando al teléfono de Wonder.

  AR direct programmatic queda deferido (ver `<deferred>`).

- **D-06:** **El backend aprovisiona el número automáticamente** al cerrar el wizard. Flujo: POST `/api/onboarding/finish` → backend llama `twilio.incomingPhoneNumbers.create()` con un área code US (configurable env var `TWILIO_DEFAULT_AREA_CODE`, default e.g. `415`) → guarda `restaurants.twilio_number` y `restaurants.twilio_phone_sid` → setea `onboarding_step = 4` (finalizado).

  Schema requerido en Phase 1 ya tiene `restaurants.twilio_number` (verificar). Si falta `twilio_phone_sid`, agregar en migration de Phase 02.

- **D-07:** Si la API de Twilio falla durante el aprovisionamiento, **el wizard se bloquea** en una pantalla de error con:
  - Mensaje claro (sin exponer raw error de Twilio).
  - Botón "Reintentar" (vuelve a llamar `/api/onboarding/finish`).
  - Después de 3 intentos fallidos, mostrar "Contactanos para ayudarte" + CTA a soporte (email/WhatsApp configurable env var).

  No hay reintento automático en background ni worker queue — minimizar infra de v1.

- **D-08:** Las **instrucciones de desvío de línea** se sirven via documentación externa (Notion público o blog estático). El dashboard y `/settings` linkean al doc. Tres secciones del doc:
  - Movistar (`*21*<numero>#` para activar, `#21#` para desactivar).
  - Claro (`**21*<numero>#`).
  - Personal (similar a Movistar).

  El doc se mantiene fuera del repo. URL configurable env var `FORWARDING_DOCS_URL`.

### MenuEditor

- **D-09:** Layout **sidebar + lista**. Dos columnas:
  - **Sidebar izquierda** (~25% ancho): lista vertical de categorías clickeables, con drag-handle para reordenar (`sort_order` field) y botón "+ Nueva categoría" al fondo.
  - **Main derecha** (~75%): items de la categoría seleccionada, en lista vertical compacta. Cada item card muestra: nombre + precio base (o "Variable" si `base_price` is NULL) + Switch de disponibilidad + botón editar (abre modal). Botón "+ Nuevo item" al fondo.

  Funciona en desktop y tablet horizontal. En mobile (vertical), el sidebar colapsa a un drawer.

- **D-10:** **Edición de item via modal** (componente shadcn `Dialog`). Campos:
  - Datos básicos: nombre, descripción, precio base (puede dejarse vacío = NULL → precio variable).
  - Sección colapsable **"Opciones (modificadores)"** con botón "+ Agregar grupo". Cada grupo:
    - Nombre del grupo (ej: "Punto de cocción").
    - `min_selections` (input number, default 0).
    - `max_selections` (input number, default 1).
    - Tooltip explicativo: "min=1, max=1 = elegir uno obligatorio. min=0, max=N = opcional, hasta N. min=0, max=1 = opcional, uno solo."
    - Lista de opciones con: nombre, price_delta (signed integer, default 0), checkbox is_default.
    - Botón "+ Agregar opción".
  - Botón guardar (POST/PATCH al backend, que persiste `menu_items` + `option_groups` + `option_items` en una transacción).

- **D-11:** Toggle disponibilidad = **Switch visible en cada item de la lista** (componente shadcn `Switch`). Un solo clic → optimistic UI update + PATCH al backend. Supabase Realtime propaga el cambio a otras pestañas/dispositivos del mismo restaurante en <2s (validar en MENU-04). Required: agregar `menu_items` a la publicación `supabase_realtime`.

- **D-12:** Menú vacío al post-wizard. **Template hamburguesera opcional**:
  - Empty state del MenuEditor muestra dos CTAs: "Cargar template hamburguesera" (primary) y "Crear primera categoría" (secondary).
  - El template es un seed JSON checkeado en el repo (`apps/backend/src/seeds/hamburgueseria-template.json`) con categorías típicas (Hamburguesas, Papas, Bebidas, Postres) e items de ejemplo SIN precios (el dueño completa precios después).
  - Endpoint POST `/api/menu/load-template` inserta el template para el `restaurant_id` actual. Idempotencia: no duplica si ya hay categorías cargadas (returns 409 con mensaje claro).
  - Para Wonder (piloto), el seed real (74 productos extraídos de Pedix) va en un script aparte: `apps/backend/scripts/seed-wonder.ts`. NO se ejecuta automático.

### Edge Cases

- **D-13:** **Empty state del MenuEditor** = pantalla centrada con ilustración simple (puede ser un SVG inline o emoji 🍔), título "Tu menú está vacío", y los dos CTAs de D-12.

- **D-14:** **Crear item sin categoría seleccionada** = botón "+ Nuevo item" deshabilitado si no hay categoría activa, con tooltip "Primero creá una categoría". El schema mantiene `menu_items.category_id NOT NULL` (consistente con Phase 1).

- **D-15:** **Borrar categoría con items dentro** = modal de confirmación shadcn con texto exacto: "Esta categoría tiene N items. Si la borrás, también se borran. ¿Continuar?" + botón rojo "Borrar todo". DB action: `ON DELETE CASCADE` en `menu_items.category_id → menu_categories.id` (verificar en schema; si falta, agregar en migration de Phase 02).

- **D-16:** **Twilio retry** = botón "Reintentar" en pantalla de error del wizard. Contador local del frontend; después de 3 fallos consecutivos en la misma sesión, oculta el botón y muestra mensaje "Hay un problema con la asignación. Escribinos a soporte." con CTA. No persistir el contador en DB (sesión-local es suficiente).

### Migrations requeridas en Phase 02

- **D-17:** Migration `0002_phase2_columns.sql` debe agregar:
  ```sql
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_zones text;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS onboarding_step smallint DEFAULT 0 NOT NULL;
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS twilio_phone_sid text;
  -- Verificar que ya existan; agregar solo si faltan:
  -- restaurants.twilio_number text
  -- restaurants.agent_name text DEFAULT 'Sofía'
  -- restaurant_hours jsonb (verify Phase 1 schema)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
  -- ON DELETE CASCADE on menu_items.category_id (verify; add if missing)
  ```

  El planner debe leer el schema actual de Phase 1 (`supabase/migrations/0001_initial_schema.sql`) antes de redactar 0002 para no duplicar columnas que ya existen.

### Claude's Discretion

- Componentes shadcn específicos a instalar (Dialog, Switch, Tabs, etc.) — el planner los lista según cada tarea.
- Endpoints REST exactos (POST `/api/restaurants`, PATCH `/api/menu/items/:id`, etc.) — el planner los define.
- Validación Zod schemas — el planner los redacta siguiendo los campos descritos arriba.
- Estructura de directorios dentro de `apps/frontend/src/components/onboarding/` y `apps/frontend/src/components/menu/` — el planner decide.
- Estrategia exacta del JWT refresh post-onboarding (`refreshSession()` desde el client después del UPSERT a `restaurants`) — ya descrito en el RESEARCH.md, el planner lo implementa.
- Detalles del seed JSON `hamburgueseria-template.json` (cuántas categorías, qué items de ejemplo) — el planner lo arma con criterio razonable (~4 categorías, ~3 items por cat).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Stack completo, constraints, key decisions del proyecto (incluyendo el menu schema enriquecido)
- `.planning/REQUIREMENTS.md` §Onboarding (ONB-01..04, ONB-06) y §Menu Management (MENU-01..04) — los 9 requirements de esta fase
- `.planning/ROADMAP.md` §"Phase 2: Onboarding & Menu" — goal y success criteria (4 puntos)
- `.planning/STATE.md` — progreso del proyecto y handoff desde Phase 01

### Phase 02 artifacts
- `.planning/phases/02-onboarding-menu/02-RESEARCH.md` — research completo (919 líneas): stack, Twilio AR analysis, schema gaps, 6 patterns, pitfalls, migrations requeridas

### Phase 01 carry-forward (decisiones que esta fase asume vivas)
- `.planning/phases/01-foundations/01-CONTEXT.md` — schema enriquecido de menú (D-02 ahí), RLS via `app_metadata.restaurant_id` (D-03/D-04), service-role-key never in frontend (D-05), no-log de customer_phone (D-07)
- `supabase/migrations/0001_initial_schema.sql` — schema base. **Leer antes de redactar la migration 0002**.

### Piloto Wonder (insumo para seed)
- `.planning/research/wonder-menu.md` — menú completo extraído (74 productos en 10 categorías, precios reales)
- `.planning/research/wonder-pedix-raw.json` — JSON raw del menú. Insumo del script `seed-wonder.ts`.

### Stack docs (a consultar durante implementación)
- react-hook-form 7.75.0 + `@hookform/resolvers` 5.2.2 + Zod 4.4.3 — wizard validation
- Twilio Node SDK 6.0.2 — `incomingPhoneNumbers.create()` para aprovisionar
- Supabase Realtime — `supabase_realtime` publication, RLS-aware subscriptions
- shadcn components: Dialog, Switch, Tabs, Form, Drawer (verificar componentes instalados)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 01)
- **Supabase client setup** (`apps/backend/src/lib/supabase.ts` o equivalente): admin client con service role key, usable para inserts privilegiados en el flujo de aprovisionamiento.
- **Auth middleware** (`apps/backend/src/middleware/auth.ts`): valida JWT, extrae `restaurant_id` del `app_metadata`. Reutilizable en endpoints de restaurants/menu.
- **Frontend Supabase client + auth context** (Phase 01): la sesión post-login ya está disponible; el wizard la usa.
- **Tailwind + shadcn dark theme** configurados en Phase 01. Reutilizar componentes ya disponibles (Button, Input, Label, Form).
- **PII-redacting logger** (Phase 01): customer_phone no se loggea — en Phase 02 no hay customer_phone pero el patrón se mantiene.

### Established Patterns (Phase 01)
- **RLS estricta**: cada endpoint de Phase 02 (`/api/restaurants/me`, `/api/menu-categories`, `/api/menu-items`, etc.) usa supabase client con el JWT del usuario, no service role. Confía en RLS para el aislamiento.
- **Custom Access Token Hook**: el `app_metadata.restaurant_id` ya se inyecta automático. El wizard, después de crear el restaurant, llama `supabase.auth.refreshSession()` para que el JWT incluya el nuevo `restaurant_id` (research pitfall #1).
- **Express + TypeScript con rutas en `apps/backend/src/routes/`**: agregar `restaurants.ts`, `menu-categories.ts`, `menu-items.ts`, `phone.ts`. Patrón de tests: `apps/backend/src/__tests__/<route>.test.ts`.
- **Frontend pages en `apps/frontend/src/pages/`**: Onboarding.tsx (con sub-componentes en `components/onboarding/`), Dashboard.tsx (ya existe stub), MenuEditor.tsx, Settings.tsx (nueva).

### Integration Points
- **Phase 03 (Voice MVP)** consume: `restaurants.twilio_number` para asignar al Vapi assistant; `restaurants.agent_name` para el system prompt; `menu_items` + `option_groups` + `option_items` para construir el menú del assistant; `restaurant_hours` para el chequeo de out-of-hours.
- **Phase 05 (Billing)** consume: `restaurants` existe y tiene un usuario asignado; el flujo de signup → onboarding → primera carga MP se completará ahí.

</code_context>

<specifics>
## Specific Ideas

- **Mantener velocidad sobre perfección** (carry-forward de Phase 01). MVP-first: forwarding-only, sin AR direct, sin worker queues, sin soft delete.
- **El usuario es estudiante de ing. industrial, no programador**: comentarios en código donde el WHY no sea obvio (especialmente en la migration 0002 y en el flujo de retry de Twilio). Mensajes de error al usuario en español rioplatense, no en inglés genérico.
- **Wonder piloto**: el seed real va via script aparte (`seed-wonder.ts`), NO via el botón "Cargar template". El template es genérico para el siguiente cliente.
- **Twilio US número**: documentar en el código (comment) que esto es decisión consciente del MVP — no es un bug que el número sea US y no AR.
- **Slug uniqueness**: usar `slugify` + check de DB UNIQUE constraint (Phase 1 schema lo tiene). Si colisiona, mostrar error en el wizard "Ese nombre ya está tomado, probá otro" y dejar al usuario reintenta.

</specifics>

<deferred>
## Deferred Ideas

- **Twilio AR direct programmatic (bundle ENACOM)** — diferido a post-MVP. Reevaluar cuando haya ≥3 clientes pagos o cuando el research confirme que el bundle es auto-servible. Por ahora forwarding cubre el caso.
- **Soft delete de items/categorías** — diferido. Si se borra una categoría, CASCADE delete a items. Reevaluar si surge pedido del piloto.
- **Bulk import de menú via CSV** — `BULK-01` en v2. No se cubre acá.
- **Geocoding de delivery zones** — `DISP-01` en v2. v1 las guarda como texto libre.
- **Worker queue para retries de Twilio** — diferido. v1 hace retry sincrónico en el botón; si después surge necesidad real (ej: muchos fallos transitorios de Twilio), se reevalúa.
- **Edición masiva del menú / drag-and-drop de items entre categorías** — diferido. v1 permite editar uno por uno.
- **Versionado de menú / historial de cambios de precios** — `BULK-02` en v2.
- **Auto-detección del operador de telefonía AR (Movistar/Claro/Personal)** — diferido. v1 muestra los 3 códigos USSD y el dueño elige.
- **Página dedicada "modo cocina" para toggles masivos de disponibilidad** — diferido. v1 usa el Switch en cada item del MenuEditor; si el feedback del piloto lo pide, se agrega después.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-onboarding-menu*
*Context gathered: 2026-05-11*
