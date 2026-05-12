# Phase 02: Onboarding & Menu - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 02-onboarding-menu
**Areas discussed:** Wizard UX, Twilio AR strategy, MenuEditor UX, Edge cases & empty states

---

## Wizard UX (estructura y flujo)

### Q1: ¿Cómo organizamos los pasos del wizard?

| Option | Description | Selected |
|--------|-------------|----------|
| 4 pasos: Datos → Horario → Delivery → Voice | Recomendado del RESEARCH.md, cada paso <1 min de fricción | ✓ |
| 3 pasos compactos | Datos+horario / delivery+voice / confirm+Twilio | |
| 5 pasos (incluye Twilio explícito) | Igual que 4 pasos pero agrega paso final de confirmación de número | |

**User's choice:** 4 pasos.
**Notes:** Twilio se asigna en background al apretar "Terminar" del paso 4, no como paso explícito.

### Q2: Si el dueño abandona el wizard a la mitad, ¿qué pasa al volver?

| Option | Description | Selected |
|--------|-------------|----------|
| Resume automático desde el último paso | Autosave per-step en `restaurants.onboarding_step` | ✓ |
| Empezar de cero cada vez | Solo en memoria | |
| Guardar al pasar de paso, permitir reset | Resume + botón "Empezar de nuevo" | |

**User's choice:** Resume automático.

### Q3: ¿Dónde se editan los settings post-wizard?

| Option | Description | Selected |
|--------|-------------|----------|
| Página /settings unificada | Tabs/secciones con todos los settings | ✓ |
| Pages dedicadas (/hours, /delivery, /voice) | Cada categoría en su propia ruta | |
| Diferir a Phase 6/post-MVP | Sin UI de edición en v1 | |

**User's choice:** Página /settings unificada.

### Q4: ¿El wizard valida cada paso o todo al final?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-step con react-hook-form trigger() | Zod schema por paso | ✓ |
| Solo al final | Todos los campos validados al apretar "Terminar" | |

**User's choice:** Per-step con trigger().

---

## Twilio AR strategy (número vs forwarding)

### Q1: ¿Qué modo de Twilio priorizamos al MVP?

| Option | Description | Selected |
|--------|-------------|----------|
| Forwarding-only en MVP | Twilio US, sin bundle ENACOM | ✓ |
| Direct AR si está configurado, fallback a forwarding | Dual-mode del research | |
| Forwarding-only y diferir AR direct a Phase 6+ | Sin retry de AR programmatic en v1 | |

**User's choice:** Forwarding-only.
**Notes:** Wonder no necesita un número AR — los clientes seguirán llamando al teléfono de Wonder.

### Q2: ¿Quién provee el número Twilio US?

| Option | Description | Selected |
|--------|-------------|----------|
| Backend lo aprovisiona automático en onboarding | Twilio API call al cerrar wizard | ✓ |
| Pool pre-comprado de números | Manteniendo 10-20 pre-comprados | |
| El dueño compra su propio número | Más complejidad para el dueño | |

**User's choice:** Backend aprovisiona automático.

### Q3: Si la API de Twilio falla mid-wizard, ¿qué hace el sistema?

| Option | Description | Selected |
|--------|-------------|----------|
| Bloquea el wizard hasta resolver | Pantalla de error con botón "Reintentar" | ✓ |
| Completa onboarding sin número, asigna después | Estado pending_phone_assignment | |
| Mostrar instrucciones manuales de fallback | CTA a soporte humano | |

**User's choice:** Bloquea el wizard, retry manual (max 3 intentos).

### Q4: ¿Cuándo se le explica al dueño cómo configurar el desvío?

| Option | Description | Selected |
|--------|-------------|----------|
| Tutorial post-wizard con video + comandos USSD | Pantalla dedicada con todo | |
| Solo mostrar el número en el dashboard | Mínimo guidance | |
| Documentación externa (link a Notion/blog) | URL configurable, doc fuera del repo | ✓ |

**User's choice:** Documentación externa.
**Notes:** URL via env var `FORWARDING_DOCS_URL`. Doc tiene secciones por operador (Movistar/Claro/Personal).

---

## MenuEditor UX (categorías, items, option groups)

