-- Add 'announcement' to the type check constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'report_accepted', 'report_rejected',
    'contribution_accepted', 'contribution_rejected',
    'forum_reply', 'announcement'
  ));

-- RPC to broadcast an announcement to all non-banned users
CREATE OR REPLACE FUNCTION send_announcement(p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF trim(p_message) = '' THEN RAISE EXCEPTION 'El mensaje no puede estar vacío'; END IF;
  INSERT INTO notifications (user_id, type, message)
  SELECT id, 'announcement', trim(p_message)
  FROM profiles
  WHERE (banned IS NULL OR banned = FALSE);
END; $$;
