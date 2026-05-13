// apps/frontend/src/components/onboarding/StepOneData.tsx
// Step 1: capture nombre, slug (auto-derived), dirección.
// Slug auto-derives from name but can be manually edited; once touched by user, freezes auto-derivation.

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import slugify from 'slugify';
import { OnboardingData } from '@/lib/onboarding-schema';
import { Input } from '@/components/ui/input';

export function StepOneData() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<OnboardingData>();
  const [slugTouched, setSlugTouched] = useState(false);
  const name = watch('name');
  const slug = watch('slug');

  // Auto-derive slug from name on name blur or first slug focus (whichever first)
  useEffect(() => {
    if (!slugTouched && name) {
      const derived = slugify(name, { lower: true, strict: true, locale: 'es' });
      if (derived !== slug) {
        setValue('slug', derived);
      }
    }
  }, [name, slug, slugTouched, setValue]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Datos del restaurante</h2>
        <p className="text-sm text-muted-foreground">
          Estos datos los va a usar la agente cuando atienda a tus clientes.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Nombre del restaurante
          </label>
          <Input
            {...register('name')}
            id="name"
            placeholder="Wonder Hamburguesería"
            onBlur={(e) => {
              register('name').onBlur?.(e);
              if (!slugTouched && name) {
                const derived = slugify(name, { lower: true, strict: true, locale: 'es' });
                setValue('slug', derived);
              }
            }}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="slug" className="text-sm font-medium">
            Identificador (URL)
          </label>
          <Input
            {...register('slug')}
            id="slug"
            placeholder="wonder-hamburguesias"
            onFocus={() => !slugTouched && setSlugTouched(true)}
            onChange={(e) => {
              register('slug').onChange?.(e);
              setSlugTouched(true);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Se genera automático desde el nombre. Lo podés editar.
          </p>
          {errors.slug && (
            <p className="text-xs text-destructive">{errors.slug.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="address" className="text-sm font-medium">
            Dirección
          </label>
          <Input
            {...register('address')}
            id="address"
            placeholder="Av. Goyeneche 1234, Villa Allende, Córdoba"
          />
          {errors.address && (
            <p className="text-xs text-destructive">{errors.address.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
