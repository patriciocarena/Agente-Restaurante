-- 0001_initial_schema.sql
-- Phase 1 (Foundations) — multi-tenant schema + RLS + Custom Access Token Hook.
-- Apply via Supabase Dashboard SQL Editor (no CLI available, RESEARCH.md A3).
-- Enable the hook in Dashboard -> Authentication -> Hooks after running this file.
-- Decisions: D-02 (menu schema), D-03 (hook approach), D-04 (RLS expression),
-- D-06 (no pgcrypto; AES-256 at rest is enough), D-07 (PII no-log policy),
-- D-08 (restaurant_counters), D-09 (subscriptions).

-- =============================================================================
-- TABLE: restaurants
-- Root table — one row per tenant. owner_id links to Supabase auth.users.
-- UNIQUE on owner_id enforces one restaurant per user account in v1.
-- =============================================================================
CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  name text NOT NULL,
  slug text UNIQUE,
  address text,
  phone text,
  agent_name text DEFAULT 'Sofía',
  vapi_assistant_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users only see their own restaurant row.
-- Uses id = ... (not restaurant_id =) because restaurants IS the root table.
CREATE POLICY "tenant_isolation" ON restaurants FOR ALL TO authenticated
  USING (id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- TABLE: menu_categories
-- Organizes menu items into sections (e.g., Hamburguesas, Papas, Bebidas).
-- =============================================================================
CREATE TABLE menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  name text NOT NULL,
  sort_order int DEFAULT 0
);

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON menu_categories FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- TABLE: menu_items
-- D-02: base_price is NULLABLE. When NULL, the item price is determined by
-- the selected option_item.price_delta (e.g., "Hamburguesa Veggie — elegí Mixta
-- o Garbanzos"). This models Wonder Hamburguesería's real menu structure.
-- =============================================================================
CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  category_id uuid REFERENCES menu_categories,
  name text NOT NULL,
  description text,
  base_price int,  -- nullable: null = precio determinado por option_items (D-02)
  available boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON menu_items FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- TABLE: option_groups
-- Groups of selectable options for a menu item (e.g., "Elegí tu bebida").
-- min_selections / max_selections model cardinality (e.g., "elegí hasta 8 toppings").
-- NOTE: No direct restaurant_id — tenant isolation via JOIN to menu_items (see RLS below).
-- =============================================================================
CREATE TABLE option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid REFERENCES menu_items NOT NULL,
  name text NOT NULL,
  min_selections int DEFAULT 0,   -- 0 = optional
  max_selections int DEFAULT 1,   -- 1 = pick exactly one
  sort_order int DEFAULT 0
);

ALTER TABLE option_groups ENABLE ROW LEVEL SECURITY;

-- RLS via JOIN: option_groups has no restaurant_id column, so we check through
-- menu_items. This is the correct isolation pattern for child tables (Pitfall 5).
CREATE POLICY "tenant_isolation" ON option_groups FOR ALL TO authenticated
  USING (
    menu_item_id IN (
      SELECT id FROM menu_items
      WHERE restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
    )
  )
  WITH CHECK (
    menu_item_id IN (
      SELECT id FROM menu_items
      WHERE restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
    )
  );

-- =============================================================================
-- TABLE: option_items
-- Individual selectable options within a group (e.g., "Mixta", "Garbanzos").
-- price_delta: positive = surcharge, negative = discount, used as absolute price
-- when parent menu_item.base_price is NULL.
-- NOTE: No direct restaurant_id — tenant isolation via double-JOIN (see RLS below).
-- =============================================================================
CREATE TABLE option_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id uuid REFERENCES option_groups NOT NULL,
  name text NOT NULL,
  price_delta int DEFAULT 0,       -- can be absolute price when base_price is null
  is_default boolean DEFAULT false,
  sort_order int DEFAULT 0
);

ALTER TABLE option_items ENABLE ROW LEVEL SECURITY;

-- RLS via double-JOIN: option_items -> option_groups -> menu_items -> restaurant_id.
CREATE POLICY "tenant_isolation" ON option_items FOR ALL TO authenticated
  USING (
    option_group_id IN (
      SELECT og.id FROM option_groups og
      JOIN menu_items mi ON mi.id = og.menu_item_id
      WHERE mi.restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
    )
  )
  WITH CHECK (
    option_group_id IN (
      SELECT og.id FROM option_groups og
      JOIN menu_items mi ON mi.id = og.menu_item_id
      WHERE mi.restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid
    )
  );

-- =============================================================================
-- TABLE: orders
-- One row per phone call that resulted in an order.
-- call_id UNIQUE enforces idempotency — Vapi retries won't create duplicate orders
-- (CALL-02 prerequisite).
-- customer_phone is PII under Ley 25.326 AR. See D-07 for no-log policy.
-- =============================================================================
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  order_number int NOT NULL,
  status text DEFAULT 'NUEVO',         -- NUEVO|EN_PREPARACION|LISTO|ENTREGADO
  customer_name text,
  customer_phone text,                 -- PII: D-07, never log
  fulfillment_type text NOT NULL,      -- 'retiro' | 'delivery'
  delivery_address text,
  call_id text UNIQUE,                 -- idempotencia (CALL-02)
  transcript text,
  total int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON orders FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- TABLE: order_items
