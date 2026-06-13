# Documento Técnico — Informatica Test UA (v2)

> Guía de implementación completa para la reescritura de la plataforma sobre Supabase.
> Stack: Astro 5 (SSG) · Vanilla JS (ESM) · Tailwind CSS 4 · Supabase (Auth + PostgreSQL + RLS)

---

## 1. Visión General de la Arquitectura

La aplicación sigue una arquitectura **JAMstack estricta**: el servidor solo sirve archivos estáticos compilados por Astro; toda la lógica dinámica (auth, datos, tiempo real) se ejecuta en el cliente a través del SDK de Supabase.

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENTE (Navegador)                                             │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Astro Pages    │    │  Vanilla JS Modules (ESM)           │ │
│  │  (HTML estático)│───▶│  auth · quiz · reports · forum · …  │ │
│  └─────────────────┘    └──────────────┬────────────────────── ┘ │
│                                        │ Supabase JS SDK         │
└────────────────────────────────────────┼─────────────────────────┘
                                         │ HTTPS / WebSocket
┌────────────────────────────────────────▼─────────────────────────┐
│  SUPABASE (BaaS)                                                  │
│                                                                   │
│  ┌──────────┐  ┌─────────────────┐  ┌──────────────────────────┐ │
│  │   Auth   │  │   PostgreSQL    │  │  Realtime (WebSockets)   │ │
│  │  Google  │  │   + RLS         │  │  (notificaciones)        │ │
│  │  OAuth   │  │                 │  │                          │ │
│  └──────────┘  └─────────────────┘  └──────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

**Principios de diseño:**
- No existe backend propio. Cero servidores Node/Express a mantener.
- Todo el HTML es estático: SEO y carga inicial óptimos.
- Las RLS (Row Level Security) de PostgreSQL son la única capa de autorización. No hay middleware de servidor que validar.
- Los módulos JS son independientes entre sí; se comunican mediante eventos del DOM o un bus de eventos mínimo.

---

## 2. Estructura de Archivos del Proyecto

```
informatica-test-ua/
├── public/
│   ├── resources/
│   │   ├── data/          ← .txt de respaldo (no usados en la web)
│   │   ├── images/        ← Imágenes estáticas de preguntas legacy
│   │   ├── css/
│   │   │   └── prism.css
│   │   └── js/
│   │       ├── supabase-client.js     ← Singleton del cliente Supabase
│   │       ├── auth.js                ← Estado de sesión global
│   │       ├── main.js                ← Motor del quiz (refactorizado)
│   │       ├── quiz-data.js           ← Carga de preguntas desde Supabase
│   │       ├── quiz-renderer.js       ← Renderizado HTML del quiz
│   │       ├── test-progress.js       ← Guardar/retomar progreso de test
│   │       ├── failures.js            ← Gestión de preguntas falladas
│   │       ├── exam-mode.js           ← Modo examen real (config + timer)
│   │       ├── reports.js             ← Modal y envío de reportes
│   │       ├── contributions.js       ← Formulario de contribución
│   │       ├── notifications.js       ← Campana y tiempo real
│   │       ├── forum.js               ← Hilos y posts del foro
│   │       ├── profile.js             ← Ajustes de perfil
│   │       ├── admin.js               ← Panel de administración
│   │       ├── formatters.js          ← KaTeX, Prism, Markdown (existente)
│   │       └── utils.js               ← Helpers compartidos (shuffle, etc.)
│
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro           ← Head, nav, scripts globales
│   ├── components/
│   │   ├── Navbar.astro               ← Barra de navegación con auth
│   │   ├── NotificationBell.astro     ← Icono campana
│   │   ├── ReportModal.astro          ← Modal de reporte
│   │   ├── ContributeModal.astro      ← Modal de contribución
│   │   └── ExamConfig.astro           ← Formulario config examen
│   ├── pages/
│   │   ├── index.astro                ← Selector de asignaturas
│   │   ├── [subject].astro            ← Página de asignatura/secciones
│   │   ├── login.astro                ← Página de login (Google OAuth)
│   │   ├── auth/
│   │   │   └── callback.astro         ← Callback OAuth de Supabase
│   │   ├── perfil.astro               ← Perfil del usuario
│   │   ├── perfil/
│   │   │   ├── ajustes.astro          ← Cambiar username/avatar
│   │   │   └── contribuciones.astro   ← Mis contribuciones
│   │   ├── contribuir.astro           ← Formulario contribución pública
│   │   ├── foro/
│   │   │   ├── [subject].astro        ← Lista de hilos de una asignatura
│   │   │   └── [thread].astro         ← Hilo individual con posts
│   │   └── admin.astro                ← Panel de administración
│   └── styles/
│       └── global.css                 ← Variables CSS + Tailwind 4
│
├── supabase/
│   └── migrations/                    ← Migraciones SQL versionadas
│       ├── 001_schema_inicial.sql
│       ├── 002_rls_policies.sql
│       └── 003_triggers_functions.sql
│
├── astro.config.mjs
├── tailwind.config.mjs  (si aplica)
└── package.json
```

