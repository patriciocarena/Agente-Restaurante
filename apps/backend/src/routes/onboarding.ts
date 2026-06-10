// apps/backend/src/routes/onboarding.ts
// Endpoints para completar el onboarding: resumir paso actual y provisionar Twilio.

import { Router, Request, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { provisionUsForwardingNumber } from '../lib/twilio';
import { getForwardingDocsUrl, forwardingInstructions } from '../lib/forwarding-instructions';
import { logger } from '../lib/logger';
import { createVapiAssistant } from '../lib/vapi';

export const onboardingRouter = Router();

onboardingRouter.use(requireAuth);

// GET /resume — Obtener el paso actual de onboarding del usuario
// Retorna: { onboarding_step, has_restaurant }
onboardingRouter.get('/resume', async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    // Buscar por owner_id (no restaurant_id, porque en paso 0 no existe restaurante)
    const { data: restaurant, error } = await supabaseAdmin
      .from('restaurants')
      .select('id, onboarding_step')
      .eq('owner_id', authedReq.userId)
      .maybeSingle();

    if (error) {
      logger.error('resume query failed', { error: error.message });
      return res.status(400).json({ error: 'resume_query_failed' });
    }

    if (!restaurant) {
      return res.json({ onboarding_step: 0, has_restaurant: false });
    }

    return res.json({
      onboarding_step: restaurant.onboarding_step || 0,
      has_restaurant: true,
    });
  } catch (error) {
    logger.error('GET /resume unexpected error', { error: String(error) });
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

// POST /finish — Paso 4 submit: provisionar número Twilio y marcar onboarding completo
// Idempotencia: si ya está completo y tiene twilio_number, devuelve 200 con el número
onboardingRouter.post('/finish', async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    // Buscar restaurante por owner_id
    const { data: restaurant, error: restaurantErr } = await supabaseAdmin
      .from('restaurants')
      .select('id, onboarding_step, twilio_number, name, agent_name, vapi_assistant_id')
      .eq('owner_id', authedReq.userId)
      .maybeSingle();

    if (restaurantErr) {
      logger.error('restaurant fetch failed', { error: restaurantErr.message });
      return res.status(400).json({ error: 'restaurant_fetch_failed' });
    }

    if (!restaurant) {
      return res.status(404).json({ error: 'no_restaurant' });
    }

    // Idempotencia: si ya está completado, devolver el número existente
    if (restaurant.onboarding_step >= 4 && restaurant.twilio_number) {
      // If assistant wasn't created on the original finish (e.g. Vapi was down), retry now
      if (!restaurant.vapi_assistant_id) {
        try {
          const assistantId = await createVapiAssistant({
            id: restaurant.id,
            name: restaurant.name,
            agent_name: restaurant.agent_name ?? 'Sofía',
          });
          await supabaseAdmin
            .from('restaurants')
            .update({ vapi_assistant_id: assistantId })
            .eq('id', restaurant.id)
            .eq('owner_id', authedReq.userId);
        } catch (vapiErr) {
          logger.error('vapi assistant creation failed (idempotent retry)', {
            restaurant_id: restaurant.id,
            error: String(vapiErr),
          });
        }
      }
      return res.json({
        twilio_number: restaurant.twilio_number,
        mode: 'us-forwarding',
        forwarding_docs_url: getForwardingDocsUrl(),
        forwarding_instructions: forwardingInstructions,
        already_finished: true,
      });
    }

    // Intentar provisionar número Twilio
    let phoneResult;
    try {
      phoneResult = await provisionUsForwardingNumber(restaurant.id);
    } catch (twilioErr) {
      logger.error('twilio provision failed', {
        restaurant_id: restaurant.id,
        error: String(twilioErr),
      });
      return res.status(502).json({ error: 'twilio_provision_failed' });
    }

    // Actualizar restaurante con número y marcar como completado
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
      logger.error('restaurant update failed', { error: updateErr.message });
      return res.status(400).json({ error: 'restaurant_update_failed' });
    }

    // Create Vapi assistant (ONB-05). Non-blocking: Twilio provision is the critical path;
    // an assistant-creation failure must NOT roll back onboarding (avoid re-provisioning a number).
    try {
      const assistantId = await createVapiAssistant({
        id: restaurant.id,
        name: restaurant.name,
        agent_name: restaurant.agent_name ?? 'Sofía',
      });
      await supabaseAdmin
        .from('restaurants')
        .update({ vapi_assistant_id: assistantId })
        .eq('id', restaurant.id)
        .eq('owner_id', authedReq.userId); // defense-in-depth
    } catch (vapiErr) {
      logger.error('vapi assistant creation failed', {
        restaurant_id: restaurant.id,
        error: String(vapiErr),
      });
    }

    logger.info('onboarding finished', { restaurant_id: restaurant.id });
    return res.json({
      twilio_number: phoneResult.phoneNumber,
      mode: 'us-forwarding',
      forwarding_docs_url: getForwardingDocsUrl(),
      forwarding_instructions: forwardingInstructions,
    });
  } catch (error) {
    logger.error('POST /finish unexpected error', { error: String(error) });
    return res.status(500).json({ error: 'internal_server_error' });
  }
});
