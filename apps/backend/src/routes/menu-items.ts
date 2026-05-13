// apps/backend/src/routes/menu-items.ts
// MENU-02, MENU-03, MENU-04: CRUD router for menu_items with nested option_groups/option_items.
// Availability toggle (PATCH /:id/availability) is the hot path for MENU-04.
// Every query uses defense-in-depth .eq('restaurant_id', req.restaurantId).
// CASCADE DELETE on option_groups/option_items is enforced by Phase 01 migration.

import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

export const menuItemsRouter = Router();

menuItemsRouter.use(requireAuth);

// GET / — List items for a category, with nested option_groups + option_items.
// Query: ?category_id=<uuid>
menuItemsRouter.get('/', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  const { category_id } = req.query;
  if (!category_id) {
    return res.status(400).json({ error: 'category_id_required' });
  }

  // Fetch items with nested option_groups
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('menu_items')
    .select(
      `id, restaurant_id, category_id, name, description, base_price, available,
       sort_order, created_at, updated_at,
       option_groups(
         id, menu_item_id, name, min_selections, max_selections, sort_order,
         option_items(id, option_group_id, name, price_delta, is_default, sort_order)
       )`
    )
    .eq('category_id', category_id as string)
    .eq('restaurant_id', req.restaurantId)
    .order('sort_order', { ascending: true });

  if (itemsErr) return res.status(500).json({ error: itemsErr.message });
  return res.json({ items: items || [] });
});

// POST / — Create a menu item with optional nested option_groups/option_items.
// Body: {
//   category_id: uuid,
//   name: string,
//   description?: string,
//   base_price?: number | null,
//   option_groups?: Array<{
//     name: string,
//     min_selections: number,
//     max_selections: number,
//     option_items: Array<{ name, price_delta, is_default }>
//   }>
// }
menuItemsRouter.post('/', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  const { category_id, name, description, base_price, option_groups } = req.body;

  // Validate category_id belongs to this restaurant
  if (!category_id) {
    return res.status(400).json({ error: 'category_id_required' });
  }

  const { data: categoryCheck, error: catErr } = await supabaseAdmin
    .from('menu_categories')
    .select('id')
    .eq('id', category_id)
    .eq('restaurant_id', req.restaurantId)
    .maybeSingle();

  if (catErr || !categoryCheck) {
    return res.status(400).json({ error: 'invalid_category' });
  }

  // Validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name_required' });
  }

  // Validate base_price if present (non-negative integer or null)
  if (base_price !== undefined && base_price !== null) {
    if (typeof base_price !== 'number' || base_price < 0 || !Number.isInteger(base_price)) {
      return res.status(400).json({ error: 'invalid_base_price' });
    }
  }

  // Calculate next sort_order for this category
  const { data: existingItems, error: fetchErr } = await supabaseAdmin
    .from('menu_items')
    .select('sort_order')
    .eq('category_id', category_id)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });

  const nextSortOrder = (existingItems && existingItems.length > 0)
    ? (existingItems[0].sort_order || 0) + 1
    : 0;

  // Insert menu_item
  const { data: itemData, error: itemErr } = await supabaseAdmin
    .from('menu_items')
    .insert({
      restaurant_id: req.restaurantId,
      category_id,
      name: name.trim(),
      description: description || null,
      base_price: base_price !== undefined ? base_price : null,
      available: true,
      sort_order: nextSortOrder,
    })
    .select('id, restaurant_id, category_id, name, description, base_price, available, sort_order')
    .single();

  if (itemErr || !itemData) {
    return res.status(400).json({ error: itemErr?.message || 'failed_to_create_item' });
  }

  // If option_groups provided, insert them with rollback on error
  let finalItem: any = { ...itemData, option_groups: [] };

  if (option_groups && Array.isArray(option_groups) && option_groups.length > 0) {
    try {
      for (const group of option_groups) {
        const { data: groupData, error: groupErr } = await supabaseAdmin
          .from('option_groups')
          .insert({
            menu_item_id: itemData.id,
            name: group.name,
            min_selections: group.min_selections || 0,
            max_selections: group.max_selections || 1,
            sort_order: option_groups.indexOf(group),
          })
          .select('id, menu_item_id, name, min_selections, max_selections, sort_order')
          .single();

        if (groupErr || !groupData) throw new Error('option_group_insert_failed');

        // Insert option_items for this group
        const optionItems = group.option_items || [];
        for (const item of optionItems) {
          const { error: itemErr } = await supabaseAdmin
            .from('option_items')
            .insert({
              option_group_id: groupData.id,
              name: item.name,
              price_delta: item.price_delta || 0,
              is_default: item.is_default || false,
              sort_order: optionItems.indexOf(item),
            });

          if (itemErr) throw new Error('option_item_insert_failed');
        }

        // Fetch the group with its items
        const { data: fullGroup } = await supabaseAdmin
          .from('option_groups')
          .select(
            `id, menu_item_id, name, min_selections, max_selections, sort_order,
             option_items(id, option_group_id, name, price_delta, is_default, sort_order)`
          )
          .eq('id', groupData.id)
          .single();

        if (fullGroup) {
          finalItem.option_groups.push(fullGroup);
        }
      }
    } catch (err) {
      // Rollback: delete the just-inserted item (CASCADE will handle groups/items)
      await supabaseAdmin
        .from('menu_items')
        .delete()
        .eq('id', itemData.id);

      return res.status(400).json({ error: (err as Error).message });
    }
  }

  return res.status(201).json({ item: finalItem });
});

