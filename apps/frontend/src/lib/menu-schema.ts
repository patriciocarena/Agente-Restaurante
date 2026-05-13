import { z } from 'zod';

// D-10: item modal fields + cardinality.
export const optionItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Este campo es obligatorio.'),
  price_delta: z.number().int(),
  is_default: z.boolean().default(false),
});

export const optionGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Este campo es obligatorio.'),
  min_selections: z.number().int().min(0).default(0),
  max_selections: z.number().int().min(1).default(1),
  option_items: z.array(optionItemSchema).min(1),
}).refine((g) => g.min_selections <= g.max_selections, {
  // UI-SPEC line 266 verbatim
  message: 'El mínimo no puede ser mayor que el máximo.',
  path: ['min_selections'],
});

export const itemSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1, 'Este campo es obligatorio.'),
  description: z.string().optional(),
  base_price: z.union([
    z.number().int().min(0, 'El precio no puede ser negativo.'),
    z.null(),
  ]).default(null),
  option_groups: z.array(optionGroupSchema).default([]),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Este campo es obligatorio.'),
});

export type MenuItemInput = z.infer<typeof itemSchema>;
export type OptionGroupInput = z.infer<typeof optionGroupSchema>;
export type OptionItemInput = z.infer<typeof optionItemSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
