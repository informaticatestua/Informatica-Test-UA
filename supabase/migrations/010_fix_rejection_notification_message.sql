-- Corrige el mensaje de notificación al rechazar reportes para indicar claramente el rechazo.

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
  VALUES (v_user_id, 'report_rejected', 'Tu reporte fue rechazado. El administrador ha confirmado que la respuesta original es correcta.', v_question_id);
END; $$;

CREATE OR REPLACE FUNCTION reject_reports_for_question(p_question_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;

  FOR r IN SELECT id, user_id FROM reports WHERE question_id = p_question_id AND status = 'pendiente' LOOP
    UPDATE reports SET status = 'rechazado', admin_note = p_admin_note, updated_at = now() WHERE id = r.id;
    INSERT INTO notifications (user_id, type, message, related_question_id)
    VALUES (r.user_id, 'report_rejected', 'Tu reporte fue rechazado. El administrador ha confirmado que la respuesta original es correcta.', p_question_id);
  END LOOP;

  UPDATE questions SET report_count = 0 WHERE id = p_question_id;
END; $$;
