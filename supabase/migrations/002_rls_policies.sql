-- ═══════════════════════════════════════════════════════════════════
-- 002_rls_policies.sql
-- Activa RLS y define todas las políticas (principio de mínimo privilegio).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Activar RLS en todas las tablas ─────────────────────────────
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE options         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_failures   ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_votes     ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────────
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ─── subjects ────────────────────────────────────────────────────
CREATE POLICY "subjects_select" ON subjects
  FOR SELECT USING (true);

CREATE POLICY "subjects_admin_write" ON subjects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── sections ────────────────────────────────────────────────────
CREATE POLICY "sections_select" ON sections
  FOR SELECT USING (true);

CREATE POLICY "sections_admin_write" ON sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── questions ───────────────────────────────────────────────────
-- Usuarios normales solo ven preguntas originales o aprobadas
CREATE POLICY "questions_select_public" ON questions
  FOR SELECT USING (
    contribution_status IS NULL OR contribution_status = 'aprobado'
  );

-- Admin ve todas (incluyendo pendientes/rechazadas)
CREATE POLICY "questions_select_admin" ON questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Usuario autenticado puede insertar contribuciones
CREATE POLICY "questions_insert_auth" ON questions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND contributed_by = auth.uid()
  );

-- Solo admin puede actualizar y eliminar
CREATE POLICY "questions_update_admin" ON questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "questions_delete_admin" ON questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── options ─────────────────────────────────────────────────────
CREATE POLICY "options_select" ON options
  FOR SELECT USING (true);

CREATE POLICY "options_update_admin" ON options
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "options_insert_admin" ON options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "options_delete_admin" ON options
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── reports ─────────────────────────────────────────────────────
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "reports_select_admin" ON reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "reports_insert_auth" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── user_failures, test_progress, notifications ─────────────────
CREATE POLICY "user_failures_own" ON user_failures
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "test_progress_own" ON test_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ─── forum_threads ───────────────────────────────────────────────
CREATE POLICY "forum_threads_select" ON forum_threads
  FOR SELECT USING (true);

CREATE POLICY "forum_threads_insert_auth" ON forum_threads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND author_id = auth.uid());

CREATE POLICY "forum_threads_update_admin" ON forum_threads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── forum_posts ─────────────────────────────────────────────────
CREATE POLICY "forum_posts_select" ON forum_posts
  FOR SELECT USING (true);

CREATE POLICY "forum_posts_insert_auth" ON forum_posts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    author_id = auth.uid() AND
    NOT EXISTS (
      SELECT 1 FROM forum_threads WHERE id = thread_id AND locked = TRUE
    )
  );

-- ─── forum_votes ─────────────────────────────────────────────────
CREATE POLICY "forum_votes_own" ON forum_votes
  FOR ALL USING (auth.uid() = user_id);