---

## 3. Base de Datos — Esquema PostgreSQL (Supabase)

### 3.1 Diagrama de relaciones

```
auth.users (Supabase Auth)
    │ 1
    │
    ▼ N
profiles ──────────────────────────────────────────────────────────┐
    │ 1                                                             │
    │                                                               │
    ├──▶ N reports                                                  │
    ├──▶ N user_failures                                            │
    ├──▶ N test_progress (1 por sección activa)                     │
    ├──▶ N notifications                                            │
    ├──▶ N forum_threads (author)                                   │
    ├──▶ N forum_posts (author)                                     │
    └──▶ N forum_votes                                              │
                                                                    │
subjects ──▶ N sections ──▶ N questions ──▶ N options              │
                                │                                   │
                                ├──▶ N reports ─────── user_id ────▶┘
                                ├──▶ N user_failures
                                └──▶ N test_progress
```

### 3.2 Tabla `profiles`

Extiende `auth.users` con datos de la aplicación.

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  banned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | Mismo UUID que `auth.users`. PK y FK en cascada. |
| `username` | text | Único. Formato `user` + dígitos. Editable por el usuario. |
| `avatar_url` | text | URL de `https://joesch.moe/api/v1/random?key=<seed>`. |
| `role` | text | `'user'` por defecto. Solo admin puede cambiarlo a `'admin'`. |
| `banned` | boolean | Si es `true`, el cliente cierra la sesión al detectarlo. |

### 3.3 Tabla `subjects`

Catálogo de asignaturas. Gestionado manualmente por el admin.

```sql
CREATE TABLE subjects (
  id          TEXT PRIMARY KEY,  -- ej: 'dca', 'ada', 'sds'
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.4 Tabla `sections`

Cada asignatura tiene N secciones (temas, parciales, exámenes).

```sql
CREATE TABLE sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  "order"     INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.5 Tabla `questions`

Banco unificado de preguntas (originales + contribuciones aprobadas).

