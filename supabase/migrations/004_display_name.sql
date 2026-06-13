-- ═══════════════════════════════════════════════════════════════════
-- 004_display_name.sql
-- El campo "username" pasa a ser nombre de display (no único).
-- El nombre y avatar se toman de la cuenta de Google al registrarse.
-- ═══════════════════════════════════════════════════════════════════

-- Eliminar la restricción UNIQUE de username (ahora es nombre de display)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;

-- Permitir avatar_url vacío (la UI muestra una inicial como fallback)
ALTER TABLE profiles ALTER COLUMN avatar_url SET DEFAULT '';
