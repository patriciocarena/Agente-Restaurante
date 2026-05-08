import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/lib/auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session === undefined) {
    // Loading state — render minimal placeholder to avoid flicker.
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;
  }
  if (session === null) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
