// apps/frontend/src/hooks/useOnboardingResume.ts
// D-02: lee onboarding_step y devuelve el step inicial (0..3) o 4 si ya terminó.
// Three-state hook (undefined/null/value legend from auth.ts):
// - undefined = still loading
// - { error: string } = failed to fetch
// - { initialStep, hasRestaurant } = data loaded

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function useOnboardingResume() {
  const [state, setState] = useState<
    | { initialStep: number; hasRestaurant: boolean }
    | { error: string }
    | undefined  // loading
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    api.resumeOnboarding()
      .then((data) => {
        if (!cancelled) setState({ initialStep: data.onboarding_step, hasRestaurant: data.has_restaurant });
      })
      .catch((err) => {
        if (!cancelled) setState({ error: err.code ?? 'resume_failed' });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
