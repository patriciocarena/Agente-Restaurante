// apps/backend/src/routes/restaurants.ts
// Endpoints para manejo de restaurantes: crear, leer, actualizar datos y horarios.
// Todos los endpoints requieren autenticación JWT via requireAuth middleware.

import { Router, Request, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { generateUniqueSlug } from '../lib/slug';
import { logger } from '../lib/logger';
import { normalizeArWhatsApp } from '../lib/whatsapp';

export const restaurantsRouter = Router();

restaurantsRouter.use(requireAuth);

// POST / — Wizard step 1: crear restaurante
// Cuerpo: { name, address, delivery_zones?, agent_name? }
// Crea las filas: restaurants, restaurant_hours (7), restaurant_counters, subscriptions(trial)
restaurantsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    const { name, address, delivery_zones, agent_name, whatsapp_number } = req.body;

    // Validación básica
    if (!name || typeof name !== 'string' || name.length < 2) {
      return res.status(400).json({ error: 'name_required_min_2' });
    }
    if (!address || typeof address !== 'string' || address.length < 5) {
      return res.status(400).json({ error: 'address_required_min_5' });
    }

    // WhatsApp de pedidos: opcional; si viene, debe ser celular AR válido
    let normalizedWhatsApp: string | null = null;
    if (whatsapp_number !== undefined && whatsapp_number !== null && whatsapp_number !== '') {
      if (typeof whatsapp_number !== 'string') {
        return res.status(400).json({ error: 'whatsapp_number_invalid' });
      }
      normalizedWhatsApp = normalizeArWhatsApp(whatsapp_number);
      if (!normalizedWhatsApp) {
        return res.status(400).json({ error: 'whatsapp_number_invalid' });
      }
    }

    // Generar slug único
    const slug = await generateUniqueSlug(name);

    // Crear fila de restaurante
    // Mass-assignment guard: NUNCA pasar req.body directo al insert.
    // Solo estos campos son permitidos.
    const { data: restaurant, error: rErr } = await supabaseAdmin
      .from('restaurants')
      .insert({
        owner_id: authedReq.userId, // from JWT, NEVER from body — defense-in-depth
        name,
        slug,
        address,
        delivery_zones: delivery_zones || null,
        agent_name: agent_name || 'Sofía',
        whatsapp_number: normalizedWhatsApp,
      })
      .select()
      .single();

    if (rErr) {
      // UNIQUE violation on slug: 23505
      if (rErr.code === '23505') {
        return res.status(409).json({ error: 'slug_taken', details: { message: rErr.message, code: rErr.code, hint: (rErr as any).hint, constraint: (rErr as any).details } });
      }
      // eslint-disable-next-line no-console
      console.error('[DIAG] restaurant insert failed:', JSON.stringify(rErr, null, 2));
      logger.error('restaurant insert failed', { error: rErr.message, code: rErr.code });
      return res.status(400).json({ error: 'restaurant_creation_failed', details: { message: rErr.message, code: rErr.code, hint: (rErr as any).hint, dbDetails: (rErr as any).details } });
    }

    // Crear restaurant_hours (7 filas, uno por día)
    const hoursRows = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      hoursRows.push({
        restaurant_id: restaurant.id,
        day_of_week: dayOfWeek,
        open_time: null,
        close_time: null,
        is_closed: true,
      });
    }
    const { error: hoursErr } = await supabaseAdmin
      .from('restaurant_hours')
      .insert(hoursRows);

    if (hoursErr) {
      logger.error('restaurant_hours insert failed', { error: hoursErr.message });
      // Optionally cleanup restaurant row; for MVP accept partial state
      return res.status(400).json({ error: 'hours_creation_failed' });
    }

    // Crear restaurant_counters
    const { error: counterErr } = await supabaseAdmin
      .from('restaurant_counters')
      .insert({
        restaurant_id: restaurant.id,
        last_order_number: 0,
      });

    if (counterErr) {
      logger.error('restaurant_counters insert failed', { error: counterErr.message });
      return res.status(400).json({ error: 'counters_creation_failed' });
    }

    // Crear subscriptions (trial status)
    const { error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        restaurant_id: restaurant.id,
        status: 'trial',
      });

    if (subErr) {
      logger.error('subscriptions insert failed', { error: subErr.message });
      return res.status(400).json({ error: 'subscriptions_creation_failed' });
    }

    logger.info('restaurant created', { restaurant_id: restaurant.id });
    return res.status(201).json({ restaurant });
  } catch (error) {
    logger.error('POST / unexpected error', { error: String(error) });
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

// GET /me — Obtener datos del restaurante del usuario
restaurantsRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    if (!authedReq.restaurantId) {
      return res.status(404).json({ error: 'no_restaurant' });
    }

    const { data: restaurant, error } = await supabaseAdmin
      .from('restaurants')
      .select('*')
      .eq('id', authedReq.restaurantId)
      .eq('owner_id', authedReq.userId) // defense-in-depth
      .single();

    if (error || !restaurant) {
      return res.status(404).json({ error: 'restaurant_not_found' });
    }

    return res.json(restaurant);
  } catch (error) {
    logger.error('GET /me unexpected error', { error: String(error) });
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

// PATCH /me — Actualizar campos de restaurante (paso a paso del wizard + settings)
// Mass-assignment guard: solo estos campos se permiten
restaurantsRouter.patch('/me', async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    if (!authedReq.restaurantId) {
      return res.status(404).json({ error: 'no_restaurant' });
    }

    const { name, address, agent_name, delivery_zones, onboarding_step, whatsapp_number } = req.body;

    // Mass-assignment guard: SOLO estos campos se permiten.
    // Cualquier campo fuera de este set se ignora. NUNCA pasar req.body directo.
    const updateData: Record<string, any> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.length < 2) {
        return res.status(400).json({ error: 'name_invalid' });
      }
      updateData.name = name;
    }

    if (address !== undefined) {
      if (typeof address !== 'string' || address.length < 5) {
        return res.status(400).json({ error: 'address_invalid' });
      }
      updateData.address = address;
    }

    if (agent_name !== undefined) {
      if (typeof agent_name !== 'string' || agent_name.length < 1) {
        return res.status(400).json({ error: 'agent_name_invalid' });
      }
      updateData.agent_name = agent_name;
    }

    if (delivery_zones !== undefined) {
      updateData.delivery_zones = delivery_zones; // can be null
    }

    if (onboarding_step !== undefined) {
      if (typeof onboarding_step !== 'number' || ![0, 1, 2, 3, 4].includes(onboarding_step)) {
        return res.status(400).json({ error: 'onboarding_step_invalid' });
      }
      updateData.onboarding_step = onboarding_step;
    }

    if (whatsapp_number !== undefined) {
      // null o '' limpian el campo; si viene valor, debe ser celular AR válido
      if (whatsapp_number === null || whatsapp_number === '') {
        updateData.whatsapp_number = null;
      } else if (typeof whatsapp_number !== 'string') {
        return res.status(400).json({ error: 'whatsapp_number_invalid' });
      } else {
        const normalized = normalizeArWhatsApp(whatsapp_number);
        if (!normalized) {
          return res.status(400).json({ error: 'whatsapp_number_invalid' });
        }
        updateData.whatsapp_number = normalized;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'no_fields_to_update' });
    }

    const { data: restaurant, error } = await supabaseAdmin
      .from('restaurants')
      .update(updateData)
      .eq('id', authedReq.restaurantId)
      .eq('owner_id', authedReq.userId) // defense-in-depth
      .select()
      .single();

    if (error || !restaurant) {
      return res.status(404).json({ error: 'restaurant_not_found' });
    }

    logger.info('restaurant updated', { restaurant_id: restaurant.id });
    return res.json(restaurant);
  } catch (error) {
    logger.error('PATCH /me unexpected error', { error: String(error) });
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

// PUT /me/hours — Reemplazar horarios semanales (wizard step 2)
// Cuerpo: { hours: Array<{day_of_week, open_time?, close_time?, is_closed}> }
// Valida que sea array de 7 elementos cubriendo 0..6
restaurantsRouter.put('/me/hours', async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    if (!authedReq.restaurantId) {
      return res.status(404).json({ error: 'no_restaurant' });
    }

    const { hours } = req.body;

    if (!Array.isArray(hours)) {
      return res.status(400).json({ error: 'hours_must_be_array' });
    }

    if (hours.length !== 7) {
      return res.status(400).json({ error: 'hours_length_must_be_7' });
    }

    // Verificar que day_of_week cubre 0..6 (sin duplicados)
    const daysFound = new Set<number>();
    for (const h of hours) {
      if (typeof h.day_of_week !== 'number' || h.day_of_week < 0 || h.day_of_week > 6) {
        return res.status(400).json({ error: 'invalid_day_of_week' });
      }
      if (daysFound.has(h.day_of_week)) {
        return res.status(400).json({ error: 'duplicate_day_of_week' });
      }
      daysFound.add(h.day_of_week);
    }

    // Validar tiempos: si not is_closed, close_time > open_time
    for (const h of hours) {
      if (!h.is_closed) {
        if (!h.open_time || !h.close_time) {
          return res.status(400).json({ error: 'open_and_close_time_required' });
        }
        // Validación simple: strings en formato HH:MM
        // Si es close_time <= open_time, error (Pitfall 4)
        if (h.close_time <= h.open_time) {
          return res.status(400).json({ error: 'close_time_must_be_after_open_time' });
        }
      }
    }

    // Eliminar horas existentes
    const { error: deleteErr } = await supabaseAdmin
      .from('restaurant_hours')
      .delete()
      .eq('restaurant_id', authedReq.restaurantId);

    if (deleteErr) {
      logger.error('delete hours failed', { error: deleteErr.message });
      return res.status(400).json({ error: 'hours_update_failed' });
    }

    // Insertar nuevas 7 filas
    const hoursToInsert = hours.map((h: any) => ({
      restaurant_id: authedReq.restaurantId,
      day_of_week: h.day_of_week,
      open_time: h.is_closed ? null : h.open_time,
      close_time: h.is_closed ? null : h.close_time,
      is_closed: h.is_closed,
    }));

    const { error: insertErr } = await supabaseAdmin
      .from('restaurant_hours')
      .insert(hoursToInsert);

    if (insertErr) {
      logger.error('insert hours failed', { error: insertErr.message });
      return res.status(400).json({ error: 'hours_update_failed' });
    }

    logger.info('hours updated', { restaurant_id: authedReq.restaurantId });
    return res.json({ success: true });
  } catch (error) {
    logger.error('PUT /me/hours unexpected error', { error: String(error) });
    return res.status(500).json({ error: 'internal_server_error' });
  }
});