```sql
CREATE TABLE questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id          UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id          TEXT NOT NULL REFERENCES subjects(id),
  body                TEXT NOT NULL,
  attachment_type     TEXT CHECK (attachment_type IN ('image', 'code')),
  attachment_content  TEXT,          -- URL si image, código literal si code
  report_count        INT NOT NULL DEFAULT 0,
  contribution_status TEXT CHECK (contribution_status IN ('pendiente', 'aprobado', 'rechazado')),
  contributed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason    TEXT,          -- Solo si contribution_status = 'rechazado'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Regla clave**: Las preguntas originales tienen `contribution_status = NULL`. Las contribuidas tienen `'pendiente'`, `'aprobado'` o `'rechazado'`. Solo se muestran en los tests las que tienen `contribution_status IS NULL OR contribution_status = 'aprobado'`.

### 3.6 Tabla `options`

Opciones de respuesta de cada pregunta (2–4 por pregunta).

```sql
CREATE TABLE options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  is_correct   BOOLEAN NOT NULL DEFAULT FALSE,
  "order"      INT NOT NULL DEFAULT 0
);
```

### 3.7 Tabla `reports`

Un usuario → una pregunta → máximo un reporte.

```sql
CREATE TABLE reports (
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
```

### 3.8 Tabla `user_failures`

Preguntas falladas por usuario (sin duplicados).

```sql
CREATE TABLE user_failures (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  section_id   UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);
```

### 3.9 Tabla `test_progress`

Un progreso activo por usuario por sección.

```sql
CREATE TABLE test_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  question_ids    UUID[] NOT NULL,   -- Orden aleatorio fijado al iniciar
  answers         JSONB NOT NULL DEFAULT '{}',  -- {question_id: option_id}
  current_index   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, section_id)
);
```

### 3.10 Tabla `notifications`

Notificaciones internas en la web.

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'report_accepted', 'report_rejected',
                'contribution_accepted', 'contribution_rejected',
                'forum_reply'
              )),
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  related_id  UUID,   -- question_id o thread_id según el tipo
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.11 Tabla `forum_threads`

Hilos del foro, uno por asignatura.

```sql
CREATE TABLE forum_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  locked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.12 Tabla `forum_posts`

Respuestas dentro de un hilo.

```sql
CREATE TABLE forum_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  votes       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.13 Tabla `forum_votes`

Un voto por usuario por post. Clave compuesta como PK.

```sql
CREATE TABLE forum_votes (
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id  UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);
```

---

## 4. Funciones y Triggers de PostgreSQL

### 4.1 Trigger: Crear perfil al registrarse

Se ejecuta automáticamente en `auth.users` al crearse un nuevo usuario.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_avatar   TEXT;
BEGIN
  -- Generar username único tipo user482931
  LOOP
    v_username := 'user' || floor(random() * 900000 + 100000)::TEXT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE username = v_username);
  END LOOP;

  -- Avatar aleatorio usando joesch.moe (se usa el UUID como seed)
  v_avatar := 'https://joesch.moe/api/v1/random?key=' || NEW.id::TEXT;

  INSERT INTO profiles (id, username, avatar_url, role)
  VALUES (NEW.id, v_username, v_avatar, 'user');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 4.2 Función: Incrementar `report_count`

Se llama desde el cliente tras insertar un reporte.

```sql
CREATE OR REPLACE FUNCTION increment_report_count(p_question_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE questions SET report_count = report_count + 1 WHERE id = p_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.3 Función: Aceptar reporte (actualiza opción correcta + resetea contador)

Llamada por el admin al aceptar un reporte. Recibe el ID de la pregunta y la opción correcta elegida.

```sql
CREATE OR REPLACE FUNCTION accept_report(p_question_id UUID, p_correct_option_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Marcar todas las opciones como incorrectas
  UPDATE options SET is_correct = FALSE WHERE question_id = p_question_id;
  -- Marcar la opción elegida como correcta
  UPDATE options SET is_correct = TRUE WHERE id = p_correct_option_id;
  -- Resetear contador
  UPDATE questions SET report_count = 0 WHERE id = p_question_id;
  -- Marcar todos los reportes de la pregunta como aceptados
  UPDATE reports SET status = 'aceptado' WHERE question_id = p_question_id AND status = 'pendiente';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.4 Función: Rechazar reporte (resetea contador)

```sql
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
```

### 4.5 Función: Votar post del foro (toggle)

```sql
CREATE OR REPLACE FUNCTION toggle_forum_vote(p_user_id UUID, p_post_id UUID)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM forum_votes WHERE user_id = p_user_id AND post_id = p_post_id) THEN
    DELETE FROM forum_votes WHERE user_id = p_user_id AND post_id = p_post_id;
    UPDATE forum_posts SET votes = votes - 1 WHERE id = p_post_id;
  ELSE
    INSERT INTO forum_votes (user_id, post_id) VALUES (p_user_id, p_post_id);
    UPDATE forum_posts SET votes = votes + 1 WHERE id = p_post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Políticas RLS (Row Level Security)

