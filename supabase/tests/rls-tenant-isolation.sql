-- supabase/tests/rls-tenant-isolation.sql
-- Verifies AUTH-05 cross-tenant isolation. Run via Supabase Dashboard SQL Editor
-- as a privileged role; the script switches into the authenticated role and
-- impersonates two different tenants to prove RLS blocks cross-reads.
--
-- Expected output: every assertion query returns rows where expected = actual.
--
-- PREREQUISITES:
--   1. Migration 0001_initial_schema.sql has been applied successfully.
--   2. The Custom Access Token Hook is enabled in the Dashboard.
--   3. Run the SETUP block first, then note the printed rest_a and rest_b UUIDs.
--   4. Replace both occurrences of <REST_A_UUID> below with rest_a's UUID.
--   5. Replace both occurrences of <REST_B_UUID> below with rest_b's UUID.
--
-- HOW TO USE:
--   Run the entire script in SQL Editor. The SETUP block prints UUIDs via RAISE NOTICE.
--   Copy those UUIDs, substitute them into the assertion blocks, then re-run only
--   the assertion blocks.
--
-- CLEANUP:
--   The script includes a cleanup block that removes test rows. Run it after assertions.

-- =============================================================================
-- STEP 1: SETUP — insert two isolated tenants with test data
-- =============================================================================
-- Note: We insert directly into restaurants bypassing auth.users FK because
-- this is a test script only. In production, restaurants.owner_id must always
-- reference a real auth.users row.

DO $$
DECLARE
  user_a uuid := '00000000-0000-0000-0000-000000000aaa';
  user_b uuid := '00000000-0000-0000-0000-000000000bbb';
  rest_a uuid;
  rest_b uuid;
  cat_a uuid;
  cat_b uuid;
BEGIN
  -- Insert two test restaurants (bypassing auth.users FK for test purposes only)
  INSERT INTO restaurants (owner_id, name, slug)
    VALUES (user_a, 'Tenant A Test', 'tenant-a-test')
    RETURNING id INTO rest_a;

  INSERT INTO restaurants (owner_id, name, slug)
    VALUES (user_b, 'Tenant B Test', 'tenant-b-test')
    RETURNING id INTO rest_b;

  -- Insert categories for each tenant
  INSERT INTO menu_categories (restaurant_id, name)
    VALUES (rest_a, 'Hamburguesas A')
    RETURNING id INTO cat_a;

  INSERT INTO menu_categories (restaurant_id, name)
    VALUES (rest_b, 'Hamburguesas B')
    RETURNING id INTO cat_b;

  -- Insert menu items for each tenant
  INSERT INTO menu_items (restaurant_id, category_id, name, base_price)
    VALUES (rest_a, cat_a, 'Burger A', 5000);

  INSERT INTO menu_items (restaurant_id, category_id, name, base_price)
    VALUES (rest_b, cat_b, 'Burger B', 6000);

  -- Insert a counter row for each tenant
  INSERT INTO restaurant_counters (restaurant_id, last_order_number)
    VALUES (rest_a, 0);

  INSERT INTO restaurant_counters (restaurant_id, last_order_number)
    VALUES (rest_b, 0);

  RAISE NOTICE '=== TEST SETUP COMPLETE ===';
  RAISE NOTICE 'rest_a UUID = %', rest_a;
  RAISE NOTICE 'rest_b UUID = %', rest_b;
  RAISE NOTICE 'Copy these UUIDs and substitute into the assertion blocks below.';
END $$;

-- =============================================================================
-- STEP 2: ASSERTIONS — impersonate Tenant A, verify cross-tenant isolation
--
-- IMPORTANT: Replace <REST_A_UUID> with the rest_a UUID printed above.
--            Replace <REST_B_UUID> with the rest_b UUID printed above.
-- =============================================================================

-- Switch to authenticated role and impersonate Tenant A
SET ROLE authenticated;
SET request.jwt.claims = '{"app_metadata":{"restaurant_id":"<REST_A_UUID>"}}';

-- ASSERTION 1: Tenant A sees exactly 1 restaurant (its own)
-- Expected: count = 1 (not 2)
SELECT
  'ASSERTION 1 - restaurants visible to Tenant A' AS test,
  1 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM restaurants;

