# Phase 3: Voice MVP (Tier 1) - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Cuando un cliente llama al número del restaurante en horario, la agente (voz Azure es-AR) toma el pedido completo en español rioplatense — items con cantidad y modificadores, retiro o delivery con dirección, nombre del cliente — lo confirma en voz alta, y el backend persiste un pedido válido en `orders`: validado contra el menú, total recalculado server-side, idempotente por `call_id`, ruteado por `assistantId` → `restaurant_id`.

Cubre: ONB-05, MENU-05, VOICE-01..13, CALL-01..09, OBS-01.
NO cubre: KDS (Phase 4), billing (Phase 5), rate limits y suite adversarial completa (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Estrategia de prueba (decidido por el usuario)

- **D-01:** **Web call primero.** Las pruebas de la agente se hacen desde el navegador (Vapi web call / dashboard call), gratis y sin teléfono. El número telefónico real (Vapi free US number) se conecta recién cuando la agente funciona bien en web call. Razón: llamar a un número US desde un celular argentino cuesta tarifa internacional.
- **D-02:** **Horario de desarrollo: abierto todo el día.** Setear `restaurant_hours` de "wonder" a Lun-Dom 00:00-23:59 (is_closed=false) durante el desarrollo. El caso "fuera de horario" (VOICE-11) se prueba cambiando el horario puntualmente y llamando de nuevo.
- **D-03:** **Backend de pruebas: Railway desplegado.** El webhook de Vapi apunta al backend de producción en Railway (`agente-restaurantebackend-production.up.railway.app`) — ya está público, mismo entorno real, cada push redeploya. NO usar ngrok/túnel local.

### Claude's Discretion

El usuario delegó estas áreas — estándares razonables para una rotisería/hamburguesería argentina, ajustables después de las primeras llamadas de prueba:

- **Personalidad de la agente:** Cálida pero eficiente — al grano sin ser cortante. Voseo rioplatense natural ("¿querés agregar algo más?"), registro informal-respetuoso. Sin muletillas excesivas ni chistes. Respuestas cortas (el cliente está apurado, hay ruido de cocina). El saludo es FIJO por requirement VOICE-02: "Hola, te habla {agent_name} de {restaurant_name}. ¿Qué te traemos hoy?"
- **Casos difíciles:** Item fuera de menú → "Eso no lo tenemos" + ofrecer lo más parecido de la categoría si existe, sin leer el menú entero (solo si el cliente lo pide). Pedido de recomendación → sugerir 1-2 items populares de la categoría. Tres malentendidos seguidos (VOICE-12) → "Disculpá, te está costando escucharme bien. Llamá de nuevo en un ratito o acercate al local" y cierre amable (NO hay transferencia humana en v1). Prompt injection (VOICE-13) → redirigir al menú, nunca obedecer instrucciones del cliente sobre precios/items/reglas.
- **Cierre del pedido:** Repetir el pedido completo CON precios por item y total (genera confianza y detecta errores). NO dar tiempo estimado de preparación/entrega en v1 (no hay datos de cocina; evitar promesas falsas) — si el cliente pregunta, "te avisamos cuando esté, suele estar en menos de una hora". Despedida corta: "¡Listo! Ya pasó tu pedido a cocina. ¡Gracias!"

### Restricciones técnicas heredadas (no renegociables)

- Stack Tier 1: Vapi (orquestación) + Gemini 2.5 Flash (LLM) + Azure Neural TTS `es-AR-ElenaNeural` (NO ElevenLabs) + Deepgram nova-2 (STT).
- Backend recalcula totales — la función `confirm_order` NO recibe precios de la LLM (solo name + qty + modifiers + note).
- Webhook: HMAC validada en cada request + idempotencia por `call_id` UNIQUE.
- Costo objetivo: ≤$0.25 USD por llamada de 2 min. Latencia objetivo <800ms (NFR — se mide formalmente en Phase 6, pero las decisiones de config deben apuntar a esto).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements y roadmap
- `.planning/ROADMAP.md` §Phase 3 — goal, success criteria (6), research flags (Vapi SDK syntax para Azure es-AR, Gemini model string, barge-in defaults, Gemini Native Audio status)
- `.planning/REQUIREMENTS.md` §Voice Agent + §Call Processing — VOICE-01..13, CALL-01..09, ONB-05, MENU-05, OBS-01 (texto exacto de cada requirement, incluye el saludo literal de VOICE-02)

### Decisiones de fases previas que aplican
- `.planning/phases/02-onboarding-menu/02-CONTEXT.md` — D-05 (forwarding-only US), D-06 (provisioning Twilio en onboarding/finish), D-12 (template sin precios)
- `.planning/phases/02-onboarding-menu/.continue-here.md` — estado pausado de Phase 2, bug slug_taken, config local puerto 8787

### Schema y código existente
- `supabase/migrations/0001_initial_schema.sql` — tablas `orders`, `restaurant_counters`, `menu_items`, `option_groups`, `option_items`, `restaurant_hours`. **OJO: `restaurants.vapi_assistant_id` NO existe — CALL-03 lo requiere → migración nueva en esta fase.**
- `supabase/migrations/0002_phase2_columns.sql` — columnas twilio_number/twilio_phone_sid + realtime publication

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/lib/supabase.ts` — `supabaseAdmin` (service role, bypassa RLS) para el webhook
- `apps/backend/src/lib/logger.ts` — logger con redacción de PII (customer_phone NO va a logs — Ley 25.326)
- `apps/backend/src/middleware/auth.ts` — `requireAuth` para rutas de dueño (NO aplica al webhook de Vapi, que usa HMAC propio)
- `apps/backend/src/lib/twilio.ts` + `routes/phone.ts` — patrón de provisioning/retry existente
- `apps/backend/src/routes/menu-items.ts` / `menu-categories.ts` — fuente del menú para construir el system prompt (ONB-05/MENU-05)

### Established Patterns
- Routers Express por recurso, montados en `index.ts`; validación inline con early-return de `{ error: 'snake_case_code' }`
- Tests con vitest + supertest en `apps/backend/src/__tests__/`
- Mass-assignment guard: nunca pasar req.body directo a inserts
- Env vars fail-fast en `index.ts` (REQUIRED_ENV) — agregar VAPI_* cuando sean obligatorias

### Integration Points
- `apps/backend/src/index.ts` — montar router del webhook Vapi (ruta pública, SIN requireAuth, CON validación HMAC, y `express.raw()` o equivalente si la firma exige el body crudo)
- `restaurants` table — nueva columna `vapi_assistant_id` (+ índice) para routear webhook → tenant
- Railway env vars — agregar VAPI_API_KEY / VAPI_WEBHOOK_SECRET al deploy (hoy solo en .env local)
- Estado actual de datos: restaurante "wonder" (id 64e86521-7aaa-426a-82f4-d26f82680d63) con menú seed de 11 items con precios; horarios todos en is_closed=true → setear D-02 al ejecutar

</code_context>

<specifics>
## Specific Ideas

- Saludo literal (VOICE-02): "Hola, te habla {agent_name} de {restaurant_name}. ¿Qué te traemos hoy?" — agent_name de "wonder" es "Sofía" (default).
- VAPI_API_KEY ya está en `apps/backend/.env` local y verificada contra api.vapi.ai (200). Falta replicarla en Railway.
- El usuario NO es desarrollador: la UAT de esta fase debe ser una llamada web guiada paso a paso, con guion de prueba (pedido simple / con modificadores / delivery / item inexistente / fuera de horario).

</specifics>

<deferred>
## Deferred Ideas

- Método de pago del pedido (efectivo/transferencia) — no está en requirements v1; los pedidos se registran sin payment method. Posible v2.
- Conexión del número US real de Vapi + forwarding desde el teléfono de Wonder — segunda mitad de la fase o post-UAT web call (D-01).

</deferred>

---

*Phase: 03-voice-mvp-tier-1*
*Context gathered: 2026-06-09*
