import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestTenant, destroyTestTenant, type TestTenant } from './rls.helpers';

const RUN_LIVE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY);
const describeLive = RUN_LIVE ? describe : describe.skip;

describeLive('AUTH-05 / AUTH-06 RLS tenant isolation (live)', () => {
  let A: TestTenant;
  let B: TestTenant;

  beforeAll(async () => {
    A = await createTestTenant('rls-a');
    B = await createTestTenant('rls-b');
    await A.anonClient.from('menu_items').insert({ restaurant_id: A.restaurantId, name: 'Burger A', base_price: 5000 });
    await B.anonClient.from('menu_items').insert({ restaurant_id: B.restaurantId, name: 'Burger B', base_price: 6000 });
  }, 60_000);

  afterAll(async () => {
    if (A) await destroyTestTenant(A);
    if (B) await destroyTestTenant(B);
  }, 60_000);

  it('AUTH-06: tenant A JWT carries restaurant_id in app_metadata', async () => {
    const { data } = await A.anonClient.auth.getSession();
    const claim = (data.session?.user.app_metadata as { restaurant_id?: string })?.restaurant_id;
    expect(claim).toBe(A.restaurantId);
  });

  it('AUTH-05 restaurants: tenant A sees only its own row', async () => {
    const { data, error } = await A.anonClient.from('restaurants').select('id');
    expect(error).toBeNull();
    expect(data?.map(r => r.id)).toEqual([A.restaurantId]);
  });

  it('AUTH-05 menu_items: tenant A cannot see tenant B menu_items', async () => {
    const { data } = await A.anonClient.from('menu_items').select('id, name');
    expect(data?.find(r => r.name === 'Burger B')).toBeUndefined();
    expect(data?.find(r => r.name === 'Burger A')).toBeDefined();
  });

  it('AUTH-05 menu_items: tenant A INSERT into tenant B fails (WITH CHECK)', async () => {
    const { error } = await A.anonClient
      .from('menu_items')
      .insert({ restaurant_id: B.restaurantId, name: 'Hijack', base_price: 1 });
    expect(error).not.toBeNull();
  });

  it('AUTH-05 orders, counters, hours, subscriptions all isolated', async () => {
    for (const table of ['orders', 'restaurant_counters', 'restaurant_hours', 'subscriptions']) {
      const { data, error } = await A.anonClient.from(table).select('restaurant_id');
      expect(error).toBeNull();
      const allMine = (data ?? []).every(r => r.restaurant_id === A.restaurantId);
      expect(allMine).toBe(true);
    }
  });
});