Todas las tablas tienen RLS activado. Las políticas aplican el principio de mínimo privilegio.

### `profiles`

```sql
-- Cualquiera puede leer perfiles (para mostrar usernames en el foro)
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
-- Solo el propio usuario puede actualizar su perfil
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
```

### `questions` y `options`

```sql
-- Leer preguntas activas (originales o aprobadas)
CREATE POLICY "questions_select" ON questions FOR SELECT
  USING (contribution_status IS NULL OR contribution_status = 'aprobado');

-- Admin puede ver todas (incluyendo pendientes/rechazadas)
CREATE POLICY "questions_select_admin" ON questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Usuario autenticado puede insertar contribuciones
CREATE POLICY "questions_insert" ON questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND contributed_by = auth.uid());

-- Solo admin puede actualizar y eliminar
CREATE POLICY "questions_update_admin" ON questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "questions_delete_admin" ON questions FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Opciones: lectura pública
CREATE POLICY "options_select" ON options FOR SELECT USING (true);
-- Solo admin puede modificar opciones
CREATE POLICY "options_update_admin" ON options FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

### `reports`

```sql
-- Usuario puede leer sus propios reportes
CREATE POLICY "reports_select_own" ON reports FOR SELECT
  USING (auth.uid() = user_id);
-- Admin puede leer todos
CREATE POLICY "reports_select_admin" ON reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
-- Usuario autenticado puede insertar (unicidad por question+user garantizada por constraint)
CREATE POLICY "reports_insert" ON reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### `user_failures`, `test_progress`, `notifications`

```sql
-- Cada usuario solo accede a sus propios datos
CREATE POLICY "own_data" ON user_failures   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON test_progress   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON notifications   FOR ALL USING (auth.uid() = user_id);
```

### `forum_threads` y `forum_posts`

```sql
-- Lectura pública
CREATE POLICY "forum_threads_select" ON forum_threads FOR SELECT USING (true);
CREATE POLICY "forum_posts_select"   ON forum_posts   FOR SELECT USING (true);
-- Inserción solo para usuarios autenticados
CREATE POLICY "forum_threads_insert" ON forum_threads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "forum_posts_insert"   ON forum_posts   FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    NOT EXISTS (SELECT 1 FROM forum_threads WHERE id = thread_id AND locked = TRUE)
  );
-- Admin puede actualizar hilos (pin/lock)
CREATE POLICY "forum_threads_update_admin" ON forum_threads FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

---

## 6. Módulos JavaScript del Cliente

Todos los módulos son archivos ES Module (`type="module"` o `is:inline` según el caso). Se cargan en las páginas que los necesitan.

### 6.1 `supabase-client.js` — Singleton

```js
// Exporta una única instancia del cliente Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = '...';
const SUPABASE_ANON_KEY = '...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

Las credenciales se inyectan desde variables de entorno de Astro en `BaseLayout.astro` como variables JS globales, o mediante `import.meta.env`.

### 6.2 `auth.js` — Estado de sesión global

**Responsabilidad**: mantener el estado de sesión, exponer el usuario actual, redirigir si está baneado.

```js
// Estado interno
let currentUser = null;
let currentProfile = null;

// Inicializa escuchando cambios de auth
async function init() { ... }

// Getters
export function getUser() { return currentUser; }
export function getProfile() { return currentProfile; }
export function isLoggedIn() { return currentUser !== null; }
export function isAdmin() { return currentProfile?.role === 'admin'; }

// Login / logout
export async function loginWithGoogle() { ... }
export async function logout() { ... }

// Verificar ban en cada carga de página con sesión activa
async function checkBan() {
  if (currentProfile?.banned) await logout();
}
```

**Patrón**: Módulo Singleton + Observer. El módulo llama a `supabase.auth.onAuthStateChange()` y actualiza el estado interno; otros módulos leen el estado vía los getters exportados.

