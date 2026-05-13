import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.MERCADO_PAGO_ACCESS_TOKEN ??= 'fake_for_test';
process.env.TWILIO_DEFAULT_AREA_CODE ??= '415';
process.env.NODE_ENV = 'test';

// Mock Twilio before importing app
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    incomingPhoneNumbers: {
      create: vi.fn().mockResolvedValue({
        phoneNumber: '+14155551234',
        sid: 'PNxxxxx',
      }),
    },
    availablePhoneNumbers: () => ({
      local: {
        list: vi.fn().mockResolvedValue([]),
      },
    }),
  })),
}));

let app: any;
beforeAll(async () => {
  app = (await import('../index')).default;
});

describe('provisionUsForwardingNumber (ONB-04, D-05/D-06)', () => {
  it.skip('successfully provisions a Twilio number in the default area code', async () => {
    // Wired in Plan 02-02 — provision logic + DB storage in twilio_number / twilio_phone_sid
    expect(true).toBe(true);
  });

  it.skip('retries on Twilio API failure (e.g., rate limit)', async () => {
    // Wired in Plan 02-02 — exponential backoff or circuit breaker
    expect(true).toBe(true);
  });

  it.skip('validates TWILIO_DEFAULT_AREA_CODE env var is set', async () => {
    // Wired in Plan 02-02 — env validation gate before provisioning
    expect(true).toBe(true);
  });
});
