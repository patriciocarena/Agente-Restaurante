import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.MERCADO_PAGO_ACCESS_TOKEN ??= 'fake_for_test';
process.env.NODE_ENV = 'test';

let app: any;
beforeAll(async () => {
  app = (await import('../index')).default;
});

describe('CRUD /api/menu-categories (MENU-01)', () => {
  it.skip('creates a category under the authenticated restaurant', async () => {
    // Wired in Plan 02-03 — POST with RLS tenant check
    expect(true).toBe(true);
  });

  it.skip('lists categories for the restaurant ordered by sort_order', async () => {
    // Wired in Plan 02-03 — GET with RLS + sort
    expect(true).toBe(true);
  });

  it.skip('renames a category (PATCH)', async () => {
    // Wired in Plan 02-03 — PATCH with RLS validation
    expect(true).toBe(true);
  });

  it.skip('deletes a category (soft-delete via RLS)', async () => {
    // Wired in Plan 02-03 — DELETE with RLS + soft-delete flag
    expect(true).toBe(true);
  });
});

describe('DELETE cascades to menu_items (D-15)', () => {
  it.skip('when a category is deleted, its items are deleted via FK ON DELETE CASCADE', async () => {
    // Wired in Plan 02-03 — verify DB constraint behavior (migration 0002 provides this)
    expect(true).toBe(true);
  });
});
