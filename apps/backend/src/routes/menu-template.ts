// apps/backend/src/routes/menu-template.ts
// MENU-05: Template loader endpoint (POST /load-template).
// D-12: Loads hamburgueseria-template.json idempotently.
// The seed real de Wonder vive en `scripts/seed-wonder.ts` (no implementado en este plan).
// Este endpoint solo carga el template GENÉRICO.

import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

export const menuTemplateRouter = Router();

menuTemplateRouter.use(requireAuth);

interface TemplateCategory {
  name: string;
  sort_order: number;
  items: TemplateItem[];
}

interface TemplateItem {
  name: string;
  description: string;
  base_price: null;
}

interface TemplateData {
  version: number;
  categories: TemplateCategory[];
}

// POST /load-template — Load the generic hamburgueseria template.
// Idempotency: returns 409 if categories already exist for this restaurant.
menuTemplateRouter.post('/load-template', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  // Check if template already loaded
  const { data: existing, error: checkErr } = await supabaseAdmin
    .from('menu_categories')
    .select('count', { count: 'exact' })
    .eq('restaurant_id', req.restaurantId);

  if (checkErr) return res.status(500).json({ error: checkErr.message });

  const categoryCount = existing && existing.length > 0 ? existing[0].count : 0;
  if (categoryCount > 0) {
    return res.status(409).json({ error: 'template_already_loaded' });
  }

  // Load template from disk
  let template: TemplateData;
  try {
    // Load template relative to current working directory
    const templatePath = join(process.cwd(), 'apps/backend/src/seeds/hamburgueseria-template.json');
    const templateContent = readFileSync(templatePath, 'utf-8');
    template = JSON.parse(templateContent);
  } catch (err) {
    return res.status(500).json({ error: 'failed_to_load_template_file' });
  }

  // Insert categories and items
  let categoriesCreated = 0;
  let itemsCreated = 0;

  try {
    for (const categoryData of template.categories) {
      // Insert category
      const { data: category, error: catErr } = await supabaseAdmin
        .from('menu_categories')
        .insert({
          restaurant_id: req.restaurantId,
          name: categoryData.name,
          sort_order: categoryData.sort_order,
        })
        .select('id')
        .single();

      if (catErr || !category) throw new Error('category_insert_failed');
      categoriesCreated++;

      // Insert items for this category
      for (const itemData of categoryData.items) {
        const { error: itemErr } = await supabaseAdmin
          .from('menu_items')
          .insert({
            restaurant_id: req.restaurantId,
            category_id: category.id,
            name: itemData.name,
            description: itemData.description,
            base_price: itemData.base_price, // Always null per D-12
            available: true,
            sort_order: categoryData.items.indexOf(itemData),
          });

        if (itemErr) throw new Error('item_insert_failed');
        itemsCreated++;
      }
    }

    return res.status(201).json({
      categories_created: categoriesCreated,
      items_created: itemsCreated,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});
