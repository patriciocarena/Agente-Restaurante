---
phase: 03-voice-mvp-tier-1
plan: 05
status: complete
completed: 2026-06-11
requirements: [VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, VOICE-06, VOICE-07, VOICE-08, VOICE-09, VOICE-10, VOICE-11, VOICE-12, VOICE-13, CALL-09, OBS-01]
---

# 03-05 SUMMARY — Guided web-call UAT

## Task 1: Pre-flight (complete)

- Backend health 200 en Railway (deploy `d3f90258`, Node 24 — requirió fixes: tipos SDK Vapi 1.2.0 en `817bb6d`, engines node>=22 en `e242972`)
- Migración 0003 aplicada a Supabase vía MCP (autorización del usuario): `call_logs`, índice, RPC verificados
- Horarios wonder abiertos 7 días (seed D-02)
- Assistant: el usuario eligió usar su assistant existente **"Alex"** (`69877045-e578-43b1-aa8f-124f643f0e6c`) en lugar de crear uno nuevo. Reconfigurado por completo vía script one-off (voz `es-AR-ElenaNeural`, `gemini-2.5-flash`, prompt de wonder, tool `confirm_order`, server URL Railway + secret en headers). `restaurants.agent_name` actualizado de "Sofía" a "Alex"; `vapi_assistant_id` persistido.
- `BACKEND_URL` agregada a `.env` local y Railway (faltaba; el server block del assistant la necesita)

## Task 2: Scripted scenarios — resultados

| Escenario | Resultado | Evidencia |
|-----------|-----------|-----------|
| 1 — Pedido simple (retiro) | ✅ PASS | Order #1: clásica ×1, $9.500 server-side, `customer_phone` NULL aceptado (D-01), transcript escrito (CALL-09) |
| 2 — Cantidad + modificador + delivery | ✅ PASS | Order #2: doble queso ×2 "sin cebolla", $24.000 = 2×12.000 recalculado server-side, dirección persistida (VOICE-07) |
| 3 — Fuera de menú (pizza) | ✅ PASS | Rechazó la pizza, ofreció alternativas, convirtió en Order #3 (veggie ×2, $18.000) |
| 4 — Inyección de prompt | ✅ PASS | Se negó a 100 hamburguesas gratis; 0 pedidos creados (T-03-15 cerrado) |
| 5 — Fuera de horario | ✅ PASS (server) / ⚠️ voz sin re-verificar | Con 7 días cerrados: 0 pedidos creados (CALL-07 server-side funciona). BUG encontrado: el LLM ignoraba el resultado de `confirm_order` y decía "ya pasó tu pedido a cocina" — corregido en `1865ba9` (paso 7 del FLUJO ahora lee el resultado y exige número de pedido). El usuario decidió no seguir probando; la confirmación por voz del fix queda sin verificar. |
| OBS-01 | ✅ PASS | 1 fila en `call_logs` por llamada (8+ llamadas), con costo y transcript |

## Fixes durante el UAT (commits)

- `ef55535` — precios en el prompt como "9500 pesos" (TTS leía `$` como dólares)
- `a5a524c` — `duration_seconds` desde el nivel `message` del payload; prompt: distinguir "no te escucho" de "no puedo hacer eso", tope de cantidad >10, manejo de cliente-que-no-escucha, sin abreviaturas
- `1865ba9` — el agente DEBE leer el resultado de `confirm_order` antes de responder (nunca afirmar éxito sin número de pedido)

## Gaps conocidos (no bloqueantes, para iteración futura)

1. **Horarios no inyectados en el prompt** — Alex no puede responder "¿están abiertos?" (el enforcement server-side sí funciona)
2. **Pronunciación** — "Wanderers" por "Wonder", "Beckie" por "Veggie"; mitigable con guías fonéticas en el prompt
3. **Abreviaturas TTS** — "un 2º" pese a la instrucción (Gemini la ignora a veces)
4. **Escenario 5 voz** — fix aplicado y resincronizado pero sin llamada de re-verificación del usuario
5. `started_at`/`ended_at` de `call_logs` quedan null si Vapi no manda timestamps a nivel call (la duración ya se toma de `message.durationSeconds`, deploy posterior al UAT)

## Decisión de producto post-UAT

El usuario decidió el **pivot de Fase 4**: no se construye KDS; los pedidos se notifican por WhatsApp al restaurante (ver ROADMAP actualizado).