-- ASSERTION 2: Tenant A sees exactly 1 menu_category (its own)
-- Expected: count = 1 (not 2)
SELECT
  'ASSERTION 2 - menu_categories visible to Tenant A' AS test,
  1 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM menu_categories;

-- ASSERTION 3: Tenant A sees exactly 1 menu_item (its own)
-- Expected: count = 1 (not 2)
SELECT
  'ASSERTION 3 - menu_items visible to Tenant A' AS test,
  1 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM menu_items;

-- ASSERTION 4: Tenant A sees exactly 1 restaurant_counter (its own)
-- Expected: count = 1 (not 2)
SELECT
  'ASSERTION 4 - restaurant_counters visible to Tenant A' AS test,
  1 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM restaurant_counters;

-- ASSERTION 5: Tenant A cannot see Tenant B's restaurant by name
-- Expected: count = 0 (Tenant B's row is invisible)
SELECT
  'ASSERTION 5 - Tenant B restaurant is invisible to Tenant A' AS test,
  0 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM restaurants
WHERE name = 'Tenant B Test';

-- ASSERTION 6: Tenant A cannot see Tenant B's menu item
-- Expected: count = 0
SELECT
  'ASSERTION 6 - Tenant B menu_item is invisible to Tenant A' AS test,
  0 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM menu_items
WHERE name = 'Burger B';

-- Reset to default role, then impersonate Tenant B
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims = '{"app_metadata":{"restaurant_id":"<REST_B_UUID>"}}';

-- ASSERTION 7: Tenant B sees exactly 1 restaurant (its own)
SELECT
  'ASSERTION 7 - restaurants visible to Tenant B' AS test,
  1 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM restaurants;

-- ASSERTION 8: Tenant B cannot see Tenant A's restaurant
SELECT
  'ASSERTION 8 - Tenant A restaurant is invisible to Tenant B' AS test,
  0 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM restaurants
WHERE name = 'Tenant A Test';

-- ASSERTION 9: Tenant B sees exactly 1 menu_item (its own)
SELECT
  'ASSERTION 9 - menu_items visible to Tenant B' AS test,
  1 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM menu_items;

-- ASSERTION 10: Tenant B cannot see Tenant A's menu item
SELECT
  'ASSERTION 10 - Tenant A menu_item is invisible to Tenant B' AS test,
  0 AS expected,
  COUNT(*) AS actual,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM menu_items
WHERE name = 'Burger A';

-- =============================================================================
-- STEP 3: CLEANUP — reset role and remove test data
-- =============================================================================
RESET ROLE;

DELETE FROM restaurant_counters
  WHERE restaurant_id IN (
    SELECT id FROM restaurants WHERE name IN ('Tenant A Test', 'Tenant B Test')
  );

DELETE FROM menu_items
  WHERE name IN ('Burger A', 'Burger B');

DELETE FROM menu_categories
  WHERE name IN ('Hamburguesas A', 'Hamburguesas B');

DELETE FROM restaurants
  WHERE name IN ('Tenant A Test', 'Tenant B Test');

RAISE NOTICE '=== CLEANUP COMPLETE — test rows removed ===';

-- =============================================================================
-- EXPECTED OUTPUT (all rows should show result = 'PASS'):
--
-- | test                                               | expected | actual | result |
-- |----------------------------------------------------|----------|--------|--------|
-- | ASSERTION 1 - restaurants visible to Tenant A      |        1 |      1 | PASS   |
-- | ASSERTION 2 - menu_categories visible to Tenant A  |        1 |      1 | PASS   |
-- | ASSERTION 3 - menu_items visible to Tenant A       |        1 |      1 | PASS   |
-- | ASSERTION 4 - restaurant_counters visible to ...   |        1 |      1 | PASS   |
-- | ASSERTION 5 - Tenant B restaurant is invisible ... |        0 |      0 | PASS   |
-- | ASSERTION 6 - Tenant B menu_item is invisible ...  |        0 |      0 | PASS   |
-- | ASSERTION 7 - restaurants visible to Tenant B      |        1 |      1 | PASS   |
-- | ASSERTION 8 - Tenant A restaurant is invisible ... |        0 |      0 | PASS   |
-- | ASSERTION 9 - menu_items visible to Tenant B       |        1 |      1 | PASS   |
-- | ASSERTION 10 - Tenant A menu_item is invisible ... |        0 |      0 | PASS   |
-- =============================================================================
