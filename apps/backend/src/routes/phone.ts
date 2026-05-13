// apps/backend/src/routes/phone.ts
// Endpoints para manejo de teléfono: reintentos de provisión (D-07, D-16).

import { Router, Request, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { provisionUsForwardingNumber } from '../lib/twilio';
import { getForwardingDocsUrl, forwardingInstructions } from '../lib/forwarding-instructions';
import { logger } from '../lib/logger';

export const phoneRouter = Router();

phoneRouter.use(requireAuth);

// POST /retry-provision — D-07/D-16: botón "Reintentar" del wizard
// Mismo contrato que /api/onboarding/finish
phoneRouter.post('/retry-provision', async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    // Buscar restaurante por owner_id
    const { data: restaurant, error: restaurantErr } = await supabaseAdmin
      .from('restaurants')
      .select('id, onboarding_step, twilio_number')
      .eq('owner_id', authedReq.userId)
      .maybeSingle();

    if (restaurantErr) {
      logger.error('restaurant fetch failed', { error: restaurantErr.message });
      return res.status(400).json({ error: 'restaurant_fetch_failed' });
    }

    if (!restaurant) {
      return res.status(404).json({ error: 'no_restaurant' });
    }

    // Si ya tiene un número asignado, devolverlo
    if (restaurant.twilio_number) {
      return res.json({
        twilio_number: restaurant.twilio_number,
        mode: 'us-forwarding',
        forwarding_docs_url: getForwardingDocsUrl(),
        forwarding_instructions: forwardingInstructions,
        already_provisioned: true,
      });
    }

    // Intentar provisionar
    let phoneResult;
    try {
      phoneResult = await provisionUsForwardingNumber(restaurant.id);
    } catch (twilioErr) {
      logger.error('twilio provision failed on retry', {
        restaurant_id: restaurant.id,
        error: String(twilioErr),
      });
      return res.status(502).json({ error: 'twilio_provision_failed' });
    }

    // Actualizar restaurante
    const { error: updateErr } = await supabaseAdmin
      .from('restaurants')
      .update({
        twilio_number: phoneResult.phoneNumber,
        twilio_phone_sid: phoneResult.sid,
        onboarding_step: 4,
      })
      .eq('id', restaurant.id)
      .eq('owner_id', authedReq.userId); // defense-in-depth

    if (updateErr) {
      logger.error('restaurant update failed on retry', { error: updateErr.message });
      return res.status(400).json({ error: 'restaurant_update_failed' });
    }

    logger.info('phone retry succeeded', { restaurant_id: restaurant.id });
    return res.json({
      twilio_number: phoneResult.phoneNumber,
      mode: 'us-forwarding',
      forwarding_docs_url: getForwardingDocsUrl(),
      forwarding_instructions: forwardingInstructions,
    });
  } catch (error) {
    logger.error('POST /retry-provision unexpected error', { error: String(error) });
    return res.status(500).json({ error: 'internal_server_error' });
  }
});
