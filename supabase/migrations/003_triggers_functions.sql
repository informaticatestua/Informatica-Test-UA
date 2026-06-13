-- ═══════════════════════════════════════════════════════════════════
-- 003_triggers_functions.sql
-- Funciones y triggers de negocio.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Trigger: crear perfil automáticamente al registrarse ────────
-- Usa el nombre y foto de la cuenta de Google (OAuth metadata).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name   TEXT;
  v_avatar TEXT;
BEGIN
  -- Nombre: full_name o name del proveedor OAuth; fallback al email sin dominio
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Avatar: foto de Google; fallback vacío (se mostrará inicial en la UI)
  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    ''
  );

  INSERT INTO profiles (id, username, avatar_url, role)
  VALUES (NEW.id, v_name, v_avatar, 'user');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Función: incrementar report_count ───────────────────────────
CREATE OR REPLACE FUNCTION increment_report_count(p_question_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE questions SET report_count = report_count + 1 WHERE id = p_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Función: aceptar reporte ────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_report(p_question_id UUID, p_correct_option_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE options SET is_correct = FALSE WHERE question_id = p_question_id;
  UPDATE options SET is_correct = TRUE  WHERE id = p_correct_option_id;
  UPDATE questions SET report_count = 0  WHERE id = p_question_id;
  UPDATE reports
    SET status = 'aceptado'
    WHERE question_id = p_question_id AND status = 'pendiente';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Función: rechazar reporte ───────────────────────────────────
CREATE OR REPLACE FUNCTION reject_report(p_report_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_question_id UUID;
BEGIN
  SELECT question_id INTO v_question_id FROM reports WHERE id = p_report_id;

  UPDATE reports
    SET status = 'rechazado', admin_note = p_admin_note
    WHERE id = p_report_id;

  UPDATE questions SET report_count = 0 WHERE id = v_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Función: toggle voto en post de foro ────────────────────────
CREATE OR REPLACE FUNCTION toggle_forum_vote(p_user_id UUID, p_post_id UUID)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM forum_votes WHERE user_id = p_user_id AND post_id = p_post_id
  ) THEN
    DELETE FROM forum_votes WHERE user_id = p_user_id AND post_id = p_post_id;
    UPDATE forum_posts SET votes = votes - 1 WHERE id = p_post_id;
  ELSE
    INSERT INTO forum_votes (user_id, post_id) VALUES (p_user_id, p_post_id);
    UPDATE forum_posts SET votes = votes + 1 WHERE id = p_post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
