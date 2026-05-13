// apps/backend/src/middleware/auth.ts
// Validación de JWT y extracción de restaurantId desde app_metadata.
// Durante el wizard, el JWT del usuario aún no tiene `restaurant_id` en `app_metadata`
// (la fila no existe). En ese caso `restaurantId === ''` y la ruta debe manejarlo
// (típicamente POST /api/restaurants es la única que acepta este caso).

import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export interface AuthedRequest extends Request {
  restaurantId: string;
  userId: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'invalid token' });

  const restaurantId = user.app_metadata?.restaurant_id as string | null;
  // Note: during onboarding step 1, restaurant doesn't exist yet — route must handle null
  (req as AuthedRequest).restaurantId = restaurantId ?? '';
  (req as AuthedRequest).userId = user.id;
  next();
}