### 6.3 `quiz-data.js` — Repositorio de preguntas

**Responsabilidad**: abstraer todas las queries a Supabase relacionadas con preguntas. Ningún otro módulo hace queries directas a las tablas de preguntas.

```js
// Cargar preguntas de una sección (solo activas/aprobadas)
export async function getQuestionsBySection(sectionId) { ... }

// Cargar preguntas falladas de un usuario en una sección
export async function getFailedQuestions(userId, sectionId) { ... }

// Marcar pregunta como fallada
export async function addFailure(userId, questionId, sectionId) { ... }

// Eliminar fallo (al acertar en repaso)
export async function removeFailure(userId, questionId) { ... }
```

**Patrón**: Repository. Centraliza el acceso a datos y facilita cambiar la fuente sin tocar la lógica de la UI.

### 6.4 `main.js` — Motor del quiz

**Responsabilidad**: orquestar la sesión de quiz (cargar preguntas, navegar, validar respuestas, renderizar). Refactorización del `main.js` actual.

```js
// Estado de la sesión de quiz
const state = {
  questions: [],        // Array de preguntas con sus opciones
  answers: {},          // { questionId: optionId }
  currentIndex: 0,
  mode: 'test'          // 'test' | 'review' | 'exam'
};

export async function initQuiz(sectionId, mode = 'test') { ... }
export function goToQuestion(index) { ... }
export function selectAnswer(questionId, optionId) { ... }
export function finishQuiz() { ... }
```

**Patrón**: State Machine. El quiz tiene estados bien definidos: `idle → loading → active → finished`. Las transiciones son funciones puras que mutan `state` y llaman al renderer.

### 6.5 `quiz-renderer.js` — Renderizado HTML

**Responsabilidad**: recibir el estado del quiz y actualizar el DOM. No contiene lógica de negocio.

```js
export function renderQuestion(question, selectedOptionId, mode) { ... }
export function renderProgress(current, total) { ... }
export function renderResults(results, mode) { ... }
export function renderReportBadge(reportCount) { ... }
```

**Patrón**: Separación View/Controller. El renderer es una función pura que mapea datos a HTML; el motor (`main.js`) es el controlador.

### 6.6 `test-progress.js`

```js
// Guardar progreso (upsert por user+section)
export async function saveProgress(userId, sectionId, questionIds, answers, currentIndex) { ... }

// Cargar progreso activo
export async function loadProgress(userId, sectionId) { ... }

// Eliminar progreso al terminar el test
export async function clearProgress(userId, sectionId) { ... }
```

### 6.7 `exam-mode.js`

**Responsabilidad**: gestionar la configuración del modo examen y el cronómetro.

```js
// Configuración del examen
let examConfig = { pointsCorrect: 1, pointsWrong: 0, questionCount: 10 };

export function setConfig(config) { examConfig = { ...examConfig, ...config }; }
export function getConfig() { return { ...examConfig }; }

// Cronómetro
let timerInterval = null;
let elapsedSeconds = 0;

export function startTimer(onTick) { ... }
export function stopTimer() { ... }
export function getElapsed() { return elapsedSeconds; }

// Cálculo de puntuación
export function calculateScore(answers, questions) {
  let score = 0;
  for (const q of questions) {
    const selected = answers[q.id];
    if (!selected) continue;
    const isCorrect = q.options.find(o => o.id === selected)?.is_correct;
    score += isCorrect ? examConfig.pointsCorrect : -examConfig.pointsWrong;
  }
  return score;
}
```

### 6.8 `reports.js`

```js
// Abrir modal de reporte para una pregunta
export function openReportModal(questionId) { ... }

// Enviar reporte
export async function submitReport(questionId, userId, reason, details) {
  const { error } = await supabase.from('reports').insert({ ... });
  if (!error) await supabase.rpc('increment_report_count', { p_question_id: questionId });
}

// Comprobar si el usuario ya reportó esta pregunta
export async function hasUserReported(userId, questionId) { ... }
```

### 6.9 `notifications.js`

