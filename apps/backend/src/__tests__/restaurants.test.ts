import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Set required env BEFORE importing app so the env validator passes.
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.MERCADO_PAGO_ACCESS_TOKEN ??= 'fake_for_test';
process.env.NODE_ENV = 'test';

let app: any;
beforeAll(async () => {
  app = (await import('../index')).default;
});

describe('POST /api/restaurants', () => {
  it.skip('creates a new restaurant with owner_id from auth JWT', async () => {
    // Wired in Plan 02-02 — ONB-01 initial creation + slug validation
    expect(true).toBe(true);
  });

  it.skip('validates name and address are required', async () => {
    // Wired in Plan 02-02 — input validation gate
    expect(true).toBe(true);
  });

  it.skip('generates unique slug from name when slug collides', async () => {
    // Wired in Plan 02-02 — slug uniqueness + suffix logic
    expect(true).toBe(true);
  });
});

describe('POST /api/restaurants/me/hours (ONB-02)', () => {
  it.skip('batch upserts 7 day_of_week rows with open/close times', async () => {
    // Wired in Plan 02-02 — batch hours upsert
    expect(true).toBe(true);
  });
});

describe('PATCH /api/restaurants/me', () => {
  it.skip('rejects mass-assignment outside whitelist (agent_name, twilio_number)', async () => {
    // Wired in Plan 02-02 — input validation + mass-assignment protection
    expect(true).toBe(true);
  });
});
