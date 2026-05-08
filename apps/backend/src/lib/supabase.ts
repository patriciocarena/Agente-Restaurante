// apps/backend/src/lib/supabase.ts
// Service role key: bypassea RLS — solo para operaciones admin del backend.
// NUNCA exponer al frontend — ver SEC-04. Naming intentionally `supabaseAdmin` so every
// call site reads as a privileged operation.
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