**Responsabilidad**: mostrar el contador de notificaciones no leídas y suscribirse a cambios en tiempo real.

```js
export async function init(userId) {
  await loadUnreadCount(userId);
  // Realtime: escuchar inserts en notifications para este usuario
  supabase
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, handleNewNotification)
    .subscribe();
}

function handleNewNotification(payload) {
  incrementBadge();
  // Opcional: mostrar toast
}

export async function markAsRead(notificationId) { ... }
export async function markAllAsRead(userId) { ... }
```

**Patrón**: Observer via Supabase Realtime. El canal WebSocket notifica al cliente sin polling.

### 6.10 `admin.js`

**Responsabilidad**: lógica del panel `/admin`. Carga reportes pendientes, contribuciones, lista de usuarios baneables.

```js
// Reportes
export async function getPendingReports() { ... }
export async function acceptReport(questionId, correctOptionId, affectedUserIds) { ... }
export async function rejectReport(reportId, adminNote, affectedUserId) { ... }

// Contribuciones
export async function getPendingContributions() { ... }
export async function acceptContribution(questionId, userId) { ... }
export async function rejectContribution(questionId, userId, reason) { ... }

// Usuarios
export async function banUser(userId) { ... }
export async function unbanUser(userId) { ... }

// Notificaciones (las genera el admin al resolver reportes/contribuciones)
async function sendNotification(userId, type, message, relatedId) { ... }
```

---

## 7. Rutas de la Aplicación

| Ruta | Archivo | Auth requerida | Descripción |
|------|---------|---------------|-------------|
| `/` | `index.astro` | No | Selector de asignaturas |
| `/[subject]` | `[subject].astro` | No | Secciones de una asignatura |
| `/login` | `login.astro` | No (redirige si ya logueado) | Botón Google OAuth |
| `/auth/callback` | `auth/callback.astro` | No | Manejador de redirect OAuth |
| `/perfil` | `perfil.astro` | Sí | Mis reportes, mis fallos, mis contribuciones |
| `/perfil/ajustes` | `perfil/ajustes.astro` | Sí | Cambiar username y avatar |
| `/perfil/contribuciones` | `perfil/contribuciones.astro` | Sí | Estado de mis contribuciones |
| `/contribuir` | `contribuir.astro` | Sí | Formulario de nueva pregunta |
| `/foro/[subject]` | `foro/[subject].astro` | No (escritura sí) | Lista de hilos del foro |
| `/foro/hilo/[thread]` | `foro/hilo/[thread].astro` | No (escritura sí) | Hilo individual |
| `/admin` | `admin.astro` | Sí + `role='admin'` | Panel de administración |

**Protección de rutas**: Astro genera HTML estático, así que la protección se hace en el cliente. En cada página protegida, un script inline al inicio del `<body>` comprueba la sesión y redirige a `/login` si no hay usuario, o a `/` si no tiene el rol requerido.

```js
// Patrón estándar en páginas con auth requerida
const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.replace('/login'); }
```

---

## 8. Flujo de Autenticación

```
Usuario                    Web (cliente)               Supabase Auth
   │                            │                            │
   │── clic "Iniciar con Google"──▶│                           │
   │                            │──── signInWithOAuth ────────▶│
   │                            │                            │── redirige a Google
   │◀────────────────────────────────────────────────────────── pantalla Google
   │── selecciona cuenta ────────────────────────────────────▶│
   │                            │◀─── redirect a /auth/callback ─│
   │                            │      (con code en URL)       │
   │                            │──── exchangeCodeForSession ─▶│
   │                            │◀─── session + JWT ──────────│
   │                            │                            │
   │                            │── onAuthStateChange SIGNED_IN
   │                            │── carga profile desde profiles
   │                            │── comprueba banned → si true, logout
   │◀── carga página destino ───│
```

**Primera vez**: el trigger `on_auth_user_created` crea el `profile` con username aleatorio y avatar de joesch.moe antes de que el cliente termine de procesar el callback.

---

## 9. Sistema de Diseño

