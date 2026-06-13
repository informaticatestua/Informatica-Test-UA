-- ═══════════════════════════════════════════════════════════════════
-- 005_fix_handle_new_user_search_path.sql
-- Añade SET search_path = public para que el trigger encuentre
-- la tabla profiles cuando se ejecuta en el contexto de auth.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name   TEXT;
  v_avatar TEXT;
BEGIN
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    ''
  );

  INSERT INTO public.profiles (id, username, avatar_url, role)
  VALUES (NEW.id, v_name, v_avatar, 'user');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
