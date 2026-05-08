import { createClient } from '@supabase/supabase-js';

// Solo VITE_ prefix. Estas variables van al bundle del browser.
// NUNCA agregar VITE_SUPABASE_SERVICE_ROLE_KEY (viola SEC-04 / D-05).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);
