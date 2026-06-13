-- ═══════════════════════════════════════════════════════════════════
-- 001_schema_inicial.sql
-- Crea todas las tablas en el orden correcto (respetando FKs).
-- ═══════════════════════════════════════════════════════════════════

-- ─── profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  banned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── subjects ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id          TEXT PRIMARY KEY,   -- ej: 'dca', 'ada', 'sds'
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── sections ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  slug        TEXT UNIQUE,        -- identificador de URL: 'dca-oficial', 'redes', etc.
  name        TEXT NOT NULL,
  "order"     INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── questions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id          UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id          TEXT NOT NULL REFERENCES subjects(id),
  body                TEXT NOT NULL,
  attachment_type     TEXT CHECK (attachment_type IN ('image', 'code')),
  attachment_content  TEXT,
  report_count        INT NOT NULL DEFAULT 0,
  contribution_status TEXT CHECK (contribution_status IN ('pendiente', 'aprobado', 'rechazado')),
  contributed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── options ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  is_correct   BOOLEAN NOT NULL DEFAULT FALSE,
  "order"      INT NOT NULL DEFAULT 0
);

-- ─── reports ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL CHECK (reason IN (
                 'respuesta_incorrecta',
                 'pregunta_duplicada',
                 'pregunta_desactualizada',
                 'otro'
               )),
  details      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aceptado', 'rechazado')),
  admin_note   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, user_id)
);

-- ─── user_failures ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_failures (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  section_id   UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- ─── test_progress ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  question_ids    UUID[] NOT NULL,
  answers         JSONB NOT NULL DEFAULT '{}',
  current_index   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, section_id)
);

-- ─── notifications ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'report_accepted', 'report_rejected',
                'contribution_accepted', 'contribution_rejected',
                'forum_reply'
              )),
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  related_id  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── forum_threads ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  locked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── forum_posts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  votes       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── forum_votes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_votes (
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id  UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);
