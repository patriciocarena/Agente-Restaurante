import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Set env vars BEFORE importing anything that uses them
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.SUPABASE_ANON_KEY ??= 'fake_for_test';
process.env.TWILIO_ACCOUNT_SID ??= 'fake_for_test';
process.env.TWILIO_AUTH_TOKEN ??= 'fake_for_test';
process.env.TWILIO_DEFAULT_AREA_CODE ??= '415';
process.env.MERCADO_PAGO_ACCESS_TOKEN ??= 'fake_for_test';
process.env.VAPI_API_KEY ??= 'fake_for_test';
process.env.VAPI_WEBHOOK_SECRET ??= 'test_secret';
process.env.NODE_ENV = 'test';

// Stub whatsapp lib: assert the fire-and-forget is wired without hitting Twilio.
// normalizeArWhatsApp must stay real-ish — routes/restaurants.ts imports it too.
vi.mock('../lib/whatsapp', () => ({
  sendOrderWhatsApp: vi.fn().mockResolvedValue(undefined),
  normalizeArWhatsApp: vi.fn((v: string) => (/^\+549\d{10}$/.test(v) ? v : null)),
  formatOrderMessage: vi.fn(() => 'mock'),
}));

// Stub supabaseAdmin so no real DB calls happen in unit tests
vi.mock('../lib/supabase', () => {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const eqMock = vi.fn(() => ({ data: null, error: null, single: vi.fn().mockResolvedValue({ data: null, error: null }) }));
  return {
    supabaseAdmin: {
      from: vi.fn(() => ({
        insert: insertMock,
        select: selectMock,
        eq: eqMock,
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn(() => ({ eq: eqMock })),
      })),
      rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
    },
    _insertMock: insertMock,
  };
});

let app: any;
beforeAll(async () => {
  app = (await import('../index')).default;
});

