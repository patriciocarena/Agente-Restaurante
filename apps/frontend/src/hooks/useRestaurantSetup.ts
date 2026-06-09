// apps/frontend/src/hooks/useRestaurantSetup.ts
// Mutation helpers con orquestación de refreshSession (Pitfall 1).
// Expone funciones que manejan la carga y los errores de forma consistente.

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { api, ApiError } from '@/lib/api';

export function useRestaurantSetup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setLoading(true); setError(null);
    try { return await fn(); }
    catch (e) {
      if (e instanceof ApiError) {
        const detail = e.details ? ` — ${JSON.stringify(e.details)}` : '';
        setError(`${e.code} (${e.status})${detail}`);
      } else {
        setError(`network_error — ${String(e)}`);
      }
      // eslint-disable-next-line no-console
      console.error('[DIAG] useRestaurantSetup error:', e);
      throw e;
    }
    finally { setLoading(false); }
  }

  return {
    loading, error,
    // Step 1 submit. CRITICAL: refreshSession() AFTER create so JWT carries restaurant_id (Pitfall 1).
    async createRestaurant(body: { name: string; address: string }) {
      const result = await run(() => api.createRestaurant(body));
      if (result) {
        await supabase.auth.refreshSession();
      }
      return result;
    },
    putHours: (rows: Parameters<typeof api.putHours>[0]['hours']) => run(() => api.putHours({ hours: rows })),
    patchMe: (body: Parameters<typeof api.patchMe>[0]) => run(() => api.patchMe(body)),
    finishOnboarding: () => run(() => api.finishOnboarding()),
    retryProvision: () => run(() => api.retryProvision()),
  };
}
