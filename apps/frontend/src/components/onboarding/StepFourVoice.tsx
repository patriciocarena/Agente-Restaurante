// apps/frontend/src/components/onboarding/StepFourVoice.tsx
// Step 4: agent_name input (default 'Sofía') with finish trigger button.

import { useFormContext } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { OnboardingData } from '@/lib/onboarding-schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface StepFourVoiceProps {
  onFinish: () => Promise<void>;
  isLoading?: boolean;
}

export function StepFourVoice({ onFinish, isLoading = false }: StepFourVoiceProps) {
  const { register, trigger, formState: { errors } } = useFormContext<OnboardingData>();

  const handleFinish = async () => {
    const valid = await trigger(['agent_name']);
    if (valid) {
      await onFinish();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Nombre de tu agente</h2>
        <p className="text-sm text-muted-foreground">
          Es el nombre con que la agente se presenta al atender. Por defecto se
          llama Sofía — podés ponerle el que quieras.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="agent_name" className="text-sm font-medium">
            Nombre del agente
          </label>
          <Input
            {...register('agent_name')}
            id="agent_name"
          />
          {errors.agent_name && (
            <p className="text-xs text-destructive">{errors.agent_name.message}</p>
          )}
        </div>

        <Button
          onClick={handleFinish}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Asignando tu número… esto tarda unos segundos.
            </>
          ) : (
            'Terminar y conectar teléfono'
          )}
        </Button>
      </div>
    </div>
  );
}
