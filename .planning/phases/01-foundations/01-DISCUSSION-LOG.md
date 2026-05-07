# Phase 1: Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 01-foundations
**Areas discussed:** Estructura del monorepo, Schema del menú, RLS + JWT, Encriptación de teléfonos

---

## Estructura del monorepo

| Option | Description | Selected |
|--------|-------------|----------|
| Un solo repo (recomendado) | /backend, /frontend, /shared. Más simple para mantener solo. | ✓ |
| Dos repos separados | Backend y frontend en repos distintos. Más coordinación. | |

**User's choice:** Un solo repo (recomendado)
**Notes:** Ninguna observación adicional.

---

## Schema del menú (option groups)

| Option | Description | Selected |
|--------|-------------|----------|
| Schema enriquecido ahora | option_groups con min/max + option_items con precio propio. | ✓ (cambio de decisión) |
| Simple ahora, migrar en Phase 2 | Solo modifiers planos. Más rápido en Phase 1 pero crea trabajo extra en Phase 2. | (inicialmente elegido, luego revertido) |

**User's choice:** Schema enriquecido ahora (decisión final)
**Notes:** El usuario inicialmente eligió simplificar ("no me interesan tanto esos detalles ahora, estoy más concentrado en hacer que funcione el sistema"), pero al presentar el resumen se arrepintió y optó por el schema correcto. Motivación final: Wonder Hamburguesería (piloto) necesita este schema desde el día 1.

---

## RLS + JWT (aislamiento multi-tenant)

| Option | Description | Selected |
|--------|-------------|----------|
| Token automático con restaurant_id | app_metadata → JWT → RLS policies. Sin filtros manuales. | ✓ |
| Explorar más opciones | Ver alternativas antes de decidir. | |

**User's choice:** Token automático con restaurant_id
**Notes:** El usuario aprobó la explicación con analogía del edificio con departamentos y tarjeta de acceso digital.

---

## Encriptación de teléfonos (SEC-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Cifrado en disco (Supabase default) + no-log | AES-256 en disco + política de no-log en código. | ✓ |
| Explorar más opciones | pgcrypto column-level u otras alternativas. | |

**User's choice:** Cifrado en disco de Supabase + política de no-log en código
**Notes:** El usuario entendió la analogía con "caja de banco" y aprobó el enfoque.

---

## Claude's Discretion

- Configuración exacta de pnpm workspaces y tsconfig
- Estructura interna de packages/shared
- Naming de variables de entorno
- Seed script básico de development

## Deferred Ideas

- pgcrypto column-level encryption — descartado para v1, puede revisarse si hay auditoría de compliance
- Schema simple con migración posterior — descartado, se optó por schema enriquecido desde Phase 1
