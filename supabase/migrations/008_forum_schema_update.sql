-- ═══════════════════════════════════════════════════════════════════
-- 008_forum_schema_update.sql
-- Adapta forum_threads y forum_posts a los campos usados en la app:
-- · Renombra author_id → user_id (consistencia con auth.uid())
-- · Renombra body → content en forum_posts
-- · Añade is_pinned, is_locked (alias de pinned/locked)
-- · Añade reply_count y updated_at a forum_threads
-- · Añade public_profiles view (si no existe ya de 007)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. forum_threads: añadir columnas nuevas ─────────────────────
ALTER TABLE forum_threads
  ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_pinned  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_locked  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reply_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Copiar datos de columnas antiguas → nuevas (si existen)
UPDATE forum_threads SET user_id   = author_id WHERE user_id IS NULL AND author_id IS NOT NULL;
UPDATE forum_threads SET is_pinned = pinned    WHERE is_pinned = FALSE AND pinned IS NOT NULL;
UPDATE forum_threads SET is_locked = locked    WHERE is_locked = FALSE AND locked IS NOT NULL;

-- ─── 2. forum_posts: añadir columna content ───────────────────────
ALTER TABLE forum_posts
  ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content  TEXT;

-- Copiar datos
UPDATE forum_posts SET user_id = author_id WHERE user_id IS NULL AND author_id IS NOT NULL;
UPDATE forum_posts SET content = body       WHERE content IS NULL AND body IS NOT NULL;

-- ─── 3. Asegurar NOT NULL tras la migración ───────────────────────
-- (solo si hay datos o si la tabla está vacía)
-- Si user_id sigue siendo NULL en alguna fila, ponemos el mismo valor que author_id
UPDATE forum_threads SET user_id = author_id WHERE user_id IS NULL;
UPDATE forum_posts    SET user_id = author_id WHERE user_id IS NULL;

-- ─── 4. Vista public_profiles (idempotente) ───────────────────────
CREATE OR REPLACE VIEW public_profiles AS
  SELECT id, username, avatar_url FROM public.profiles;
GRANT SELECT ON public_profiles TO anon, authenticated;

-- ─── 5. Recalcular reply_count para threads existentes ───────────
UPDATE forum_threads t
SET reply_count = GREATEST(
  (SELECT COUNT(*) - 1 FROM forum_posts p WHERE p.thread_id = t.id), 0
);

-- ─── 6. Política RLS adicional: admin puede actualizar hilos ─────
DROP POLICY IF EXISTS "forum_threads_update_admin" ON forum_threads;
CREATE POLICY "forum_threads_update_admin" ON forum_threads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── 7. Actualizar trigger lock guard para usar is_locked ────────
CREATE OR REPLACE FUNCTION forum_post_lock_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (
    SELECT COALESCE(is_locked, locked, FALSE)
    FROM forum_threads WHERE id = NEW.thread_id
  ) AND NOT (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Este hilo está bloqueado';
  END IF;
  RETURN NEW;
END; $$;

-- ─── 8. Trigger handle_forum_post_change actualizado ─────────────
CREATE OR REPLACE FUNCTION handle_forum_post_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tid UUID; v_author UUID; v_title TEXT;
BEGIN
  v_tid := COALESCE(NEW.thread_id, OLD.thread_id);

  UPDATE forum_threads SET
    reply_count = GREATEST((SELECT COUNT(*) - 1 FROM forum_posts WHERE thread_id = v_tid), 0),
    updated_at  = now()
  WHERE id = v_tid
  RETURNING COALESCE(user_id, author_id), title INTO v_author, v_title;

  -- Notificar al autor si es un INSERT de otro usuario
  IF TG_OP = 'INSERT' AND v_author IS NOT NULL
     AND v_author <> COALESCE(NEW.user_id, NEW.author_id) THEN
    INSERT INTO notifications (user_id, type, message)
    VALUES (v_author, 'forum_reply', 'Alguien ha respondido a tu hilo «' || LEFT(v_title, 80) || '».');
  END IF;

  RETURN COALESCE(NEW, OLD);
END; $$;
