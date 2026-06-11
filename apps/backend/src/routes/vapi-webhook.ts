// apps/backend/src/routes/vapi-webhook.ts
// Vapi.ai webhook handler.
// Receives confirm_order tool-calls and end-of-call-report events from Vapi.
// Security: X-Vapi-Secret header (CALL-01).
// Multi-tenancy: routes by assistantId → restaurant_id (CALL-03).
// Requirements: CALL-01..09, VOICE-06/07/08/11, OBS-01

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

export const vapiWebhookRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/vapi/tool-calls
// Handles both tool-calls events and end-of-call-report events from Vapi.
// ---------------------------------------------------------------------------
vapiWebhookRouter.post('/tool-calls', async (req: Request, res: Response) => {
  // CALL-01: X-Vapi-Secret authentication
  const secret = req.headers['x-vapi-secret'];
  if (!secret || secret !== process.env.VAPI_WEBHOOK_SECRET) {
    logger.warn('vapi webhook unauthorized', {});
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { message } = req.body;
  if (!message?.type) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    if (message.type === 'tool-calls') {
      return await handleToolCalls(message, res);
    }
    if (message.type === 'end-of-call-report') {
      return await handleEndOfCall(message, res);
    }
    // Unknown message type — acknowledge and ignore
    return res.status(200).send();
  } catch (err) {
    logger.error('vapi webhook error', { error: String(err), type: message?.type });
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ---------------------------------------------------------------------------
// handleToolCalls — processes confirm_order tool-calls
// ---------------------------------------------------------------------------
async function handleToolCalls(message: Record<string, unknown>, res: Response): Promise<Response> {
  const toolCallList = message.toolCallList as Array<{
    id: string;
    function: { name: string; arguments: string | Record<string, unknown> };
  }>;

  const toolCall = toolCallList?.[0];
  if (!toolCall) {
    return res.json({ results: [] });
  }

  const toolCallId = toolCall.id;

  // Parse arguments — may arrive as a JSON string or already parsed object
  let args: {
    items: Array<{ name: string; quantity: number; modifiers?: string[]; note?: string }>;
    fulfillment_type: 'retiro' | 'delivery';
    delivery_address?: string;
    customer_name: string;
  };
  try {
    args =
      typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : (toolCall.function.arguments as typeof args);
  } catch {
    return res.json({
      results: [{ toolCallId, result: 'No pude entender el pedido. Por favor, llamá de nuevo.' }],
    });
  }

  const callMessage = message.call as { id?: string; assistantId?: string } | undefined;
  const callId = callMessage?.id;
  const assistantId = callMessage?.assistantId;
  const customer = message.customer as { number?: string } | undefined;
  // customerPhone is PII (Ley 25.326). NEVER pass it to logger.
  const customerPhone: string | null = customer?.number ?? null;

  // CALL-03: Route by assistantId → tenant
  const { data: restaurant, error: restError } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, agent_name')
    .eq('vapi_assistant_id', assistantId)
    .single();

  if (restError || !restaurant) {
    logger.warn('vapi webhook: restaurant not found', { assistant_id: assistantId });
    return res.json({
      results: [
        {
          toolCallId,
          result:
            'No encontré el restaurante. Por favor llamá de nuevo.',
        },
      ],
    });
  }

  // CALL-02: Idempotency — check for existing order with same call_id
  const { data: existingOrder, error: existingErr } = await supabaseAdmin
    .from('orders')
    .select('order_number')
    .eq('call_id', callId)
    .single();

  if (!existingErr && existingOrder) {
    return res.json({
      results: [
        {
          toolCallId,
          result: `Tu pedido #${existingOrder.order_number} ya está confirmado y pasó a cocina.`,
        },
      ],
    });
  }

  // CALL-07 / VOICE-11: Business hours check (server-side, independent of LLM)
  const now = new Date();
  // Argentina/Cordoba is UTC-3 and has no DST
  const localStr = now.toLocaleString('en-US', { timeZone: 'America/Argentina/Cordoba' });
  const localDate = new Date(localStr);
  // 0=Sunday, 1=Monday, ..., 6=Saturday (matches DB: 0=Dom..6=Sab)
  const dayOfWeek = localDate.getDay();
  const hours = localDate.getHours().toString().padStart(2, '0');
  const minutes = localDate.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;

  const { data: hoursRow } = await supabaseAdmin
    .from('restaurant_hours')
    .select('open_time, close_time, is_closed')
    .eq('restaurant_id', restaurant.id)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (hoursRow) {
    const isClosedDay = hoursRow.is_closed;
    const beforeOpen = currentTime < hoursRow.open_time;
    const afterClose = currentTime >= hoursRow.close_time;

    if (isClosedDay || beforeOpen || afterClose) {
      const openText =
        !isClosedDay && hoursRow.open_time && hoursRow.close_time
          ? ` Atendemos de ${hoursRow.open_time.slice(0, 5)} a ${hoursRow.close_time.slice(0, 5)}.`
          : '';
      return res.json({
        results: [
          {
            toolCallId,
            result: `Ahora estamos cerrados.${openText} ¡Llamanos en ese horario!`,
          },
        ],
      });
    }
  }
  // If no hours row found (restaurant hasn't configured hours), treat as open 24/7

  // CALL-04/05/06: Menu validation + server-side price recalculation
  const { data: menuItems, error: menuError } = await supabaseAdmin
    .from('menu_items')
    .select(
      'id, name, base_price, available, option_groups(option_items(name, price_delta))',
    )
    .eq('restaurant_id', restaurant.id);

  if (menuError) {
    logger.error('menu_items fetch failed', {
      restaurant_id: restaurant.id,
      error: menuError.message,
    });
    return res.json({
      results: [{ toolCallId, result: 'Hubo un error al consultar el menú. Por favor llamá de nuevo.' }],
    });
  }

  const availableItems = (menuItems ?? []).filter((m: { available: boolean }) => m.available);

  // Build server-side line items with price recalculation
  const orderLines: Array<{
    menu_item_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    modifiers: string[];
    note: string | null;
  }> = [];

  for (const argItem of args.items ?? []) {
    const matched = availableItems.find(
      (m: { name: string }) => m.name.trim().toLowerCase() === argItem.name.trim().toLowerCase(),
    );

    if (!matched) {
      return res.json({
        results: [
          {
            toolCallId,
            result: `No tenemos "${argItem.name}" en el menú.`,
          },
        ],
      });
    }

    // Compute unit_price from base_price + sum of matching modifier price_deltas (CALL-05/06)
    let unitPrice: number = matched.base_price;
    const modifiers: string[] = argItem.modifiers ?? [];

    if (modifiers.length > 0) {
      const optionGroups = matched.option_groups ?? [];
      for (const group of optionGroups) {
        const optionItems = (group as { option_items: Array<{ name: string; price_delta: number }> }).option_items ?? [];
        for (const optItem of optionItems) {
          if (
            modifiers.some(
              (mod) => mod.trim().toLowerCase() === optItem.name.trim().toLowerCase(),
            )
          ) {
            unitPrice += optItem.price_delta;
          }
        }
      }
    }

    orderLines.push({
      menu_item_id: matched.id,
      name: matched.name,
      quantity: argItem.quantity,
      unit_price: unitPrice,
      modifiers,
      note: argItem.note ?? null,
    });
  }

  // Compute total server-side (CALL-06) — never from LLM
  const total = orderLines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);

  // CALL-08: Per-tenant atomic order number
  const { data: orderNumber, error: rpcError } = await supabaseAdmin.rpc('increment_order_counter', {
    p_restaurant_id: restaurant.id,
  });

  if (rpcError) {
    logger.error('increment_order_counter failed', {
      restaurant_id: restaurant.id,
      error: rpcError.message,
    });
    return res.json({
      results: [{ toolCallId, result: 'Hubo un error al registrar el pedido. Por favor llamá de nuevo.' }],
    });
  }

  // CALL-09 / VOICE-06/07/08: Persist order with explicit whitelist — never spread args
  const { data: insertedOrder, error: insertErr } = await supabaseAdmin
    .from('orders')
    .insert({
      restaurant_id: restaurant.id,
      order_number: orderNumber,
      customer_name: args.customer_name,
      customer_phone: customerPhone,      // PII stored in DB; never logged
      fulfillment_type: args.fulfillment_type,
      delivery_address: args.delivery_address ?? null,
      call_id: callId,
      transcript: null,                   // transcript written back on end-of-call-report (CALL-09)
      total,
    })
    .select('id')
    .single();

  if (insertErr) {
    logger.error('orders insert failed', {
      restaurant_id: restaurant.id,
      error: insertErr.message,
    });
    return res.json({
      results: [{ toolCallId, result: 'Hubo un error al guardar el pedido. Por favor llamá de nuevo.' }],
    });
  }

  const orderId = insertedOrder?.id;

  // Insert order_items rows (one per line)
  if (orderLines.length > 0 && orderId) {
    const orderItems = orderLines.map((line) => ({
      order_id: orderId,
      restaurant_id: restaurant.id,
      menu_item_id: line.menu_item_id,
      name: line.name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      modifiers: line.modifiers,
      note: line.note,
    }));

    const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(orderItems);

    if (itemsErr) {
      logger.error('order_items insert failed', {
        restaurant_id: restaurant.id,
        order_id: orderId,
        error: itemsErr.message,
      });
      // Non-fatal: order was created; don't reject the call
    }
  }

  logger.info('order created', {
    restaurant_id: restaurant.id,
    order_number: orderNumber,
    total,
  });

  return res.json({
    results: [
      {
        toolCallId,
        result: `¡Listo! Tu pedido es el #${orderNumber} y ya pasó a cocina. ¡Gracias!`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// handleEndOfCall — OBS-01 + CALL-09 transcript writeback
// ---------------------------------------------------------------------------
async function handleEndOfCall(message: Record<string, unknown>, res: Response): Promise<Response> {
  const call = message.call as {
    id?: string;
    assistantId?: string;
    startedAt?: string;
    endedAt?: string;
  } | undefined;

  const callId = call?.id;
  const assistantId = call?.assistantId;

  // Route restaurant by assistantId (same lookup as tool-calls handler)
  const { data: restaurant, error: restError } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, agent_name')
    .eq('vapi_assistant_id', assistantId)
    .single();

  if (restError || !restaurant) {
    logger.warn('vapi end-of-call: restaurant not found', { assistant_id: assistantId });
    // Still return 200 — Vapi doesn't retry 200 responses
    return res.status(200).send();
  }

  // Compute duration in seconds.
  // UAT finding: call.startedAt/endedAt arrive null in end-of-call-report —
  // the timestamps and duration live at the message level in current Vapi payloads.
  const startedAt = (message.startedAt as string | undefined) ?? call?.startedAt;
  const endedAt = (message.endedAt as string | undefined) ?? call?.endedAt;
  const reportedDuration = message.durationSeconds as number | undefined;
  const durationSeconds =
    reportedDuration != null
      ? Math.round(reportedDuration)
      : startedAt && endedAt
        ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
        : null;

  const costUsd = (message.cost as number | undefined) ?? null;
  const artifact = message.artifact as { transcript?: string } | undefined;
  const transcript = artifact?.transcript ?? null;
  const endedReason = (message.endedReason as string | undefined) ?? null;

  // Look up existing order_id by call_id (for call_logs FK and transcript writeback)
  const { data: existingOrder } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('call_id', callId)
    .single();

  const existingOrderId: string | null = existingOrder?.id ?? null;

  // OBS-01: Insert into call_logs (upsert on call_id for idempotency)
  const { error: logError } = await supabaseAdmin.from('call_logs').upsert(
    {
      restaurant_id: restaurant.id,
      call_id: callId,
      order_id: existingOrderId,
      duration_seconds: durationSeconds,
      cost_usd: costUsd,
      transcript,
      ended_reason: endedReason,
      started_at: startedAt ?? null,
      ended_at: endedAt ?? null,
    },
    { onConflict: 'call_id' },
  );

  if (logError) {
    logger.error('call_logs insert failed', {
      restaurant_id: restaurant.id,
      call_id: callId,
      error: logError.message,
    });
  }

  // CALL-09: Write transcript back to the matching order (if one exists for this call)
  if (transcript !== null && existingOrderId) {
    const { error: transcriptErr } = await supabaseAdmin
      .from('orders')
      .update({ transcript })
      .eq('call_id', callId);

    if (transcriptErr) {
      logger.error('orders transcript writeback failed', {
        restaurant_id: restaurant.id,
        call_id: callId,
        error: transcriptErr.message,
      });
    }
  }

  logger.info('call logged', {
    restaurant_id: restaurant.id,
    call_id: callId,
    duration_seconds: durationSeconds,
  });

  return res.status(200).send();
}
