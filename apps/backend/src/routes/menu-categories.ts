// apps/backend/src/routes/menu-categories.ts
// MENU-01: CRUD router for menu_categories.
// Every query uses defense-in-depth .eq('restaurant_id', req.restaurantId)
// CASCADE DELETE to menu_items is enforced by Phase 01 migration (D-15).

import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { syncAssistantPrompt } from '../lib/vapi';
import { logger } from '../lib/logger';

export const menuCategoriesRouter = Router();

menuCategoriesRouter.use(requireAuth);

// GET / — List categories for tenant, ordered by sort_order ASC, created_at ASC.
menuCategoriesRouter.get('/', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  const { data, error } = await supabaseAdmin
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('restaurant_id', req.restaurantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ categories: data || [] });
});

// POST / — Create a category.
// Body: { name: string (≥1 char) }
// Returns: 201 with the created category
menuCategoriesRouter.post('/', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name_required' });
  }

  // Calculate next sort_order
  const { data: existingCategories, error: fetchErr } = await supabaseAdmin
    .from('menu_categories')
    .select('sort_order')
    .eq('restaurant_id', req.restaurantId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });

  const nextSortOrder = (existingCategories && existingCategories.length > 0)
    ? (existingCategories[0].sort_order || 0) + 1
    : 0;

  // Insert new category
  const { data: category, error: insertErr } = await supabaseAdmin
    .from('menu_categories')
    .insert({
      restaurant_id: req.restaurantId,
      name: name.trim(),
      sort_order: nextSortOrder,
    })
    .select('id, name, sort_order')
    .single();

  if (insertErr) return res.status(400).json({ error: insertErr.message });
  // MENU-05: resync the Vapi system prompt with the new menu. Fire-and-forget —
  // the menu edit must succeed even if Vapi is down. syncAssistantPrompt swallows its own errors;
  // the .catch is belt-and-suspenders. Do NOT await.
  syncAssistantPrompt(req.restaurantId).catch((err) => {
    logger.error('vapi sync failed after menu edit', { error: String(err), restaurant_id: req.restaurantId });
  });
  return res.status(201).json({ category });
});

// PATCH /:id — Update a category (name and/or sort_order).
menuCategoriesRouter.patch('/:id', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  const { id } = req.params;
  const { name, sort_order } = req.body;

  // Build update payload (whitelist)
  const updatePayload: Record<string, unknown> = {};
  if (name !== undefined) updatePayload.name = name;
  if (sort_order !== undefined) updatePayload.sort_order = sort_order;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: 'no_fields_to_update' });
  }

  const { data: category, error } = await supabaseAdmin
    .from('menu_categories')
    .update(updatePayload)
    .eq('id', id)
    .eq('restaurant_id', req.restaurantId)
    .select('id, name, sort_order')
    .single();

  if (error) return res.status(404).json({ error: 'category_not_found' });
  if (!category) return res.status(404).json({ error: 'category_not_found' });

  // MENU-05: resync the Vapi system prompt with the new menu. Fire-and-forget —
  // the menu edit must succeed even if Vapi is down. syncAssistantPrompt swallows its own errors;
  // the .catch is belt-and-suspenders. Do NOT await.
  syncAssistantPrompt(req.restaurantId).catch((err) => {
    logger.error('vapi sync failed after menu edit', { error: String(err), restaurant_id: req.restaurantId });
  });
  return res.json({ category });
});

// DELETE /:id — Delete a category.
// CASCADE FK from Phase 01 handles menu_items deletion.
// Defense-in-depth: must check restaurant_id so tenant cannot delete another tenant's category.
menuCategoriesRouter.delete('/:id', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('menu_categories')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', req.restaurantId);

  if (error) return res.status(404).json({ error: 'category_not_found' });
  // MENU-05: resync the Vapi system prompt with the new menu. Fire-and-forget —
  // the menu edit must succeed even if Vapi is down. syncAssistantPrompt swallows its own errors;
  // the .catch is belt-and-suspenders. Do NOT await.
  syncAssistantPrompt(req.restaurantId).catch((err) => {
    logger.error('vapi sync failed after menu edit', { error: String(err), restaurant_id: req.restaurantId });
  });
  return res.status(204).send();
});