### Q1: ¿Cómo se ve el MenuEditor?

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar de categorías + lista de items | 2-columnas, drag-to-reorder en sidebar | ✓ |
| Acordeón vertical (todo en una columna) | Scroll-heavy, mejor mobile | |
| Tabla única filtrable | Estilo Excel | |

**User's choice:** Sidebar + lista.

### Q2: ¿Cómo se editan los option_groups (cardinalidad min/max)?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal por item con sección "Opciones" expandible | Tooltip explica min/max con ejemplos | ✓ |
| Página dedicada por item (/menu/items/[id]) | Navegación extra | |
| Simplificar: modificadores planos en v1 | Contradice el schema enriquecido de Phase 1 | |

**User's choice:** Modal por item.

### Q3: ¿Dónde queda el toggle "disponible / no disponible"?

| Option | Description | Selected |
|--------|-------------|----------|
| Switch visible en cada item de la lista | 1 clic, <2s con Realtime | ✓ |
| Solo dentro del modal de edición | Más clicks, NO sirve para mid-shift | |
| Vista "modo cocina" dedicada | Más complejidad, posible v2 | |

**User's choice:** Switch en cada item.

### Q4: ¿Cómo arranca el menú de un restaurante nuevo?

| Option | Description | Selected |
|--------|-------------|----------|
| Menú vacío + botón "Cargar template hamburguesera" | Template genérico, Wonder via seed aparte | ✓ |
| Menú vacío, manual desde cero | Más frío | |
| Wizard incluye paso "Importar menú" | Más scope, contradice los 4 pasos | |

**User's choice:** Template hamburguesera opcional.

---

## Edge cases & empty states

### Q1: Cuando el dueño entra al MenuEditor vacío, ¿qué ve?

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state con CTA al template + CTA a crear manual | 2 botones, educativo | ✓ |
| Solo botón "+ Nueva categoría" | Mínimo guidance | |
| Auto-cargar template al primer ingreso | Le impone una estructura | |

**User's choice:** Empty state con 2 CTAs.

### Q2: ¿Item sin categoría seleccionada (caso menu_categories vacío)?

| Option | Description | Selected |
|--------|-------------|----------|
| Forzar crear categoría primero | Botón "+ Nuevo item" disabled si no hay categoría | ✓ |
| Auto-crear categoría "Sin clasificar" | Ensucia data | |
| Permitir items sueltos con category_id null | Cambia schema, contradice Phase 1 | |

**User's choice:** Forzar crear categoría primero.

### Q3: ¿Borrar categoría con items?

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm modal: "Esto borra X items, ¿seguir?" | CASCADE delete con confirmación | ✓ |
| Bloquear si tiene items | Forzar mover/borrar items primero | |
| Soft delete + restore | Más complejidad | |

**User's choice:** Confirm modal con CASCADE.

### Q4: ¿Twilio retry mid-wizard?

| Option | Description | Selected |
|--------|-------------|----------|
| Botón "Reintentar" en pantalla de error | Max 3 intentos, luego escala a soporte | ✓ |
| Reintento automático en background | Worker queue, excesivo para v1 | |
| Sin retry, escalar a soporte humano | Máxima carga operativa | |

**User's choice:** Botón "Reintentar" (max 3).

---

## Claude's Discretion

Áreas donde el planner decide:
- Componentes shadcn específicos a instalar.
- Endpoints REST exactos y sus contratos.
- Estructura de directorios dentro de `components/onboarding/` y `components/menu/`.
- Detalles del seed JSON `hamburgueseria-template.json`.
- Estrategia exacta del JWT refresh post-onboarding.
- Zod schemas detallados (los campos están en CONTEXT.md, pero los schemas los redacta el planner).

## Deferred Ideas

- Twilio AR direct programmatic (bundle ENACOM) → post-MVP.
- Soft delete de items/categorías → reevaluar si surge pedido del piloto.
- Bulk import de menú via CSV → v2 (BULK-01).
- Geocoding de delivery zones → v2 (DISP-01).
- Worker queue para retries de Twilio → reevaluar con datos del piloto.
- Edición masiva / drag-and-drop entre categorías → reevaluar.
- Versionado de menú / historial de precios → v2 (BULK-02).
- Auto-detección del operador AR → diferido.
- Vista dedicada "modo cocina" para toggles masivos → diferido.
