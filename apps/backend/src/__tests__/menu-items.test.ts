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

describe('CRUD /api/menu-items (MENU-02)', () => {
  it.skip('creates a menu item under a category with base_price and description', async () => {
    // Wired in Plan 02-03 — POST with category FK validation
    expect(true).toBe(true);
  });

  it.skip('lists items for a category', async () => {
    // Wired in Plan 02-03 — GET ordered by sort_order
    expect(true).toBe(true);
  });

  it.skip('updates item fields (name, description, base_price)', async () => {
    // Wired in Plan 02-03 — PATCH with RLS tenant check
    expect(true).toBe(true);
  });

  it.skip('deletes an item', async () => {
    // Wired in Plan 02-03 — DELETE with RLS
    expect(true).toBe(true);
  });
});

describe('Nested option_groups / option_items (MENU-03)', () => {
  it.skip('creates option groups under a menu item', async () => {
    // Wired in Plan 02-04 — POST /api/menu-items/:id/option-groups
    expect(true).toBe(true);
  });

  it.skip('deletes an option group and cascades to option_items via FK ON DELETE CASCADE', async () => {
    // Wired in Plan 02-04 — DELETE with cascade (migration 0002 provides DB constraint)
    expect(true).toBe(true);
  });
});

describe('PATCH /api/menu-items/:id/availability (MENU-04)', () => {
  it.skip('toggles available boolean and publishes via Supabase Realtime', async () => {
    // Wired in Plan 02-05 — Realtime publication triggers client update
    expect(true).toBe(true);
  });

  it.skip('tenant isolation: request restaurant_id must match item.restaurant_id', async () => {
    // Wired in Plan 02-05 — RLS validation + malicious request rejection
    expect(true).toBe(true);
  });
});