// PATCH /:id — Update a menu item (name, description, base_price, option_groups).
// If option_groups provided, REPLACE all existing groups (CASCADE delete + insert new).
menuItemsRouter.patch('/:id', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  const { id } = req.params;
  const { name, description, base_price, option_groups } = req.body;

  // Build update payload (whitelist: no category_id allowed on this endpoint)
  const updatePayload: Record<string, unknown> = {};
  if (name !== undefined) updatePayload.name = name;
  if (description !== undefined) updatePayload.description = description;
  if (base_price !== undefined) updatePayload.base_price = base_price;

  // Update the item
  let updatedItem: any = null;
  if (Object.keys(updatePayload).length > 0) {
    const { data: item, error } = await supabaseAdmin
      .from('menu_items')
      .update(updatePayload)
      .eq('id', id)
      .eq('restaurant_id', req.restaurantId)
      .select(
        `id, restaurant_id, category_id, name, description, base_price, available, sort_order`
      )
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'item_not_found' });
    }
    updatedItem = item;
  } else {
    // Fetch current item for response
    const { data: item, error } = await supabaseAdmin
      .from('menu_items')
      .select(
        `id, restaurant_id, category_id, name, description, base_price, available, sort_order`
      )
      .eq('id', id)
      .eq('restaurant_id', req.restaurantId)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'item_not_found' });
    }
    updatedItem = item;
  }

  // Handle option_groups replacement
  if (option_groups && Array.isArray(option_groups)) {
    // Delete existing groups (CASCADE to items)
    await supabaseAdmin
      .from('option_groups')
      .delete()
      .eq('menu_item_id', id);

    // Insert new groups
    const groupsWithItems = [];
    for (const group of option_groups) {
      const { data: groupData, error: groupErr } = await supabaseAdmin
        .from('option_groups')
        .insert({
          menu_item_id: id,
          name: group.name,
          min_selections: group.min_selections || 0,
          max_selections: group.max_selections || 1,
          sort_order: option_groups.indexOf(group),
        })
        .select('id, menu_item_id, name, min_selections, max_selections, sort_order')
        .single();

      if (groupErr || !groupData) {
        return res.status(400).json({ error: 'option_group_insert_failed' });
      }

      // Insert option_items
      const optionItems = group.option_items || [];
      for (const item of optionItems) {
        const { error: itemErr } = await supabaseAdmin
          .from('option_items')
          .insert({
            option_group_id: groupData.id,
            name: item.name,
            price_delta: item.price_delta || 0,
            is_default: item.is_default || false,
            sort_order: optionItems.indexOf(item),
          });

        if (itemErr) {
          return res.status(400).json({ error: 'option_item_insert_failed' });
        }
      }

      // Fetch the group with its items
      const { data: fullGroup } = await supabaseAdmin
        .from('option_groups')
        .select(
          `id, menu_item_id, name, min_selections, max_selections, sort_order,
           option_items(id, option_group_id, name, price_delta, is_default, sort_order)`
        )
        .eq('id', groupData.id)
        .single();

      if (fullGroup) {
        groupsWithItems.push(fullGroup);
      }
    }

    updatedItem.option_groups = groupsWithItems;
  } else {
    // Fetch existing option_groups
    const { data: groups } = await supabaseAdmin
      .from('option_groups')
      .select(
        `id, menu_item_id, name, min_selections, max_selections, sort_order,
         option_items(id, option_group_id, name, price_delta, is_default, sort_order)`
      )
      .eq('menu_item_id', id);

    updatedItem.option_groups = groups || [];
  }

  return res.json({ item: updatedItem });
});

// DELETE /:id — Delete a menu item.
// CASCADE FK from Phase 01 handles option_groups and option_items deletion.
menuItemsRouter.delete('/:id', async (req: AuthedRequest, res: any) => {
  if (req.restaurantId === '') {
    return res.status(400).json({ error: 'no_restaurant' });
  }

  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('menu_items')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', req.restaurantId);

  if (error) return res.status(404).json({ error: 'item_not_found' });
  return res.status(204).send();
});

// PATCH /:id/availability — Toggle item availability (hot path for MENU-04).
// Body: { available: boolean }
// Response: 200 with updated item
menuItemsRouter.patch('/:id/availability', async (req: AuthedRequest, res: any) => {
  const { available } = req.body;
  if (typeof available !== 'boolean') {
    return res.status(400).json({ error: 'available_must_be_boolean' });
  }

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .update({ available, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('restaurant_id', req.restaurantId)
    .select('id, restaurant_id, category_id, name, description, base_price, available, sort_order')
    .single();

  if (error || !data) return res.status(404).json({ error: 'item_not_found' });
  return res.json(data);
});
