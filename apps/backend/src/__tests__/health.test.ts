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

describe('GET /health', () => {
  it('returns 200 with status ok and an ISO timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.ts).toBe('string');
    expect(() => new Date(res.body.ts).toISOString()).not.toThrow();
  });
});
