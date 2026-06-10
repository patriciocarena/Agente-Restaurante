---
phase: 03-voice-mvp-tier-1
plan: "02"
subsystem: backend/voice-libs
tags: [vapi, system-prompt, gemini, azure-tts, deepgram, voice-agent, es-ar]
dependency_graph:
  requires:
    - "@vapi-ai/server-sdk installed (03-01)"
    - "supabase/migrations/0003_phase3_vapi.sql applied (user action)"
  provides:
    - "apps/backend/src/lib/system-prompt.ts — buildSystemPrompt(restaurant, items): string"
    - "apps/backend/src/lib/vapi.ts — getVapiClient, confirmOrderTool, createVapiAssistant, syncAssistantPrompt"
    - "system-prompt.test.ts (5/5 GREEN)"
  affects:
    - "03-03 (imports confirmOrderTool + syncAssistantPrompt in webhook handler)"
    - "03-04 (calls createVapiAssistant in onboarding flow)"
tech_stack:
  added: []
  patterns:
    - "Pure function signature: buildSystemPrompt(restaurant, items) — testable without DB mocking"
    - "Lazy singleton: getVapiClient() mirrors twilio.ts pattern (fail-fast on missing VAPI_API_KEY)"
    - "Error swallowing in syncAssistantPrompt: try/catch logs + returns, never rethrows (MENU-05 anti-DoS)"
    - "confirmOrderTool server.secret = VAPI_WEBHOOK_SECRET on both server blocks"
key_files:
  created:
    - apps/backend/src/lib/vapi.ts
  modified:
    - apps/backend/src/lib/system-prompt.ts
decisions:
  - "buildSystemPrompt is pure/synchronous (takes pre-fetched data) — matches test scaffold signature; createVapiAssistant fetches menu from DB before calling it"
  - "confirmOrderTool has NO unit_price/price/total fields — backend recalculates from menu_items (T-03-03, VOICE-05)"
  - "Both server blocks (confirmOrderTool + createVapiAssistant) include VAPI_WEBHOOK_SECRET so X-Vapi-Secret is always sent"
  - "voiceId: 'es-AR-ElenaNeural' as string literal (not enum) — AzureVoiceIdEnum lacks this voice (Research Pitfall 1)"
metrics:
  duration: "~4m"
  completed_date: "2026-06-10"
  tasks_completed: 2
  tasks_pending_human: 0
  files_created: 1
  files_modified: 1
---

# Phase 3 Plan 02: System Prompt Builder + Vapi Client Library Summary

**One-liner:** Pure `buildSystemPrompt(restaurant, items)` for es-AR menu prompt + `lib/vapi.ts` with lazy client, price-free `confirm_order` tool schema, and `syncAssistantPrompt` that swallows Vapi errors.

## Tasks Summary

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | lib/system-prompt.ts — buildSystemPrompt | DONE | fddbef6 |
| 2 | lib/vapi.ts — client, confirm_order, create + sync | DONE | 5fa1922 |

## Task 1: buildSystemPrompt

Implemented `apps/backend/src/lib/system-prompt.ts` as a **pure synchronous function** `buildSystemPrompt(restaurant: RestaurantInfo, menuItems: MenuItem[]): string`.

Key behaviors:
- Filters `menuItems` to `available === true` inline (VOICE-04, CALL-04)
- Renders each available item as `- ${item.name} $${item.base_price}` (VOICE-05)
- Embeds VOICE-02 literal greeting in FLUJO: `"Hola, te habla ${agentName} de ${restaurantName}. ¿Qué te traemos hoy?"` 
- VOICE-13 injection resistance: `"NO inventés precios"` + `"redirigí al menú"` both present
- VOICE-09: instructs LLM to repeat full order with prices+total before closing
- VOICE-12: 3 misunderstandings → `"Disculpá, te está costando escucharme bien. Llamá de nuevo en un ratito."`

