// apps/backend/src/middleware/auth.ts
// Validación de JWT y extracción de restaurantId desde los CLAIMS del JWT.
//
// El Custom Access Token Hook (public.custom_access_token_hook) inyecta
// `restaurant_id` en los claims del JWT (claims.app_metadata.restaurant_id) en
// tiempo de firma. NO escribe en auth.users.raw_app_meta_data. Por eso NO se
// puede leer de `supabaseAdmin.auth.getUser(token).user.app_metadata` — eso
// devuelve el registro persistido de la DB, que no contiene `restaurant_id`.
//
// Flujo correcto:
//   1) `getUser(token)` valida firma + expiración del JWT (no modifica nada)
//   2) Decodificamos el payload del JWT para leer los claims inyectados por el hook
//
// Durante el wizard, antes de crear el restaurante, `restaurant_id` en claims es
// null y `restaurantId === ''`. Las rutas que requieren restaurante (PUT hours,
// PATCH /me, etc) devuelven 404 `no_restaurant` en ese caso.

import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export interface AuthedRequest extends Request {
  restaurantId: string;
  userId: string;
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  // 1) Validar el JWT (firma + expiración). Si el token es inválido, esto falla.
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'invalid token' });

  // 2) Decodificar el payload del JWT para leer los claims que inyectó el hook.
  //    `getUser()` ya validó la firma — decodificar acá solo lee los claims confiables.
  const claims = decodeJwtClaims(token);
  const claimsAppMeta = (claims?.app_metadata ?? {}) as Record<string, unknown>;
  const restaurantId = (claimsAppMeta.restaurant_id as string | null) ?? '';

  (req as AuthedRequest).restaurantId = restaurantId;
  (req as AuthedRequest).userId = user.id;
  next();
}
