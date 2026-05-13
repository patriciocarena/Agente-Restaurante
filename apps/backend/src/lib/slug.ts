// apps/backend/src/lib/slug.ts
// Generación de slugs únicos para restaurantes con manejo de acentos (español).
// Si dos onboardings concurrentes intentan el mismo slug, el UNIQUE constraint de Supabase
// es la garantía final (capturamos la excepción en la ruta).

import slugify from 'slugify';
import { supabaseAdmin } from './supabase';

export async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true, locale: 'es' });

  if (!base) {
    throw new Error('slug_empty');
  }

  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data) return candidate; // unique
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}
