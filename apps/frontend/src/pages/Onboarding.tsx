import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth';

// Placeholder de Phase 1. La configuración real (menú, horarios, delivery,
// número de teléfono Twilio) se implementa en Phase 2.
export default function Onboarding() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
        <span className="text-sm font-semibold">Agente Restaurante</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Cerrar sesión
        </Button>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-sm flex flex-col gap-4">
          <h1 className="text-2xl font-semibold text-foreground">
            Configurá tu restaurante
          </h1>
          <p className="text-muted-foreground text-sm">
            Esta sección estará disponible próximamente. Acá vas a poder cargar tu
            menú, horarios, datos de delivery y conectar tu número de teléfono.
          </p>
          <Button variant="ghost" asChild>
            <Link to="/dashboard">Volver al panel</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
