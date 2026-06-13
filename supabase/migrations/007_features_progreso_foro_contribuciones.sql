-- ═══════════════════════════════════════════════════════════════════
-- 007_features_progreso_foro_contribuciones.sql
-- · Vista public_profiles (nombres/avatares visibles en el foro sin
--   exponer el resto de columnas de profiles, p.ej. claves encriptadas).
-- · Tabla test_progress (guardar/retomar tests).
-- · Políticas admin que faltaban (borrar preguntas, banear usuarios).
-- · report_count mantenido por trigger desde reports.
-- · RPCs de reportes/contribuciones con guard de admin y notificaciones.
-- · Foro: triggers (lock, reply_count, notificación) y RPCs.
-- ═══════════════════════════════════════════════════════════════════

-- ═══ 1. Vista pública de perfiles ═══
CREATE OR REPLACE VIEW public_profiles AS
  SELECT id, username, avatar_url FROM public.profiles;
GRANT SELECT ON public_profiles TO anon, authenticated;

-- ═══ 2. Progreso de test (un progreso activo por usuario y quiz) ═══
CREATE TABLE IF NOT EXISTS test_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_key       TEXT NOT NULL,
  question_ids   UUID[] NOT NULL,
  states         JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_index  INT NOT NULL DEFAULT 0,
  correct_count  INT NOT NULL DEFAULT 0,
  answered_count INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, quiz_key)
);
ALTER TABLE test_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS test_progress_owner_all ON test_progress;
CREATE POLICY test_progress_owner_all ON test_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══ 3. Políticas admin que faltaban ═══
DROP POLICY IF EXISTS questions_admin_delete ON questions;
CREATE POLICY questions_admin_delete ON questions FOR DELETE USING (is_admin());
DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE USING (is_admin());

-- ═══ 4. report_count mantenido automáticamente desde reports ═══
CREATE OR REPLACE FUNCTION sync_report_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_qid UUID;
BEGIN
  v_qid := COALESCE(NEW.question_id, OLD.question_id);
  UPDATE questions SET report_count = (
    SELECT COUNT(*) FROM reports WHERE question_id = v_qid AND status = 'pendiente'
  ) WHERE id = v_qid;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_sync_report_count ON reports;
CREATE TRIGGER trg_sync_report_count
  AFTER INSERT OR UPDATE OF status OR DELETE ON reports
  FOR EACH ROW EXECUTE FUNCTION sync_report_count();

