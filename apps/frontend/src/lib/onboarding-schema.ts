// apps/frontend/src/lib/onboarding-schema.ts
// Master Zod schema para el wizard de onboarding con validación per-step.
// Utilizamos el mismo patrón que react-hook-form: un único schema que combina
// todos los pasos, con STEP_FIELDS para validar subsets en cada transición.

import { z } from 'zod';

// Celular AR en cualquiera de sus formas usuales (mismas reglas que el backend:
// lib/whatsapp.ts normalizeArWhatsApp). Acepta +549..., 549..., +54..., 0..15..,
// área+abonado de 10 dígitos.
function isValidArMobile(cleaned: string): boolean {
  let digits = cleaned.replace(/^\+/, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (/^549\d{10}$/.test(digits)) return true;
  if (/^54\d{10}$/.test(digits)) return true;
  if (/^\d{10}$/.test(digits)) return true;
  if (/^\d{12}$/.test(digits)) {
    return [2, 3, 4].some((areaLen) => digits.slice(areaLen, areaLen + 2) === '15');
  }
  return false;
}

// D-01: orden y campos del wizard. D-03: validación per-step con Zod.
export const onboardingSchema = z.object({
  name: z.string()
    .min(2, 'El nombre tiene que tener al menos 2 caracteres.'),
  slug: z.string()
    .min(2, 'El nombre tiene que tener al menos 2 caracteres.')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones.'),
  address: z.string()
    .min(5, 'Poné la dirección completa.'),
  // WhatsApp para recibir pedidos (pivot Fase 4). Opcional; siempre celular AR.
  // El backend re-normaliza — acá solo limpiamos y validamos formato amigable.
  whatsapp_number: z.string()
    .transform((v) => v.replace(/[\s\-().]/g, ''))
    .refine(
      (v) => v === '' || isValidArMobile(v),
      'Número de celular argentino, ej: 351 1234567',
    )
    .optional(),
  delivery_zones: z.string().optional(),
  agent_name: z.string().min(1, 'Este campo es obligatorio.'),
  hours: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    open_time: z.string().nullable(),
    close_time: z.string().nullable(),
    is_closed: z.boolean(),
  })).length(7).superRefine((rows, ctx) => {
    // Per UI-SPEC line 264: cierre debe ser después de apertura cuando el día está abierto.
    rows.forEach((r, idx) => {
      if (!r.is_closed && r.open_time && r.close_time && r.close_time <= r.open_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [idx, 'close_time'],
          message: 'El horario de cierre tiene que ser después del de apertura.',
        });
      }
    });
  }),
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

// Per-step trigger() field arrays (D-03).
// Cada elemento corresponde a los campos a validar en ese paso.
export const STEP_FIELDS: Array<Array<keyof OnboardingData>> = [
  ['name', 'slug', 'address', 'whatsapp_number'],
  ['hours'],
  ['delivery_zones'],
  ['agent_name'],
];

// UI displays Lun..Dom (AR convention) but DB stores ISO day_of_week (0=Sunday).
// PATTERNS finding 3 / UI-SPEC line 164.
export const UI_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
export const UI_INDEX_TO_ISO = [1, 2, 3, 4, 5, 6, 0] as const;

// Default hours seed (used in defaultValues): 11:00–23:00 every day, none closed.
// Mapea el orden de UI_INDEX_TO_ISO al almacenamiento ISO en el DB.
export const DEFAULT_HOURS = UI_INDEX_TO_ISO.map((iso) => ({
  day_of_week: iso,
  open_time: '11:00',
  close_time: '23:00',
  is_closed: false,
}));