**Test result:** `system-prompt.test.ts` — 5/5 GREEN.

## Task 2: lib/vapi.ts

Created `apps/backend/src/lib/vapi.ts` with four exports:

### getVapiClient()
Lazy singleton, copies `twilio.ts` pattern. Throws `Error('Missing required env var: VAPI_API_KEY')` if key absent (fail-fast).

### confirmOrderTool
Vapi function tool schema for `confirm_order`:
- `items[]` with `{name, quantity, modifiers[], note}` — NO price/unit_price/total (T-03-03, VOICE-05)
- `fulfillment_type` enum `['retiro', 'delivery']`
- `delivery_address` string (optional)
- `customer_name` string (required)
- `server.secret = process.env.VAPI_WEBHOOK_SECRET` — ensures Vapi sends `X-Vapi-Secret` header

### createVapiAssistant(restaurant)
Fetches menu items from `menu_items` table, calls `buildSystemPrompt`, then creates Vapi assistant:
- `model: 'gemini-2.5-flash'`, `provider: 'google'`, `temperature: 0.2`, `maxTokens: 400`
- `voice: { provider: 'azure', voiceId: 'es-AR-ElenaNeural' }` — string literal, not enum
- `transcriber: { provider: 'deepgram', model: 'nova-2', language: 'es' }`
- `firstMessage`: exact VOICE-02 greeting with `¿Qué te traemos hoy?`
- `firstMessageMode: 'assistant-speaks-first'`
- Both `confirmOrderTool.server.secret` and `assistant.server.secret` set to `VAPI_WEBHOOK_SECRET`

### syncAssistantPrompt(restaurantId)
Full body wrapped in `try/catch`. On any error: `logger.error('vapi sync failed', ...)` and returns — never rethrows. Menu edits never fail due to Vapi downtime (T-03-05, MENU-05 anti-DoS).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] buildSystemPrompt signature: pure function instead of async(restaurantId)**
- **Found during:** Task 1
- **Issue:** The RED test scaffold (03-01) calls `buildSystemPrompt(restaurant, menuItems)` synchronously with pre-fetched data. The plan's `<action>` described an async `buildSystemPrompt(restaurantId: string)` that fetches from DB internally. These are incompatible — if we made it async with restaurantId, the tests (which mock supabaseAdmin but pass data directly) would fail or require complete rework.
- **Fix:** Implemented `buildSystemPrompt` as the pure synchronous function matching the test signature. In `createVapiAssistant` (vapi.ts), the DB fetch happens before calling `buildSystemPrompt`. This is architecturally cleaner (separation of concerns) and makes the prompt builder unit-testable without DB mocking.
- **Files modified:** `apps/backend/src/lib/system-prompt.ts`
- **Commit:** fddbef6

## Known Stubs

None — both functions are fully implemented. `buildSystemPrompt` generates real prompts; `createVapiAssistant` and `syncAssistantPrompt` are ready for runtime use (require live Vapi API key and DB).

## Threat Surface Scan

No new network endpoints or auth paths introduced. `lib/vapi.ts` calls outbound to Vapi API (trust boundary: backend → Vapi). Both server blocks include `VAPI_WEBHOOK_SECRET` ensuring the inbound webhook handler (Plan 03-03) can authenticate every Vapi request. No new schema changes.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/backend/src/lib/system-prompt.ts | FOUND |
| apps/backend/src/lib/vapi.ts | FOUND |
| system-prompt.test.ts 5/5 GREEN | VERIFIED |
| Commit fddbef6 | FOUND |
| Commit 5fa1922 | FOUND |
| confirmOrderTool has no unit_price/price/total | VERIFIED |
| VAPI_WEBHOOK_SECRET in 2 server blocks | VERIFIED (grep count=2) |
| syncAssistantPrompt try/catch — no rethrow | VERIFIED |
| voiceId: 'es-AR-ElenaNeural' string literal | VERIFIED |
