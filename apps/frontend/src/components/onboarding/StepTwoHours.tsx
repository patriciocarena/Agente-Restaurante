// apps/frontend/src/components/onboarding/StepTwoHours.tsx
// Step 2: 7-day weekly schedule with Lun..Dom UI order mapped to ISO day_of_week storage.
// Each day: Switch for Cerrado/open + time inputs.

import { useFormContext } from 'react-hook-form';
import { OnboardingData, UI_LABELS, UI_INDEX_TO_ISO } from '@/lib/onboarding-schema';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

export function StepTwoHours() {
  const { register, watch, formState: { errors } } = useFormContext<OnboardingData>();
  const hours = watch('hours');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Horario de atención</h2>
        <p className="text-sm text-muted-foreground">
          Marcá los días que abrís y de qué hora a qué hora. Fuera de este horario,
          la agente avisa que están cerrados.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {UI_LABELS.map((label, uiIndex) => {
          const isoDay = UI_INDEX_TO_ISO[uiIndex];
          const formIndex = hours.findIndex((h) => h.day_of_week === isoDay);
          if (formIndex === -1) return null;

          const field = hours[formIndex];

          return (
            <div key={uiIndex} className="flex items-center gap-4 pb-4 border-b border-border last:border-b-0">
              <span className="w-12 text-sm font-semibold">{label}</span>

              <Switch
                {...register(`hours.${formIndex}.is_closed` as const)}
                checked={!field.is_closed}
                onCheckedChange={(checked) => {
                  const event = new Event('change', { bubbles: true });
                  Object.defineProperty(event, 'target', {
                    value: { checked: !checked },
                    enumerable: true,
                  });
                  register(`hours.${formIndex}.is_closed` as const).onChange?.(event);
                }}
                aria-label={`Abierto los ${label}`}
              />

              {field.is_closed ? (
                <span className="text-sm text-muted-foreground">Cerrado</span>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    {...register(`hours.${formIndex}.open_time` as const)}
                    type="time"
                    className="w-20"
                  />
                  <span className="text-muted-foreground text-sm">a</span>
                  <Input
                    {...register(`hours.${formIndex}.close_time` as const)}
                    type="time"
                    className="w-20"
                  />
                  {errors.hours?.[formIndex]?.close_time && (
                    <p className="text-xs text-destructive ml-2">
                      {errors.hours[formIndex]?.close_time?.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
