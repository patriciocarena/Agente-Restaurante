-- 0003_phase3_vapi.sql
-- Phase 3 (Voice MVP Tier 1) — index para routear webhook por assistantId,
-- tabla call_logs (OBS-01), y RPC atómico para order_number per-tenant (CALL-08).
-- Apply via Supabase MCP apply_migration, or fall back to Supabase Dashboard SQL Editor (Phase 1/2 pattern).
-- Decisions touched: stack Tier 1 (Vapi), CALL-02 (call_id UNIQUE ya existe en orders), CALL-08 (counter RPC), OBS-01 (call_logs).

-- =============================================================================
-- SECTION: restaurants — index para lookup por vapi_assistant_id
-- Cada webhook tool-calls busca restaurants por vapi_assistant_id. Sin index = seq scan por llamada.
-- La columna vapi_assistant_id YA EXISTE (0001 línea 22). Acá solo el index.
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_restaurants_vapi_assistant_id
  ON restaurants(vapi_assistant_id)
  WHERE vapi_assistant_id IS NOT NULL;

-- =============================================================================
-- SECTION: call_logs — registro de cada llamada (OBS-01)
-- Separada de orders: una llamada puede existir sin crear pedido (fuera de horario, errores).
-- =============================================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants NOT NULL,
  call_id text UNIQUE NOT NULL,
  order_id uuid REFERENCES orders,
  duration_seconds int,
  cost_usd numeric(10, 6),
  transcript text,
  ended_reason text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON call_logs FOR ALL TO authenticated
  USING (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid)
  WITH CHECK (restaurant_id = (auth.jwt()->'app_metadata'->>'restaurant_id')::uuid);

-- =============================================================================
-- SECTION: increment_order_counter — RPC atómico per-tenant (CALL-08)
-- Supabase JS SDK no soporta column = column + 1; usamos un RPC SQL.
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_order_counter(p_restaurant_id uuid)
RETURNS int AS $$
  UPDATE restaurant_counters
  SET last_order_number = last_order_number + 1
  WHERE restaurant_id = p_restaurant_id
  RETURNING last_order_number;
$$ LANGUAGE sql;

-- =============================================================================
-- SECTION: verificación (correr en SQL Editor para confirmar)
-- =============================================================================
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_restaurants_vapi_assistant_id';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'call_logs' ORDER BY ordinal_position;
-- SELECT proname FROM pg_proc WHERE proname = 'increment_order_counter';
