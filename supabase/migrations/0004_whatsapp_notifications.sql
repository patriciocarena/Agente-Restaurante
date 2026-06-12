-- 0004_whatsapp_notifications.sql
-- Pivot Fase 4: KDS → notificaciones de pedidos por WhatsApp (decisión 2026-06-11).
-- WhatsApp del restaurante para recibir cada pedido nuevo. E.164 móvil AR
-- (+549 + área + abonado, ej. +5493511234567). Nullable: si no está seteado,
-- la notificación se saltea silenciosamente (el pedido se crea igual).
-- Distinto de `phone` (línea pública del local) y `twilio_number` (número entrante).
-- Validación de formato en la API (routes/restaurants.ts), no en DB — patrón existente.
-- Sin cambios de RLS: la columna hereda las políticas de `restaurants`.
-- Apply via Supabase MCP apply_migration, or fall back to Supabase Dashboard SQL Editor.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- Verificación:
-- SELECT column_name FROM information_schema.columns WHERE table_name='restaurants' AND column_name='whatsapp_number';
