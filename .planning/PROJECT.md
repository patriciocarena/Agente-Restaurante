# Agente Restaurante (placeholder, nombre marketing TBD)

## What This Is

SaaS multi-tenant que automatiza el teléfono de la **hamburguesería**: cuando un cliente llama, una agente de voz en español rioplatense atiende, toma el pedido completo (con modificadores, cantidades, retiro o delivery con dirección), lo confirma en voz alta y **se lo notifica a la cocina por WhatsApp con el detalle del pedido** (pivot 2026-06-11: reemplaza al Kitchen Display System, movido a backlog v2). Vertical focalizado en **hamburgueserías argentinas** (segmento creciente, menú estructurado con combos y modificadores predecibles, mix retiro+delivery), donde el teléfono se satura en hora pico y se pierden pedidos.

## Core Value

**Cuando suena el teléfono del restaurante, el pedido llega a la cocina sin que nadie atienda.** Si esto no funciona en condiciones reales (ruido de cocina, cliente apurado, pedido con 6 items con modificaciones), nada más importa.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] El restaurante puede registrarse, loguearse y ver su dashboard aislado de otros (auth + RLS multi-tenant real)
- [ ] El restaurante puede armar y editar su menú: categorías, items, **grupos de opciones con cardinalidad (min/max selecciones por grupo)**, items con **precio variable según opción**, modificadores con `price_delta`, disponibilidad on/off mid-shift
- [ ] El restaurante configura horario de atención por día de la semana
- [ ] El restaurante configura zonas/áreas de delivery que cubre (texto libre o lista de barrios)
- [ ] Cada restaurante tiene su propio número Twilio AR asignado en onboarding
- [ ] La agente de voz responde en español argentino, toma pedidos con modificadores y los confirma
- [ ] La agente captura tipo de pedido (retiro o delivery) y, si es delivery, dirección + referencia
- [ ] La agente NO acepta items que no estén en el menú ni inventa precios (guardrails)
- [ ] Fuera de horario, la agente avisa que está cerrado y cuelga (no toma pedido)
- [ ] El backend recibe el call de Vapi vía webhook con HMAC validado e idempotencia por `call_id`
- [ ] El backend recalcula `unit_price` y `total` server-side desde `menu_items` (NO confía en la LLM)
- [ ] La cocina recibe cada pedido por WhatsApp en <30 segundos de confirmado, con número, cliente, retiro/delivery (+dirección), items con modificadores y total (pivot 2026-06-11, ex-KDS)
- [ ] Cobro mensual por Mercado Pago Subscriptions con suspensión automática por impago
- [ ] Cada llamada queda observable: duración, costo, transcripción, errores

### Out of Scope (v1)

- **Kitchen Display System (dashboard realtime)** — Pivot 2026-06-11: el WhatsApp a la cocina (Twilio Sandbox, sin esperar templates Meta) reemplaza al KDS en el MVP. El dashboard de pedidos con estados (NUEVO → ENTREGADO) pasa a backlog v2.
- **Despacho/asignación de cadetes integrado** — v1 captura dirección pero el restaurante usa SU sistema actual de cadetería (cadetes propios o Rappi/PedidosYa) para despachar. No tracking de cadetes en la app.
- **Integración con PedidosYa / Rappi / Cabify** — fuera de scope para producto inicial. El restaurante usa SUS canales existentes.
- **Validación automática de dirección (geocoding)** — la dirección se guarda como texto libre. Validar contra zonas de cobertura o calcular distancia/tarifa de delivery va a v2.
- **Reconocimiento de cliente recurrente / "lo de siempre"** — v1 solo guarda `customer_phone` para reportes. Personalización en v2.
- **Voice cloning de voz cordobesa** — Azure es-AR (porteña) en v1. Voice cloning con ElevenLabs Creator queda para cuando consigamos grabación + permiso de un hablante cordobés.
- **Multi-idioma** — solo español argentino en v1.
- **Otros países LATAM** — solo Argentina v1. México, Chile, Uruguay quedan para post-validación.
- **Bulk price update / versionado de menú** — el restaurante edita item por item en v1. Bulk para v2 cuando la inflación lo justifique.
- **Stripe para tarjeta internacional** — solo Mercado Pago en v1 (mercado AR).
- **App mobile nativa** — el dashboard es web responsive, alcanza para tablet en cocina.

## Context

