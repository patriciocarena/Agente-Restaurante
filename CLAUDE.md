<!-- GSD:project-start source:PROJECT.md -->
## Project

**Agente Restaurante (placeholder, nombre marketing TBD)**

SaaS multi-tenant que automatiza el teléfono del restaurante: cuando un cliente llama, una agente de voz en español rioplatense atiende, toma el pedido completo (con modificadores, cantidades, retiro o delivery con dirección), lo confirma en voz alta y lo entrega a la cocina vía Kitchen Display System (dashboard real-time). Pensado para **rotiserías, casas de comidas y hamburgueserías argentinas**, donde el teléfono se satura en hora pico y se pierden pedidos.

**Core Value:** **Cuando suena el teléfono del restaurante, el pedido llega a la cocina sin que nadie atienda.** Si esto no funciona en condiciones reales (ruido de cocina, cliente apurado, pedido con 6 items con modificaciones), nada más importa.

### Constraints

- **Tech stack v1 (Tier 1)**: Vapi.ai (voice orchestration) + Gemini 2.5 Flash (LLM) + Azure Neural TTS `es-AR-ElenaNeural` (NO ElevenLabs en v1) + Deepgram nova-2 (STT) + Twilio AR (telefonía) + Supabase con RLS (DB + auth + realtime) + Mercado Pago Subscriptions (billing) + Node.js + Express + TypeScript (backend) + React + Vite + Tailwind (frontend) + Railway (backend deploy) + Vercel (frontend deploy).
- **Costo objetivo por llamada**: ≤$0.25 USD por llamada de 2 minutos. A 30 calls/día/restaurante = ≤$210/mes infra. Pricing del SaaS debe sostener este costo + margen.
- **Plan de migración de costos** (definido en plan inicial): Tier 1 (Vapi) en v1, migrar a Tier 2 (Pipecat self-hosted + Telnyx) cuando haya ≥3 clientes pagos o costos infra >$500/mes. Tier 3 (Gemini Native Audio speech-to-speech) cuando salga GA con voz AR estable.
- **Latencia objetivo**: turn-around (cliente termina de hablar → agente empieza a responder) <800ms. Es NFR (non-functional requirement) verificable en Phase 6.
- **Timeline**: MVP demoable en **2 semanas** (Phases 1-4). Billing real + hardening (Phases 5-6) post-demo. Cost optimization (Phase 7) cuando haya tracción.
- **Multi-tenancy estricto**: RLS de Supabase obligatorio, ningún restaurante puede ver datos de otro nunca. Webhook routea por `assistantId` de Vapi → `restaurant_id`.
- **Seguridad de webhook**: HMAC signature de Vapi validada en cada request. Idempotencia por `call_id` UNIQUE.
- **Regulación AR**: ENACOM regula números fijos AR. Alternativas a investigar: Twilio AR directo (si permite), Telnyx (backbone propio LATAM), o forwarding desde celular del restaurante a número Twilio US (más simple para MVP, decisión en research).
- **Privacidad**: Customer phone numbers son PII bajo Ley 25.326 (AR) + GDPR-equivalent. Storage justificado por finalidad operacional, retention policy a definir.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
