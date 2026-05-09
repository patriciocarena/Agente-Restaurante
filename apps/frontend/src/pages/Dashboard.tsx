import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut, useRestaurantId } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const navigate = useNavigate();
  const restaurantId = useRestaurantId();

  // Si el usuario está autenticado pero no tiene restaurante asociado (claim null),
  // mandarlo directamente a onboarding.
  useEffect(() => {
    if (restaurantId === null) {
      navigate('/onboarding', { replace: true });
    }
  }, [restaurantId, navigate]);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
        <span className="text-sm font-semibold">Agente Restaurante</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Cerrar sesión
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4">
        {restaurantId === undefined ? (
          // Loading — todavía resolviendo el JWT
          <div className="flex flex-col gap-3 w-full max-w-sm animate-pulse">
            <div className="h-7 bg-card rounded" />
            <div className="h-4 bg-card rounded w-3/4" />
            <div className="h-10 bg-card rounded" />
          </div>
        ) : restaurantId === null ? (
          // Redirigiendo a onboarding (el useEffect lo maneja)
          <div className="flex flex-col gap-3 w-full max-w-sm animate-pulse">
            <div className="h-7 bg-card rounded" />
          </div>
        ) : (
          // Usuario con restaurante configurado
          <div className="text-center max-w-sm flex flex-col gap-4">
            <h1 className="text-2xl font-semibold text-foreground">
              Bienvenido a Agente Restaurante
            </h1>
            <p className="text-muted-foreground text-sm">
              Tu workspace está listo. Configurá tu restaurante para empezar a tomar pedidos.
            </p>
            <Button asChild className="w-full">
              <Link to="/onboarding">Configurar restaurante</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
