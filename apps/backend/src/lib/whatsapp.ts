// apps/backend/src/lib/whatsapp.ts
// Notificación de pedidos por WhatsApp al restaurante (pivot Fase 4: sin KDS).
// Twilio WhatsApp Sandbox en MVP — el restaurante hace "join <code>" una vez.
// Requirements: NOTIF-01..05
//
// sendOrderWhatsApp es el callee de un fire-and-forget: NUNCA debe lanzar.
// El pedido ya está persistido cuando se llama — un fallo acá solo se loguea.

import { getTwilioClient } from './twilio';
import { logger } from './logger';

export interface OrderNotificationPayload {
  orderNumber: number;
  restaurantName: string;
  customerName: string;
  // PII (Ley 25.326): va en el cuerpo del mensaje (necesidad operativa del
  // restaurante), pero NUNCA en logs — no pasar a logger metadata.
  customerPhone: string | null;
  fulfillmentType: 'retiro' | 'delivery';
  deliveryAddress: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    modifiers: string[];
    note: string | null;
  }>;
  total: number;
}

// Normaliza un número de celular ARGENTINO a E.164 móvil (+549 + área + abonado).
// Decisión de producto: siempre trabajamos con números AR.
// Acepta: "+5493511234567", "5493511234567", "3511234567" (área+abonado),
// "0351 15 5123456" (formato local con 0 y 15). Devuelve null si no es válido.
export function normalizeArWhatsApp(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');

  // Quitar 0 inicial del formato local ("0351...")
  if (digits.startsWith('0')) digits = digits.slice(1);

  if (/^549\d{10}$/.test(digits)) return `+${digits}`;

  // "+54" sin el 9 de móvil → insertarlo
  if (/^54\d{10}$/.test(digits)) return `+549${digits.slice(2)}`;

  // Área + "15" + abonado (12 dígitos): quitar el 15 según largo de área (2, 3 o 4)
  if (/^\d{12}$/.test(digits)) {
    for (const areaLen of [2, 3, 4]) {
      if (digits.slice(areaLen, areaLen + 2) === '15') {
        const candidate = digits.slice(0, areaLen) + digits.slice(areaLen + 2);
        if (/^\d{10}$/.test(candidate)) return `+549${candidate}`;
      }
    }
    return null;
  }

  // Área + abonado (10 dígitos)
  if (/^\d{10}$/.test(digits)) return `+549${digits}`;

  return null;
}

export function formatOrderMessage(p: OrderNotificationPayload): string {
  const lines: string[] = [];

  lines.push(`🛎️ *Nuevo pedido #${p.orderNumber}* — ${p.restaurantName}`);
  lines.push('');

  lines.push(p.customerPhone ? `👤 ${p.customerName} — ${p.customerPhone}` : `👤 ${p.customerName}`);
  lines.push(
    p.fulfillmentType === 'delivery'
      ? `🛵 *Delivery:* ${p.deliveryAddress ?? '(sin dirección)'}`
      : '🛍️ *Retiro en el local*',
  );
  lines.push('');

  for (const item of p.items) {
    lines.push(`${item.quantity}× ${item.name}`);
    if (item.modifiers.length > 0) {
      lines.push(`   (${item.modifiers.join(', ')})`);
    }
    if (item.note) {
      lines.push(`   Nota: ${item.note}`);
    }
  }
  lines.push('');

  lines.push(`💰 *Total: $${p.total.toLocaleString('es-AR')}*`);

  return lines.join('\n');
}

export async function sendOrderWhatsApp(
  to: string | null,
  payload: OrderNotificationPayload,
): Promise<void> {
  try {
    if (!to) {
      logger.info('whatsapp skipped: no number configured', {
        restaurant_name: payload.restaurantName,
        order_number: payload.orderNumber,
      });
      return;
    }

    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !from) {
      logger.warn('whatsapp skipped: twilio not configured', {
        order_number: payload.orderNumber,
      });
      return;
    }

    await getTwilioClient().messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${to}`,
      body: formatOrderMessage(payload),
    });

    logger.info('whatsapp sent', { order_number: payload.orderNumber });
  } catch (err) {
    // 63015/63016 = destinatario no joineado al sandbox (sesión de 72h vencida)
    const code = (err as { code?: number })?.code;
    logger.error('whatsapp send failed', {
      order_number: payload.orderNumber,
      error_code: code ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
    // No rethrow — el pedido ya está en la DB, la cocina puede verlo por otros medios.
  }
}