Se mantiene el sistema de diseño existente, basado en variables CSS semánticas en `global.css`.

### Variables de color (modo claro / oscuro)

```css
:root {
  --bg-base: 248 250 252;       /* Fondo general */
  --bg-surface: 255 255 255;    /* Tarjetas y modales */
  --bg-surface-hover: 241 245 249;
  --color-primary-rgb: 15 23 42;
  --text-main: 15 23 42;
  --text-muted: 100 116 139;
  --border-subtle: 226 232 240;
}

.dark {
  --bg-base: 2 6 23;
  --bg-surface: 15 23 42;
  /* ... */
}
```

### Clases de componentes reutilizables (Tailwind utilities)

| Clase | Uso |
|-------|-----|
| `.btn` | Botón secundario (borde, sin relleno) |
| `.btn-primary` | Botón primario (fondo oscuro/claro según tema) |
| `.badge-pending` | Badge amarillo para estado `pendiente` |
| `.badge-accepted` | Badge verde para estado `aceptado` |
| `.badge-rejected` | Badge rojo para estado `rechazado` |
| `.modal-overlay` | Overlay semitransparente para modales |
| `.modal-box` | Contenedor de modal centrado |
| `.input` | Input de texto estilizado |
| `.select` | Select estilizado |

### Tipografía

- **DM Sans**: cuerpo de texto (`--font-sans`).
- **Outfit**: títulos y headings (`--font-heading`).

---

## 10. Patrones de Diseño Aplicados

| Patrón | Dónde se aplica | Por qué |
|--------|----------------|---------|
| **Singleton** | `supabase-client.js`, `auth.js` | Una sola instancia del cliente y del estado de sesión en toda la app |
| **Repository** | `quiz-data.js`, `admin.js` | Centraliza el acceso a datos; el resto de módulos no conocen la estructura de la BD |
| **Observer** | `notifications.js`, `auth.js` | Supabase Realtime y `onAuthStateChange` notifican cambios sin polling |
| **State Machine** | `main.js` (quiz engine) | El quiz tiene estados discretos (idle, loading, active, finished) con transiciones explícitas |
| **Strategy** | `quiz-renderer.js` | El mismo renderer adapta la presentación según el modo (`test`, `review`, `exam`) |
| **Facade** | Funciones RPC de PostgreSQL | Ocultan la complejidad de actualizar varias tablas en una sola operación atómica |
| **Module** | Todos los archivos JS | Cada módulo encapsula una responsabilidad y expone una API pública limpia |

---

## 11. Consideraciones de Seguridad

1. **RLS como única barrera de autorización**: nunca confiar en validaciones del cliente para proteger datos. Toda escritura/lectura sensible está bloqueada a nivel de BD.
2. **`SECURITY DEFINER` en funciones**: las funciones RPC que necesitan permisos elevados (como `accept_report`) se definen con `SECURITY DEFINER` y se invocan vía `supabase.rpc()`. El cliente jamás toca directamente las tablas afectadas.
3. **Detección de ban en cliente**: al cargar el profile tras login, si `banned = true` se llama a `supabase.auth.signOut()` inmediatamente. Aunque el cliente podría saltarse esto, las RLS impiden cualquier operación de datos.
4. **Credenciales**: solo la `ANON_KEY` de Supabase va al cliente (es pública por diseño). La `SERVICE_ROLE_KEY` nunca se expone.
5. **Contribuciones y adjuntos**: las imágenes adjuntas se suben a Supabase Storage con políticas de bucket que solo permiten lectura pública y escritura autenticada.

---

## 12. Migraciones SQL

Las migraciones se versionan en `supabase/migrations/` y se aplican con el CLI de Supabase (`supabase db push`). El orden es:

1. `001_schema_inicial.sql` — Crea todas las tablas en el orden correcto (respetando FKs).
2. `002_rls_policies.sql` — Activa RLS y define todas las políticas.
3. `003_triggers_functions.sql` — Crea funciones y triggers (`handle_new_user`, `accept_report`, etc.).
