import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      // Path 1 — PKCE flow (default en supabase-js v2):
      // Supabase redirige a /auth/callback?code=xxx. exchangeCodeForSession
      // espera SOLO el code (no la URL completa).
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError('Algo salió mal. Intentá de nuevo o contactanos si el problema persiste.');
          return;
        }
        navigate('/dashboard', { replace: true });
        return;
      }

      // Path 2 — implicit flow / hash fragment:
      // Supabase auto-detecta #access_token=... antes de que monte este componente.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        navigate('/dashboard', { replace: true });
        return;
      }

      setError('Algo salió mal. Intentá de nuevo o contactanos si el problema persiste.');
    }

    handleCallback();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <Link to="/login" className="text-sm text-primary underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm">Verificando…</p>
    </div>
  );
}
