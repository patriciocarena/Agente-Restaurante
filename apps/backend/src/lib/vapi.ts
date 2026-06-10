// apps/backend/src/lib/vapi.ts
// Vapi.ai integration: lazy singleton client, confirm_order tool schema,
// assistant create and sync (prompt update).
// Requirements: ONB-05, MENU-05, VOICE-01–05, VOICE-09, VOICE-10

import { VapiClient } from '@vapi-ai/server-sdk';
import { buildSystemPrompt } from './system-prompt';
import { supabaseAdmin } from './supabase';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Lazy singleton — copy of twilio.ts pattern
// ---------------------------------------------------------------------------
let _vapi: VapiClient | null = null;

export function getVapiClient(): VapiClient {
  if (!_vapi) {
    const token = process.env.VAPI_API_KEY;
    if (!token) throw new Error('Missing required env var: VAPI_API_KEY');
    _vapi = new VapiClient({ token });
  }
  return _vapi;
}

// ---------------------------------------------------------------------------
// confirm_order tool — VOICE-05 / CALL-05: NO price / total fields.
// Parameters MUST NOT contain unit_price, price, or total — the backend
// recalculates from menu_items (see Plan 03-03).
// ---------------------------------------------------------------------------
export const confirmOrderTool = {
  type: 'function' as const,
  async: false,
  server: {
    url: `${process.env.BACKEND_URL}/api/vapi/tool-calls`,
    // CRITICAL: secret makes Vapi send X-Vapi-Secret header on every request.
    // Without it the Plan 03 webhook correctly 401s every tool-call.
    secret: process.env.VAPI_WEBHOOK_SECRET,
  },
  function: {
    name: 'confirm_order',
    description:
      'Llama esta función SOLO cuando el cliente haya confirmado verbalmente el pedido completo. No la llames para consultas de precios ni de disponibilidad.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Lista de items del pedido',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Nombre exacto del item como aparece en el menú',
              },
              quantity: { type: 'integer', description: 'Cantidad' },
              modifiers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Lista de modificadores (ej: "sin cebolla", "extra queso")',
              },
              note: { type: 'string', description: 'Nota libre del cliente para este item' },
            },
            required: ['name', 'quantity'],
          },
        },
        fulfillment_type: {
          type: 'string',
          enum: ['retiro', 'delivery'],
          description: 'Tipo de entrega: retiro en el local o delivery a domicilio',
        },
        delivery_address: {
          type: 'string',
          description: 'Dirección completa si es delivery',
        },
        customer_name: {
          type: 'string',
          description: 'Nombre del cliente',
        },
      },
      required: ['items', 'fulfillment_type', 'customer_name'],
    },
  },
};

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
export interface VapiAssistantResult {
  assistantId: string;
}

// ---------------------------------------------------------------------------
// createVapiAssistant — called during restaurant onboarding (ONB-05)
// Fetches the live menu, builds the system prompt, creates the Vapi assistant.
// Returns the Vapi assistant ID (caller persists to restaurants.vapi_assistant_id).
// ---------------------------------------------------------------------------
export async function createVapiAssistant(restaurant: {
  id: string;
  name: string;
  agent_name: string;
}): Promise<string> {
  // Fetch all menu items for this restaurant to build the system prompt
  const { data: menuItems, error: menuError } = await supabaseAdmin
    .from('menu_items')
    .select('name, base_price, available, description')
    .eq('restaurant_id', restaurant.id);

  if (menuError) {
    throw new Error('menu_items fetch failed: ' + menuError.message);
  }

  const systemPrompt = buildSystemPrompt(restaurant, menuItems ?? []);

  // VOICE-02: firstMessage is the fixed greeting (literal, with ¿ and accents)
  const firstMessage = `Hola, te habla ${restaurant.agent_name} de ${restaurant.name}. ¿Qué te traemos hoy?`;

  const assistant = await getVapiClient().assistants.create({
    name: `${restaurant.name} — Agente Voz`,
    firstMessage,
    firstMessageMode: 'assistant-speaks-first',
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'es',
    },
    model: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      messages: [{ role: 'system', content: systemPrompt }],
      tools: [confirmOrderTool],
      temperature: 0.2,
      maxTokens: 400,
    },
    voice: {
      provider: 'azure',
      // String literal, NOT enum — AzureVoiceIdEnum lacks es-AR-ElenaNeural (Pitfall 1)
      voiceId: 'es-AR-ElenaNeural',
    },
    maxDurationSeconds: 600,
    stopSpeakingPlan: {
      numWords: 2,
      backoffSeconds: 1.0,
    },
    server: {
      url: `${process.env.BACKEND_URL}/api/vapi/tool-calls`,
      // CRITICAL: ensures Vapi sends X-Vapi-Secret on end-of-call-report events
      secret: process.env.VAPI_WEBHOOK_SECRET,
    },
  });

  return assistant.id;
}

// ---------------------------------------------------------------------------
// syncAssistantPrompt — called after any menu edit (MENU-05)
// Rebuilds the system prompt from the live menu and pushes it to Vapi.
// MUST NOT throw — a menu edit must never fail because Vapi is down (T-03-05).
// ---------------------------------------------------------------------------
export async function syncAssistantPrompt(restaurantId: string): Promise<void> {
  try {
    // Fetch restaurant (need name + agent_name for prompt + vapi_assistant_id)
    const { data: restaurant, error: restError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, agent_name, vapi_assistant_id')
      .eq('id', restaurantId)
      .single();

    if (restError) throw restError;
    if (!restaurant?.vapi_assistant_id) {
      // Assistant not created yet — skip silently (normal during onboarding)
      return;
    }

    // Fetch current menu items
    const { data: menuItems, error: menuError } = await supabaseAdmin
      .from('menu_items')
      .select('name, base_price, available, description')
      .eq('restaurant_id', restaurantId);

    if (menuError) throw menuError;

    const newPrompt = buildSystemPrompt(restaurant, menuItems ?? []);

    await getVapiClient().assistants.update(restaurant.vapi_assistant_id, {
      model: {
        provider: 'google',
        model: 'gemini-2.5-flash',
        messages: [{ role: 'system', content: newPrompt }],
        tools: [confirmOrderTool],
        temperature: 0.2,
        maxTokens: 400,
      },
    });
  } catch (err) {
    // T-03-05: Swallow Vapi errors — menu edit must always succeed
    logger.error('vapi sync failed', {
      restaurant_id: restaurantId,
      error: String(err),
    });
    // DO NOT rethrow
  }
}
