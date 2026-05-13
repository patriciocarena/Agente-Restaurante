// apps/frontend/src/components/onboarding/StepThreeDelivery.tsx
// Step 3: Free-text delivery zones textarea.

import { useFormContext } from 'react-hook-form';
import { OnboardingData } from '@/lib/onboarding-schema';
import { Textarea } from '@/components/ui/textarea';

export function StepThreeDelivery() {
  const { register, formState: { errors } } = useFormContext<OnboardingData>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Zonas de delivery</h2>
        <p className="text-sm text-muted-foreground">
          Escribí las zonas que cubrís, separadas por coma. La agente las usa para
          confirmar al cliente si llegan a su dirección.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          {...register('delivery_zones')}
          placeholder="Villa Allende centro, Argüello, Saldán"
        />
        {errors.delivery_zones && (
          <p className="text-xs text-destructive">{errors.delivery_zones.message}</p>
        )}
      </div>
    </div>
  );
}