-- Line items within an order. restaurant_id is denormalized here for RLS
-- (avoids an extra JOIN through orders in the policy).
-- =============================================================================
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders NOT NULL,
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  menu_item_id uuid REFERENCES menu_items,
  name text NOT NULL,
  quantity int NOT NULL,
  unit_price int NOT NULL,
  modifiers jsonb DEFAULT '[]',
  note text
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON order_items FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- TABLE: restaurant_counters
-- D-08: Per-tenant order number counter. Using UPDATE + RETURNING is safer than
-- serial (which is global, not per-tenant). The backend increments atomically:
--   UPDATE restaurant_counters SET last_order_number = last_order_number + 1
--   WHERE restaurant_id = $1 RETURNING last_order_number
-- UNIQUE on restaurant_id ensures one counter row per tenant.
-- =============================================================================
CREATE TABLE restaurant_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL UNIQUE,
  last_order_number int DEFAULT 0
);

ALTER TABLE restaurant_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON restaurant_counters FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- TABLE: restaurant_hours
-- Weekly schedule. day_of_week follows ISO convention: 0=Dom, 1=Lun, ..., 6=Sab.
-- The voice agent checks this to reject calls outside business hours.
-- =============================================================================
CREATE TABLE restaurant_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  day_of_week int NOT NULL,  -- 0=Dom, 1=Lun, ..., 6=Sab
  open_time time,
  close_time time,
  is_closed boolean DEFAULT false
);

ALTER TABLE restaurant_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON restaurant_hours FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- TABLE: subscriptions
-- D-09: Created in Phase 1 so Phase 5 (Billing) can write without a new migration.
-- mp_preapproval_id: Mercado Pago preapproval ID for recurring subscription.
-- status enum: trial|active|past_due|suspended|cancelled
-- UNIQUE on restaurant_id: one active subscription record per tenant.
-- =============================================================================
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL UNIQUE,
  mp_preapproval_id text,
  status text DEFAULT 'trial',         -- trial|active|past_due|suspended|cancelled
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON subscriptions FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- CUSTOM ACCESS TOKEN HOOK (D-03)
-- Injects restaurant_id into app_metadata of the JWT at token mint time.
-- This is the official Supabase hook approach (available on free plan as of 2024).
-- NOT a Postgres trigger — the hook runs in Supabase Auth, not in the DB layer.
--
-- How it works:
--   1. User logs in -> Supabase Auth calls this function before issuing the JWT.
--   2. The function looks up which restaurant the user owns (if any).
--   3. It writes restaurant_id into app_metadata.
--   4. The JWT now contains: { app_metadata: { restaurant_id: "<uuid>" } }
--   5. RLS policies read auth.jwt()->'app_metadata'->>'restaurant_id' to filter rows.
--
-- First login (no restaurant yet): restaurant_id = null in the claim.
-- Frontend must redirect to onboarding if restaurant_id is null (Pitfall 2).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_restaurant_id uuid;
BEGIN
  claims := event->'claims';

  -- Look up the restaurant owned by this user
  SELECT id INTO v_restaurant_id
  FROM public.restaurants
  WHERE owner_id = (event->>'user_id')::uuid
  LIMIT 1;

  -- Ensure app_metadata object exists in claims
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- Inject restaurant_id (null when user has no restaurant yet)
  -- The frontend handles null by redirecting to onboarding flow (Pitfall 2)
  IF v_restaurant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,restaurant_id}', to_jsonb(v_restaurant_id));
  ELSE
    claims := jsonb_set(claims, '{app_metadata,restaurant_id}', 'null');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Permissions: only supabase_auth_admin (Supabase internal role) may execute this
-- function and read the restaurants table for the hook lookup.
-- Revoke from regular authenticated/anon roles to prevent unauthorized invocation.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT ALL ON TABLE public.restaurants TO supabase_auth_admin;
REVOKE ALL ON TABLE public.restaurants FROM authenticated, anon, public;

-- =============================================================================
-- Coverage:
-- AUTH-05 (RLS on 10 tables): restaurants, menu_categories, menu_items,
--   option_groups, option_items, orders, order_items, restaurant_counters,
--   restaurant_hours, subscriptions — all have ENABLE ROW LEVEL SECURITY and
--   a "tenant_isolation" policy.
-- AUTH-06 (custom_access_token_hook injects restaurant_id into JWT app_metadata)
-- SEC-05 (no pgcrypto column-level — relying on Supabase AES-256 at rest per D-06;
--   customer_phone column carries no-log policy enforced by D-07 in application code)
-- =============================================================================