- **Mercado**: Argentina, **hamburgueserías exclusivamente**. Operadores con 1-3 locales, 20-60 pedidos telefónicos/día en hora pico (típicamente noche, viernes/sábado). Hoy contratan personas para atender el teléfono o pierden pedidos cuando la cocina está saturada.
- **Modelo de negocio**: SaaS suscripción mensual. Target pricing: $99-149 USD/mes flat con tope de uso (50-100 calls/día) o híbrido $99 + $1.50/llamada extra. Pricing definitivo se cierra después de research de competencia en Phase 0.
- **Spec original del usuario**: vino con stack y schema bien especificados (Vapi + Gemini + ElevenLabs + Supabase + Twilio + React). Se identificaron 10 bugs/desviaciones críticas que se corrigen en código (ver Key Decisions abajo).
- **Piloto identificado**: **Wonder Hamburguesería** — Av. Sáenz Peña 112, Villa Allende, Córdoba (X5105). Tel: +54 9 3543 20-8989. Horario real (extraído de su tienda Pedix): Lun-Mar y Dom 20:00–24:00, Mié-Sáb 20:00–00:30 (solo noche). Menú completo extraído: 74 productos en 10 categorías (Hamburguesas, Lomitos, Papas, Snacks, Ensaladas, Wraps, Bebidas, Postres Süss, Kit Wonder, Promociones), precios de $1.900 a $35.999 ARS. Detalle en `.planning/research/wonder-menu.md`. Raw JSON en `wonder-pedix-raw.json`. Seed listo para Phase 2.
- **Competencia**: Sin info todavía. Research phase va a investigar tanto referentes US (Slang.ai, ConverseNow, Kea, Newo) como posibles competidores LATAM/AR — hay que ver si alguien local ya está atacando este vertical y cómo.

## Constraints