-- Compat: recalcula en vez de incrementar a ciegas
CREATE OR REPLACE FUNCTION increment_report_count(p_question_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE questions SET report_count = (
    SELECT COUNT(*) FROM reports WHERE question_id = p_question_id AND status = 'pendiente'
  ) WHERE id = p_question_id;
END; $$;

-- ═══ 5. Reportes: guard de admin + notificaciones dentro del RPC ═══
DROP FUNCTION IF EXISTS accept_report(UUID, UUID);
CREATE FUNCTION accept_report(p_question_id UUID, p_correct_option_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;

  UPDATE options SET is_correct = FALSE WHERE question_id = p_question_id;
  UPDATE options SET is_correct = TRUE  WHERE id = p_correct_option_id;

  FOR r IN SELECT user_id FROM reports WHERE question_id = p_question_id AND status = 'pendiente' LOOP
    INSERT INTO notifications (user_id, type, message, related_question_id)
    VALUES (r.user_id, 'report_accepted', 'Tu reporte fue aceptado. La respuesta ha sido corregida.', p_question_id);
  END LOOP;

  UPDATE reports SET status = 'aceptado', updated_at = now()
    WHERE question_id = p_question_id AND status = 'pendiente';
  UPDATE questions SET report_count = 0 WHERE id = p_question_id;
END; $$;

CREATE OR REPLACE FUNCTION reject_report(p_report_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_question_id UUID; v_user_id UUID;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;

  SELECT question_id, user_id INTO v_question_id, v_user_id FROM reports WHERE id = p_report_id;
  IF v_question_id IS NULL THEN RETURN; END IF;

  UPDATE reports SET status = 'rechazado', admin_note = p_admin_note, updated_at = now()
    WHERE id = p_report_id;

  INSERT INTO notifications (user_id, type, message, related_question_id)
  VALUES (v_user_id, 'report_rejected', 'Tu reporte fue revisado. La respuesta ha sido confirmada como correcta.', v_question_id);
END; $$;

-- Rechaza de una vez todos los reportes pendientes de una pregunta
CREATE OR REPLACE FUNCTION reject_reports_for_question(p_question_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;

  FOR r IN SELECT id, user_id FROM reports WHERE question_id = p_question_id AND status = 'pendiente' LOOP
    UPDATE reports SET status = 'rechazado', admin_note = p_admin_note, updated_at = now() WHERE id = r.id;
    INSERT INTO notifications (user_id, type, message, related_question_id)
    VALUES (r.user_id, 'report_rejected', 'Tu reporte fue revisado. La respuesta ha sido confirmada como correcta.', p_question_id);
  END LOOP;

  UPDATE questions SET report_count = 0 WHERE id = p_question_id;
END; $$;

-- ═══ 6. Contribuciones: aceptar (crea pregunta real) / rechazar ═══
CREATE OR REPLACE FUNCTION accept_contribution(p_contribution_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD; v_qid UUID; v_multiple BOOLEAN;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;

  SELECT * INTO c FROM contributions WHERE id = p_contribution_id AND status = 'pendiente' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contribución no encontrada o ya revisada'; END IF;
  IF c.subject_id IS NULL THEN RAISE EXCEPTION 'La contribución no tiene asignatura asociada'; END IF;

  v_multiple := (SELECT COUNT(*) FROM contribution_options
                 WHERE contribution_id = p_contribution_id AND is_correct) > 1;

  BEGIN
    INSERT INTO questions (subject_id, source_file, content, is_multiple, position_in_file, content_hash)
    VALUES (
      c.subject_id,
      'contribucion',
      c.content,
      v_multiple,
      (SELECT COALESCE(MAX(position_in_file), 0) + 1 FROM questions WHERE subject_id = c.subject_id),
      md5(c.content)
    )
    RETURNING id INTO v_qid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya existe una pregunta idéntica en esa asignatura';
  END;

  INSERT INTO options (question_id, content, is_correct, position)
    SELECT v_qid, content, is_correct, position
    FROM contribution_options WHERE contribution_id = p_contribution_id
    ORDER BY position;

  UPDATE contributions SET status = 'aprobado', updated_at = now() WHERE id = p_contribution_id;

  INSERT INTO notifications (user_id, type, message, related_question_id)
  VALUES (c.user_id, 'contribution_accepted',
          'Tu pregunta para ' || UPPER(c.subject_id) || ' fue aceptada y ya está disponible.', v_qid);

  RETURN v_qid;
END; $$;

CREATE OR REPLACE FUNCTION reject_contribution(p_contribution_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;

  SELECT * INTO c FROM contributions WHERE id = p_contribution_id AND status = 'pendiente' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contribución no encontrada o ya revisada'; END IF;

  UPDATE contributions SET status = 'rechazado', rejection_reason = p_reason, updated_at = now()
    WHERE id = p_contribution_id;

  INSERT INTO notifications (user_id, type, message)
  VALUES (c.user_id, 'contribution_rejected',
          'Tu contribución' || COALESCE(' para ' || UPPER(c.subject_id), '') || ' no fue aceptada.' ||
          COALESCE(' ' || NULLIF(TRIM(p_reason), ''), ''));
END; $$;

-- ═══ 7. Foro ═══
-- 7.1 Guard: no responder en hilos bloqueados (salvo admin)
CREATE OR REPLACE FUNCTION forum_post_lock_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT is_locked FROM forum_threads WHERE id = NEW.thread_id) AND NOT is_admin() THEN
    RAISE EXCEPTION 'Este hilo está bloqueado';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_forum_post_lock_guard ON forum_posts;
CREATE TRIGGER trg_forum_post_lock_guard
  BEFORE INSERT ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION forum_post_lock_guard();

-- 7.2 reply_count automático + notificación al autor del hilo
CREATE OR REPLACE FUNCTION handle_forum_post_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tid UUID; v_author UUID; v_title TEXT;
BEGIN
  v_tid := COALESCE(NEW.thread_id, OLD.thread_id);

  UPDATE forum_threads SET
    reply_count = GREATEST((SELECT COUNT(*) - 1 FROM forum_posts WHERE thread_id = v_tid), 0),
    updated_at  = now()
  WHERE id = v_tid
  RETURNING user_id, title INTO v_author, v_title;

  IF TG_OP = 'INSERT' AND v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, message)
    VALUES (v_author, 'forum_reply', 'Alguien ha respondido a tu hilo «' || LEFT(v_title, 80) || '».');
  END IF;

  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_forum_post_change ON forum_posts;
CREATE TRIGGER trg_forum_post_change
  AFTER INSERT OR DELETE ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION handle_forum_post_change();

-- 7.3 Crear hilo + primer post de forma atómica (SECURITY INVOKER: aplica RLS)
CREATE OR REPLACE FUNCTION create_forum_thread(p_subject_id TEXT, p_title TEXT, p_content TEXT)
RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_tid UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF LENGTH(TRIM(p_title)) < 4 THEN RAISE EXCEPTION 'El título es demasiado corto'; END IF;
  IF LENGTH(TRIM(p_content)) < 4 THEN RAISE EXCEPTION 'El mensaje es demasiado corto'; END IF;

  INSERT INTO forum_threads (subject_id, user_id, title)
  VALUES (p_subject_id, auth.uid(), TRIM(p_title))
  RETURNING id INTO v_tid;

  INSERT INTO forum_posts (thread_id, user_id, content)
  VALUES (v_tid, auth.uid(), TRIM(p_content));

  RETURN v_tid;
END; $$;

-- 7.4 Voto toggle (el usuario sale de auth.uid())
CREATE OR REPLACE FUNCTION toggle_forum_vote(p_post_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_votes INT; v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF EXISTS (SELECT 1 FROM forum_votes WHERE user_id = v_uid AND post_id = p_post_id) THEN
    DELETE FROM forum_votes WHERE user_id = v_uid AND post_id = p_post_id;
  ELSE
    INSERT INTO forum_votes (user_id, post_id) VALUES (v_uid, p_post_id);
  END IF;

  UPDATE forum_posts SET votes = (SELECT COUNT(*) FROM forum_votes WHERE post_id = p_post_id)
  WHERE id = p_post_id
  RETURNING votes INTO v_votes;

  RETURN v_votes;
END; $$;
