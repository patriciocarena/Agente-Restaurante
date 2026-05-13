import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from './api';

export type OnboardingState =
  | { status: 'loading' }
  | { status: 'pending' }       // user must complete wizard
  | { status: 'complete' }
  | { status: 'error'; code: string };

export function useOnboardingGuard(): OnboardingState {
  const [state, setState] = useState<OnboardingState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    api.resumeOnboarding()
      .then((data) => {
        if (cancelled) return;
        if (!data.has_restaurant || data.onboarding_step < 4) {
          setState({ status: 'pending' });
        } else {
          setState({ status: 'complete' });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'error', code: err instanceof ApiError ? err.code : 'guard_failed' });
      });
    return () => { cancelled = true; };
  }, []);
  return state;
}

// Wrap a post-wizard route. If guard pending → redirect to /onboarding.
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const guard = useOnboardingGuard();
  if (guard.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col gap-3 w-full max-w-sm animate-pulse">
          <div className="h-7 bg-card rounded" />
          <div className="h-4 bg-card rounded w-3/4" />
        </div>
      </div>
    );
  }
  if (guard.status === 'pending') return <Navigate to="/onboarding" replace />;
  // status === 'error' → allow access; the page will surface the error. We don't loop.
  return <>{children}</>;
}
