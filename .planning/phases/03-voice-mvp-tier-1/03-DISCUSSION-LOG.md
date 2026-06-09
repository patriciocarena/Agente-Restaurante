# Phase 3: Voice MVP (Tier 1) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 03-voice-mvp-tier-1
**Areas discussed:** Estrategia de prueba

---

## Selección de áreas

| Área ofrecida | Seleccionada |
|---------------|--------------|
| Personalidad de la agente | (delegada a Claude) |
| Casos difíciles | (delegada a Claude) |
| Cierre del pedido | (delegada a Claude) |
| Estrategia de prueba | ✓ |

---

## Estrategia de prueba

### ¿Cómo hacemos las llamadas de prueba?

| Option | Description | Selected |
|--------|-------------|----------|
| Web call primero (Recomendado) | Desde el navegador, gratis e instantáneo; número real después | ✓ |
| Número US desde el día 1 | Vapi da número US gratis, pero llamarlo desde AR cuesta tarifa internacional | |
| Ambos desde el arranque | Web call para iterar + número US para validar | |

**User's choice:** Web call primero

### ¿Qué horario le ponemos a "wonder" mientras desarrollamos?

| Option | Description | Selected |
|--------|-------------|----------|
| Abierto todo el día (Recomendado) | Lun-Dom 00:00-23:59 durante desarrollo; caso "cerrado" se prueba puntualmente | ✓ |
| Horario real de rotisería | 19:00-23:30 — realista pero solo testeable de noche | |

**User's choice:** Abierto todo el día

### ¿Contra qué backend prueban las llamadas?

| Option | Description | Selected |
|--------|-------------|----------|
| Railway desplegado (Recomendado) | Backend ya público, mismo entorno real, redeploy automático | ✓ |
| Local con túnel (ngrok) | Iteración rápida pero requiere mantener túnel | |

**User's choice:** Railway desplegado

---

## Claude's Discretion

- Personalidad de la agente — cálida/eficiente, voseo rioplatense, respuestas cortas
- Casos difíciles — rechazo amable + alternativa; sin transferencia humana en v1
- Cierre del pedido — repetir con precios y total; sin tiempo estimado en v1

## Deferred Ideas

- Método de pago del pedido (v2)
- Conexión número US real + forwarding (post web-call UAT)
