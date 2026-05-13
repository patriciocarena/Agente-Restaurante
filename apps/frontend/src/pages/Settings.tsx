import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurantId, signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepOneData } from '@/components/onboarding/StepOneData';
import { StepTwoHours } from '@/components/onboarding/StepTwoHours';
import { StepThreeDelivery } from '@/components/onboarding/StepThreeDelivery';
import { StepFourVoice } from '@/components/onboarding/StepFourVoice';

export default function Settings() {
  const restaurantId = useRestaurantId();
  const navigate = useNavigate();

  useEffect(() => {
    if (restaurantId === null) {
      navigate('/onboarding', { replace: true });
    }
  }, [restaurantId, navigate]);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  if (restaurantId === undefined) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
          <span className="text-sm font-semibold">Configuración</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Cerrar sesión
          </Button>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="flex flex-col gap-3 w-full max-w-sm animate-pulse">
            <div className="h-7 bg-card rounded" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
        <span className="text-sm font-semibold">Configuración</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Cerrar sesión
        </Button>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-md py-lg">
        <h1 className="text-xl font-semibold mb-lg">Configuración</h1>

        <Tabs defaultValue="datos" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="datos">Datos</TabsTrigger>
            <TabsTrigger value="horario">Horario</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="agente">Agente</TabsTrigger>
            <TabsTrigger value="telefono">Teléfono</TabsTrigger>
          </TabsList>

          {/* Datos Tab */}
          <TabsContent value="datos" className="space-y-lg">
            <div className="bg-card p-lg rounded border border-border">
              <StepOneData />
              <Button className="mt-lg w-full">Guardar cambios</Button>
            </div>
          </TabsContent>

          {/* Horario Tab */}
          <TabsContent value="horario" className="space-y-lg">
            <div className="bg-card p-lg rounded border border-border">
              <StepTwoHours />
              <Button className="mt-lg w-full">Guardar cambios</Button>
            </div>
          </TabsContent>

          {/* Delivery Tab */}
          <TabsContent value="delivery" className="space-y-lg">
            <div className="bg-card p-lg rounded border border-border">
              <StepThreeDelivery />
              <Button className="mt-lg w-full">Guardar cambios</Button>
            </div>
          </TabsContent>

          {/* Agente Tab */}
          <TabsContent value="agente" className="space-y-lg">
            <div className="bg-card p-lg rounded border border-border">
              <StepFourVoice onFinish={async () => {}} />
              <Button className="mt-lg w-full">Guardar cambios</Button>
            </div>
          </TabsContent>

          {/* Teléfono Tab */}
          <TabsContent value="telefono" className="space-y-lg">
            <div className="bg-card p-lg rounded border border-border space-y-lg">
              <div>
                <h3 className="text-sm font-semibold mb-md">Tu número Twilio</h3>
                <div className="flex items-center gap-md p-md bg-background rounded border border-border">
                  <div className="text-sm font-semibold">+1-XXX-XXX-XXXX</div>
                </div>
              </div>
              <div>
                <Button variant="ghost" asChild>
                  <a href="https://docs.example.com/forwarding" target="_blank">
                    ¿Cómo desvío mi línea? Ver guía
                  </a>
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