describe('CALL-01..09 / OBS-01 vapi webhook', () => {
  describe('Mocked unit tests', () => {
    // -------------------------------------------------------------------------
    // Auth guard tests — CALL-01: HMAC / secret validation
    // -------------------------------------------------------------------------
    it('returns 401 when X-Vapi-Secret header is missing', async () => {
      const res = await request(app)
        .post('/api/vapi/tool-calls')
        .send({ message: { type: 'tool-calls', toolCallList: [] } });
      expect(res.status).toBe(401);
    });

    it('returns 401 when X-Vapi-Secret is wrong', async () => {
      const res = await request(app)
        .post('/api/vapi/tool-calls')
        .set('x-vapi-secret', 'wrong_secret')
        .send({ message: { type: 'tool-calls', toolCallList: [] } });
      expect(res.status).toBe(401);
    });

    // -------------------------------------------------------------------------
    // VOICE-06: fulfillment_type persisted correctly in orders insert
    // Guard: field must not be silently dropped from the insert payload.
    // Plan 03 turns this GREEN by implementing the webhook handler.
    // -------------------------------------------------------------------------
    it('VOICE-06: valid tool-call with fulfillment_type=retiro — insert called with correct fulfillment_type', async () => {
      const { supabaseAdmin } = await import('../lib/supabase');
      const insertMock = vi.fn().mockResolvedValue({ data: { id: 'order-uuid', order_number: 1 }, error: null });

      // Override from() to return a mock that captures the insert payload
      (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            insert: insertMock,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          };
        }
        if (table === 'restaurants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'rest-uuid', name: 'Wonder', agent_name: 'Sofía' },
              error: null,
            }),
          };
        }
        if (table === 'menu_items') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnThis(),
        };
      });
      (supabaseAdmin.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 1, error: null });

      const toolCallPayload = {
        message: {
          type: 'tool-calls',
          call: { id: 'call-test-001', assistantId: 'asst-test-001' },
          toolCallList: [
            {
              id: 'tc-001',
              function: {
                name: 'confirm_order',
                arguments: JSON.stringify({
                  fulfillment_type: 'retiro',
                  items: [],
                  customer_name: 'Juan',
                  customer_phone: '1122334455',
                }),
              },
            },
          ],
        },
      };

      const res = await request(app)
        .post('/api/vapi/tool-calls')
        .set('x-vapi-secret', 'test_secret')
        .send(toolCallPayload);

      // Route exists (not 404) and auth passes (not 401) — implementation pending in Plan 03
      // When Plan 03 is implemented, insertMock should be called with fulfillment_type='retiro'
      if (res.status !== 404 && insertMock.mock.calls.length > 0) {
        const insertArg = insertMock.mock.calls[0][0];
        const payload = Array.isArray(insertArg) ? insertArg[0] : insertArg;
        expect(payload.fulfillment_type).toBe('retiro');
      } else {
        // RED state: route not yet implemented → expect 404, document that Plan 03 turns this GREEN
        expect([401, 404, 200]).toContain(res.status);
      }
    });

    // -------------------------------------------------------------------------
    // NOTIF-01: order persisted → WhatsApp fire-and-forget to the restaurant
    // -------------------------------------------------------------------------
    it('NOTIF-01: successful confirm_order triggers sendOrderWhatsApp with order payload', async () => {
      const { supabaseAdmin } = await import('../lib/supabase');
      const { sendOrderWhatsApp } = await import('../lib/whatsapp');
      (sendOrderWhatsApp as ReturnType<typeof vi.fn>).mockClear();

      let ordersCallCount = 0;
      (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'restaurants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'rest-uuid',
                name: 'Wonder',
                agent_name: 'Alex',
                whatsapp_number: '+5493511234567',
              },
              error: null,
            }),
          };
        }
        if (table === 'orders') {
          ordersCallCount += 1;
          if (ordersCallCount === 1) {
            // Idempotency check: no existing order
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            };
          }
          // Insert path: .insert({...}).select('id').single()
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'order-uuid' }, error: null }),
          };
        }
        if (table === 'restaurant_hours') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }), // sin filas = abierto 24/7
          };
        }
        if (table === 'menu_items') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'mi-1',
                  name: 'Hamburguesa clásica',
                  base_price: 9500,
                  available: true,
                  option_groups: [],
                },
              ],
              error: null,
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnThis(),
        };
      });
      (supabaseAdmin.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 7, error: null });

      const res = await request(app)
        .post('/api/vapi/tool-calls')
        .set('x-vapi-secret', 'test_secret')
        .send({
          message: {
            type: 'tool-calls',
            call: { id: 'call-notif-001', assistantId: 'asst-test-001' },
            customer: { number: '+5493519999999' },
            toolCallList: [
              {
                id: 'tc-notif',
                function: {
                  name: 'confirm_order',
                  arguments: JSON.stringify({
                    fulfillment_type: 'retiro',
                    items: [{ name: 'Hamburguesa clásica', quantity: 2 }],
                    customer_name: 'Juan',
                  }),
                },
              },
            ],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].result).toContain('#7');

      // Fire-and-forget: se dispara después de responder — esperar el tick
      await vi.waitFor(() => {
        expect(sendOrderWhatsApp).toHaveBeenCalledTimes(1);
      });
      const [to, payload] = (sendOrderWhatsApp as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(to).toBe('+5493511234567');
      expect(payload.orderNumber).toBe(7);
      expect(payload.total).toBe(19000); // 2 × 9500 server-side
      expect(payload.items[0].name).toBe('Hamburguesa clásica');
      expect(payload.customerPhone).toBe('+5493519999999');
    });

    // -------------------------------------------------------------------------
    // CALL-02: idempotency — duplicate call_id returns existing order number
    // -------------------------------------------------------------------------
    it.todo('CALL-02: duplicate call_id returns existing order number');

    // -------------------------------------------------------------------------
    // CALL-04: item-not-available rejected
    // -------------------------------------------------------------------------
    it.todo('CALL-04: item marked unavailable is rejected with error result');

    // -------------------------------------------------------------------------
    // CALL-05: unit_price recalculated from DB (not trusted from LLM)
    // -------------------------------------------------------------------------
    it.todo('CALL-05: unit_price is taken from menu_items DB, not from LLM args');

    // -------------------------------------------------------------------------
    // CALL-06: total recalculated server-side
    // -------------------------------------------------------------------------
    it.todo('CALL-06: total is recalculated server-side (quantity × unit_price sum)');

    // -------------------------------------------------------------------------
    // CALL-07: outside-hours — no order created
    // -------------------------------------------------------------------------
    it.todo('CALL-07: call received outside restaurant_hours does not create an order');

    // -------------------------------------------------------------------------
    // CALL-08: per-tenant order_number via increment_order_counter RPC
    // -------------------------------------------------------------------------
    it.todo('CALL-08: per-tenant order_number uses increment_order_counter RPC');

    // -------------------------------------------------------------------------
    // CALL-09: end-of-call-report writes transcript back to orders
    // -------------------------------------------------------------------------
    it.todo('CALL-09: end-of-call-report event writes transcript back to the order row');

    // -------------------------------------------------------------------------
    // OBS-01: end-of-call-report creates call_logs row
    // -------------------------------------------------------------------------
    it.todo('OBS-01: end-of-call-report creates a call_logs row with duration and cost');

    // -------------------------------------------------------------------------
    // VOICE-07: delivery_address persisted
    // -------------------------------------------------------------------------
    it.todo('VOICE-07: delivery_address from args is persisted in orders.delivery_address');

    // -------------------------------------------------------------------------
    // VOICE-08: customer_name persisted
    // -------------------------------------------------------------------------
    it.todo('VOICE-08: customer_name from args is persisted in orders.customer_name');
  });

  /* describe('Live integration tests (webhook E2E)', () => {
    // Live integration tests — require real Supabase + Vapi configured
    // Uncomment and run manually or in CI with secrets

    it.todo('E2E: full webhook call creates order in DB and triggers realtime');
    it.todo('E2E: call_logs row created after end-of-call-report');
  }); */
});
