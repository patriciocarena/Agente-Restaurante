-- 0002_phase2_columns.sql
-- Phase 2 (Onboarding & Menu) — agrega columnas operacionales a restaurants,
-- refuerza ON DELETE CASCADE en menu_items.category_id (y en option_groups/option_items),
-- y publica menu_items/menu_categories a supabase_realtime.
-- Apply via Supabase Dashboard SQL Editor (no CLI available, Phase 1 pattern).
-- Decisions touched: D-01 (wizard 4 pasos), D-02 (resume automático), D-03 (validación),
-- D-05 (forwarding-only US number), D-06 (twilio_number + twilio_phone_sid),
-- D-08 (forwarding docs URL), D-11 (realtime toggle), D-15 (cascade delete D-15),
-- D-17 (migration spec desde 02-CONTEXT.md).

-- =============================================================================
-- SECTION: restaurants — operational columns
-- Columnas necesarias para el wizard de onboarding y la asignación de teléfono.
-- =============================================================================

-- D-03: delivery_zones — texto libre donde el restaurante lista las zonas/barrios
-- que cubre (ej: "Villa Allende centro, Argüello, Saldán"). Nullable porque
-- la zona puede no tener delivery. En v2 se puede convertir a un array o JSON.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_zones text;

-- D-02: onboarding_step — permite reanudar el wizard desde el último paso completado.
-- 0 = nunca empezó, 1 = completó datos, 2 = completó horario, 3 = completó delivery,
-- 4 = finalizó el wizard. NOT NULL con DEFAULT 0 para que todas las filas existentes
-- arranquen en "no iniciado".
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS onboarding_step smallint NOT NULL DEFAULT 0;

-- Audited 0001_initial_schema.sql: column `twilio_number` is ABSENT (only generic `phone`
-- exists at line 20 of 0001). The generic `phone` column stores the restaurant's original
-- public phone number. We add `twilio_number` as a SEPARATE column for the Twilio US
-- number assigned in onboarding — Phase 3 uses it to configure the Vapi assistant.
-- D-06: twilio_number — número Twilio US asignado al restaurante en el onboarding
-- (decisión consciente de MVP: número US, no AR, para evitar el bundle ENACOM).
-- Los clientes siguen llamando al teléfono original del restaurante; ese teléfono
-- desvía las llamadas a este número Twilio. Ver D-05 + D-08 para los detalles.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS twilio_number text;

-- D-06: twilio_phone_sid — SID del recurso IncomingPhoneNumber en Twilio.
-- Necesario para poder liberar el número si el restaurante cancela la suscripción
-- (llamada a DELETE /IncomingPhoneNumbers/{Sid} en la API de Twilio).
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS twilio_phone_sid text;

-- =============================================================================
-- SECTION: menu_items.category_id — ON DELETE CASCADE (D-15)
-- D-15: borrar una categoría borra sus items en cascada.
-- El UI confirma con modal antes (texto exacto en UI-SPEC D-15); CASCADE es la
-- garantía a nivel DB para que nunca queden items huérfanos (category_id apuntando
-- a una categoría que ya no existe).
-- DROP primero para recrear con la nueva cláusula ON DELETE CASCADE.
-- =============================================================================

ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_category_id_fkey;
ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE;

-- =============================================================================
-- SECTION: option_groups + option_items — ON DELETE CASCADE (D-15 extensión)
-- D-15 (extensión): borrar un menu_item borra sus option_groups y option_items
-- en cascada. Esto elimina la ambigüedad (a)/(b) que el Plan 02-03 Task 2
-- contemplaba — la opción CASCADE queda fija a nivel DB y el handler DELETE de
-- menu-items.ts NO necesita borrar manualmente los option_groups/option_items.
-- También cubre el caso de borrar una categoría: category CASCADE → items CASCADE
-- → option_groups CASCADE → option_items. Toda la jerarquía se elimina en un DELETE.
-- =============================================================================

ALTER TABLE option_groups DROP CONSTRAINT IF EXISTS option_groups_menu_item_id_fkey;
ALTER TABLE option_groups
  ADD CONSTRAINT option_groups_menu_item_id_fkey
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE;

ALTER TABLE option_items DROP CONSTRAINT IF EXISTS option_items_option_group_id_fkey;
ALTER TABLE option_items
  ADD CONSTRAINT option_items_option_group_id_fkey
  FOREIGN KEY (option_group_id) REFERENCES option_groups(id) ON DELETE CASCADE;

-- =============================================================================
-- SECTION: supabase_realtime publication (MENU-04, D-11)
-- MENU-04: el toggle de disponibilidad (Switch en cada item del MenuEditor) debe
-- propagarse a otras pestañas/dispositivos del mismo restaurante en <2 segundos
-- vía Supabase Realtime. Para eso, menu_items y menu_categories deben estar en
-- la publicación supabase_realtime (que ya existe por defecto en proyectos Supabase).
-- RLS aplica también a Realtime — los restaurantes solo ven sus propias filas.
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;

-- =============================================================================
-- VERIFICACIÓN POST-APLICACIÓN
-- Correr estas queries en el SQL Editor de Supabase después de aplicar este script:
--
-- 1. Columnas nuevas en restaurants (debe devolver 4 filas):
--    SELECT column_name FROM information_schema.columns
--     WHERE table_name='restaurants'
--       AND column_name IN ('delivery_zones','onboarding_step','twilio_number','twilio_phone_sid');
--
-- 2. FKs con CASCADE (debe devolver 3 filas, todas con confdeltype='c'):
--    SELECT conname, confdeltype FROM pg_constraint
--     WHERE conname IN (
--       'menu_items_category_id_fkey',
--       'option_groups_menu_item_id_fkey',
--       'option_items_option_group_id_fkey'
--     );
--
-- 3. Tablas en la publicación realtime (debe devolver 2 filas):
--    SELECT tablename FROM pg_publication_tables
--     WHERE pubname='supabase_realtime' AND tablename IN ('menu_items','menu_categories');
-- =============================================================================
