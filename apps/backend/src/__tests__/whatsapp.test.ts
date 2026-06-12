// Tests para lib/whatsapp: formatter puro, normalizador AR y sender fire-and-forget.
// NOTIF-01..05
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createMock = vi.fn();
vi.mock('../lib/twilio', () => ({
  getTwilioClient: () => ({ messages: { create: createMock } }),
}));

import {
  formatOrderMessage,
  sendOrderWhatsApp,
  normalizeArWhatsApp,
  OrderNotificationPayload,
} from '../lib/whatsapp';

function basePayload(overrides: Partial<OrderNotificationPayload> = {}): OrderNotificationPayload {
  return {
    orderNumber: 14,
    restaurantName: 'Wonder',
    customerName: 'Juan',
    customerPhone: '+5493511111111',
    fulfillmentType: 'retiro',
    deliveryAddress: null,
    items: [
      { name: 'Hamburguesa doble queso', quantity: 2, unit_price: 12000, modifiers: ['sin cebolla'], note: null },
      { name: 'Papas grandes', quantity: 1, unit_price: 6500, modifiers: [], note: 'bien crocantes' },
    ],
    total: 30500,
    ...overrides,
  };
}

describe('normalizeArWhatsApp', () => {
  it('accepts full E.164 AR mobile', () => {
    expect(normalizeArWhatsApp('+5493511234567')).toBe('+5493511234567');
  });

  it('accepts 549... without plus', () => {
    expect(normalizeArWhatsApp('5493511234567')).toBe('+5493511234567');
  });

  it('inserts the mobile 9 when given +54 without it', () => {
    expect(normalizeArWhatsApp('+543511234567')).toBe('+5493511234567');
  });

  it('normalizes local area+number (10 digits)', () => {
    expect(normalizeArWhatsApp('351 1234567')).toBe('+5493511234567');
  });

  it('normalizes local format with leading 0 and 15 (3-digit area)', () => {
    expect(normalizeArWhatsApp('0351 15 5123456')).toBe('+5493515123456');
  });

  it('normalizes Buenos Aires 11 15 format (2-digit area)', () => {
    expect(normalizeArWhatsApp('011 15 1234 5678')).toBe('+5491112345678');
  });

  it('rejects too-short numbers', () => {
    expect(normalizeArWhatsApp('351123')).toBeNull();
  });

  it('rejects non-AR numbers', () => {
    expect(normalizeArWhatsApp('+14155238886')).toBeNull();
  });
});

describe('formatOrderMessage', () => {
  it('includes order number, restaurant, customer with phone and total es-AR formatted', () => {
    const msg = formatOrderMessage(basePayload());
    expect(msg).toContain('*Nuevo pedido #14* — Wonder');
    expect(msg).toContain('👤 Juan — +5493511111111');
    expect(msg).toContain('*Total: $30.500*');
  });

  it('renders retiro label without address line', () => {
    const msg = formatOrderMessage(basePayload());
    expect(msg).toContain('*Retiro en el local*');
    expect(msg).not.toContain('Delivery');
  });

  it('renders delivery with address', () => {
    const msg = formatOrderMessage(
      basePayload({ fulfillmentType: 'delivery', deliveryAddress: 'Av. Goyeneche 1234' }),
    );
    expect(msg).toContain('*Delivery:* Av. Goyeneche 1234');
    expect(msg).not.toContain('Retiro');
  });

  it('renders items with quantity, modifiers in parens, and note line', () => {
    const msg = formatOrderMessage(basePayload());
    expect(msg).toContain('2× Hamburguesa doble queso');
    expect(msg).toContain('(sin cebolla)');
    expect(msg).toContain('1× Papas grandes');
    expect(msg).toContain('Nota: bien crocantes');
  });

  it('omits the phone when customerPhone is null (web calls)', () => {
    const msg = formatOrderMessage(basePayload({ customerPhone: null }));
    expect(msg).toContain('👤 Juan');
    expect(msg).not.toContain('Juan —');
  });
});

describe('sendOrderWhatsApp', () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.TWILIO_ACCOUNT_SID = 'fake_sid';
    process.env.TWILIO_AUTH_TOKEN = 'fake_token';
    process.env.TWILIO_WHATSAPP_FROM = '+14155238886';
  });

  afterEach(() => {
    delete process.env.TWILIO_WHATSAPP_FROM;
  });

  it('silently skips when no destination number is configured', async () => {
    await expect(sendOrderWhatsApp(null, basePayload())).resolves.toBeUndefined();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('skips with warn when TWILIO_WHATSAPP_FROM is missing', async () => {
    delete process.env.TWILIO_WHATSAPP_FROM;
    await expect(sendOrderWhatsApp('+5493511234567', basePayload())).resolves.toBeUndefined();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('sends with whatsapp: prefixes and the formatted body', async () => {
    createMock.mockResolvedValueOnce({ sid: 'SM123' });
    await sendOrderWhatsApp('+5493511234567', basePayload());
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0];
    expect(arg.from).toBe('whatsapp:+14155238886');
    expect(arg.to).toBe('whatsapp:+5493511234567');
    expect(arg.body).toContain('#14');
  });

  it('swallows Twilio errors (never rejects)', async () => {
    const err = Object.assign(new Error('not in sandbox'), { code: 63015 });
    createMock.mockRejectedValueOnce(err);
    await expect(sendOrderWhatsApp('+5493511234567', basePayload())).resolves.toBeUndefined();
  });
});
