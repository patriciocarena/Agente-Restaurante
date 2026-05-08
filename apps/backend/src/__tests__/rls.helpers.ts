import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;

export interface TestTenant {
  userId: string;
  restaurantId: string;
  email: string;
  anonClient: SupabaseClient;
}

export async function createTestTenant(prefix: string): Promise<TestTenant> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.invalid`;
  const password = 'TestPass123!';

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr || !userData.user) throw userErr ?? new Error('createUser failed');

  const { data: restData, error: restErr } = await admin
    .from('restaurants')
    .insert({ owner_id: userData.user.id, name: `${prefix} Test Restaurant` })
    .select('id')
    .single();
  if (restErr || !restData) throw restErr ?? new Error('insert restaurant failed');

  // Sign the user in via anon client to receive a JWT carrying the restaurant_id claim
  // (the Custom Access Token Hook reads the restaurant we just inserted).
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  return { userId: userData.user.id, restaurantId: restData.id, email, anonClient };
}

export async function destroyTestTenant(t: TestTenant) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  // Cascade order: child tables first, then restaurants, then auth.user.
  await admin.from('menu_items').delete().eq('restaurant_id', t.restaurantId);
  await admin.from('orders').delete().eq('restaurant_id', t.restaurantId);
  await admin.from('restaurant_counters').delete().eq('restaurant_id', t.restaurantId);
  await admin.from('restaurant_hours').delete().eq('restaurant_id', t.restaurantId);
  await admin.from('subscriptions').delete().eq('restaurant_id', t.restaurantId);
  await admin.from('menu_categories').delete().eq('restaurant_id', t.restaurantId);
  await admin.from('restaurants').delete().eq('id', t.restaurantId);
  await admin.auth.admin.deleteUser(t.userId);
}