- **Tech stack v1 (Tier 1)**: Vapi.ai (voice orchestration) + Gemini 2.5 Flash (LLM) + Azure Neural TTS `es-AR-ElenaNeural` (NO ElevenLabs en v1) + Deepgram nova-2 (STT) + Twilio AR (telefonía) + Supabase con RLS (DB + auth + realtime) + Mercado Pago Subscriptions (billing) + Node.js + Express + TypeScript (backend) + React + Vite + Tailwind (frontend) + Railway (backend deploy) + Vercel (frontend deploy).
- **Costo objetivo por llamada**: ≤$0.25 USD por llamada de 2 minutos. A 30 calls/día/restaurante = ≤$210/mes infra. Pricing del SaaS debe sostener este costo + margen.
- **Plan de migración de costos** (definido en plan inicial): Tier 1 (Vapi) en v1, migrar a Tier 2 (Pipecat self-hosted + Telnyx) cuando haya ≥3 clientes pagos o costos infra >$500/mes. Tier 3 (Gemini Native Audio speech-to-speech) cuando salga GA con voz AR estable.
- **Latencia objetivo**: turn-around (cliente termina de hablar → agente empieza a responder) <800ms. Es NFR (non-functional requirement) verificable en Phase 6.
- **Timeline**: MVP demoable en **2 semanas** (Phases 1-4). Billing real + hardening (Phases 5-6) post-demo. Cost optimization (Phase 7) cuando haya tracción.
- **Multi-tenancy estricto**: RLS de Supabase obligatorio, ningún restaurante puede ver datos de otro nunca. Webhook routea por `assistantId` de Vapi → `restaurant_id`.
- **Seguridad de webhook**: HMAC signature de Vapi validada en cada request. Idempotencia por `call_id` UNIQUE.
- **Regulación AR**: ENACOM regula números fijos AR. Alternativas a investigar: Twilio AR directo (si permite), Telnyx (backbone propio LATAM), o forwarding desde celular del restaurante a número Twilio US (más simple para MVP, decisión en research).
- **Privacidad**: Customer phone numbers son PII bajo Ley 25.326 (AR) + GDPR-equivalent. Storage justificado por finalidad operacional, retention policy a definir.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ICP v1 = solo hamburgueserías (revisado) | Tras varias iteraciones (pizzerías → rotiserías → +hamburgueserías → solo hamburgueserías), el usuario decidió focalizar exclusivamente en hamburgueserías. Ventajas: posicionamiento nítido, system prompt afinado a un menú típico (combos, papas, modificadores estándar), marketing más directo. Riesgo: TAM más chico — validar tamaño del mercado AR de hamburgueserías en Phase 1 research. | — Pending |
| WhatsApp diferido al MVP | Templates Meta tardan 1-3 semanas en aprobarse, bloquearía el ship. KDS cubre la necesidad inmediata. | — Pending |
| Delivery SÍ va en v1 (revisado) | Decisión inicial fue solo pickup, pero el piloto Wonder es delivery-heavy. v1 captura dirección + zona como texto, sin tracking de cadetes. El restaurante despacha con su sistema actual. | — Pending |
| Auth + Billing real desde v1 | El usuario quiere SaaS real, no pilot manual. Onboarding y MP Subscriptions van en Phase 1 y 5. | — Pending |
| Mercado Pago en vez de Stripe | Mercado AR — clientes con tarjeta local no andan bien en Stripe. MP es estándar. | — Pending |
| Azure es-AR en vez de ElevenLabs | ElevenLabs $0.10-0.18/min mata unit economics. Azure neural `es-AR-ElenaNeural` es 85% más barata con voz argentina nativa (porteña, no cordobesa). Voice cloning queda para v2. | — Pending |
| Backend recalcula totales (no la LLM) | LLMs son malísimas en aritmética e inventan precios. Server-side total contra `menu_items` evita pedidos con totales mal a la cocina. | — Pending |
| `restaurant_counters` en vez de `serial` para `order_number` | El `serial` original era global, no per-tenant. La spec original tenía el comentario contradictorio. | — Pending |
| HMAC validation + idempotency por `call_id` | Sin esto, cualquiera inyecta pedidos falsos al webhook y los retries de Vapi crean pedidos duplicados. | — Pending |
| Un número Twilio AR por restaurante | Routing limpio (1 número → 1 assistant → 1 restaurant). El restaurante desvía su línea fija al Twilio. ~$3-5/mes/cliente. | — Pending |
| Out-of-hours = mensaje + cortar | Configurable por restaurante. La agente NO toma pedido fuera de horario. | — Pending |
| Tier-based cost optimization (Phase 7 explícita) | A $99/mes flat el Tier 1 deja margen negativo. Migración a Pipecat + Telnyx (Tier 2) es fase real con trigger objetivo (≥3 clientes pagos), no deuda técnica vaga. | — Pending |
| Spec original voiceId "Fernanda" → corregido a `es-AR-ElenaNeural` | ElevenLabs no acepta nombres como voiceId, solo IDs alfanuméricos. Era bug que hubiera fallado en runtime. | — Pending |
| Spec original `gemini-2.0-flash` → corregido a `gemini-2.5-flash` | Inconsistencia en el spec (header decía 2.5, config decía 2.0). 2.5 es mejor en español y mismo costo. | — Pending |
| Schema de menú: option groups con cardinalidad + precio variable por opción (descubierto al parsear menú real de Wonder) | El spec original asumía `modifiers: [{name, price_delta}]` plano. Los menús reales tienen items sin precio base (la opción define el precio: ej. "Hamburguesa Veggie - elegí Mixta o Garbanzos") y grupos con min/max ("elegí 1 bebida", "elegí hasta 8 toppings"). Phase 1 schema y Phase 3 `confirm_order` deben modelarlo. | — Pending |
| Horario real de Wonder: 20:00–24:00/24:30 (no 19-23h como inicialmente reportado) | Datos extraídos directamente de Pedix. Útil para system prompt + restaurant_hours seed en Phase 2. | — Pending |
| **Pivot 2026-06-11: Fase 4 KDS → notificaciones WhatsApp** (revierte "WhatsApp diferido al MVP") | Construir el dashboard realtime se va del alcance del MVP. Más user-friendly: cuando el pedido se persiste en `orders`, el restaurante recibe un WhatsApp con el detalle (Twilio Sandbox en MVP, sin aprobación de templates Meta — el sandbox evita el bloqueo de 1-3 semanas que motivó el diferimiento original). El frontend (onboarding + menú) se mantiene como herramienta de configuración. KDS pasa a backlog v2. | Implemented |
| Assistant de Vapi del piloto = "Alex" preexistente del usuario (no se creó uno nuevo) | El usuario ya tenía el assistant creado en su cuenta; se reconfiguró por completo vía API (voz es-AR-ElenaNeural, gemini-2.5-flash, prompt de wonder, webhook Railway). `agent_name` de wonder pasó de "Sofía" a "Alex". | Implemented |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-11 after Phase 4 pivot (KDS → WhatsApp)*
