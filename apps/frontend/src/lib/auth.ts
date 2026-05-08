import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useSession(): Session | null | undefined {
  // undefined = still loading; null = signed out; Session = signed in
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return session;
}

// Returns the restaurant_id from the JWT app_metadata custom claim.
// undefined=loading, null=user has no restaurant yet (Pitfall 2), string=uuid.
export function useRestaurantId(): string | null | undefined {
  const session = useSession();
  if (session === undefined) return undefined;
  if (session === null) return null;
  const claim = (session.user.app_metadata as { restaurant_id?: string | null } | undefined)
    ?.restaurant_id;
  return claim ?? null;
}

export async function signOut() {
  await supabase.auth.signOut();
}
