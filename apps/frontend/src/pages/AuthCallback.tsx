import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      const { error: authError } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );
      if (authError) {
        setError('Algo salió mal. Intentá de nuevo o contactanos si el problema persiste.');
        return;
      }
      navigate('/dashboard', { replace: true });
    }
    handleCallback();
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
