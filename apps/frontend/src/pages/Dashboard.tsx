import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut, useRestaurantId } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const restaurantId = useRestaurantId();
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Si el usuario está autenticado pero no tiene restaurante asociado (claim null),
  // mandarlo directamente a onboarding.
  useEffect(() => {
    if (restaurantId === null) {
      navigate('/onboarding', { replace: true });
    }
  }, [restaurantId, navigate]);

  // Cargar datos del restaurante (Twilio number, etc.)
  useEffect(() => {
    if (restaurantId && typeof restaurantId === 'string') {
      setLoadingData(true);
      api.getMe()
        .then((data) => {
          setRestaurantData(data);
          setLoadingData(false);
        })
        .catch(() => {
          setLoadingData(false);
        });
    }
  }, [restaurantId]);

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
          // Plan 02-06: Twilio number + CTAs to /menu and /settings (D-04, D-08, MENU-01..04)
          <div className="text-center max-w-sm flex flex-col gap-4">
            <h1 className="text-2xl font-semibold text-foreground">
              Tu restaurante está configurado
            </h1>

            {loadingData || !restaurantData ? (
              // Skeleton while loading restaurant data
              <div className="flex flex-col gap-3">
                <div className="h-8 bg-card rounded-full mx-auto w-48 animate-pulse" />
                <div className="h-4 bg-card rounded w-3/4 mx-auto animate-pulse" />
              </div>
            ) : (
              <>
                {/* Twilio number pill */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border mx-auto">
                  <Phone size={14} />
                  <span className="text-sm font-semibold">
                    {restaurantData.restaurant?.twilio_number || 'Sin número asignado'}
                  </span>
                </div>

                {/* Forwarding docs link */}
                <a
                  href={restaurantData.restaurant?.forwarding_docs_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  ¿Cómo desvío mi línea? Ver guía
                </a>
              </>
            )}

            {/* CTAs */}
            <div className="flex flex-col gap-2 pt-4">
              <Button asChild className="w-full">
                <Link to="/menu">Cargar tu menú</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/settings">Configuración</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
