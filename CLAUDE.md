# DCA Test UA — Guía de IA (CLAUDE.md / AGENTS.md)

## 1. Project Overview (Descripción del Proyecto)

**DCA Test UA** es una plataforma web interactiva para que estudiantes de Ingeniería Informática de la Universidad de Alicante (UA) practiquen con baterías de preguntas de exámenes y simulacros.
Incluye autenticación con Google, progreso persistente, sistema de reportes y contribuciones, notificaciones en tiempo real, panel de administración y explicaciones de respuestas con IA.

## 2. Tech Stack (Tecnologías)

- **Framework**: Astro 5 (SSG — Generación Estática + Rutas Dinámicas).
- **Core Logic**: Vanilla JS en el cliente (múltiples módulos en `public/resources/js/`).
- **Styling**: Tailwind CSS 4 + CSS nativo con variables semánticas.
- **Math & Code**: KaTeX (fórmulas LaTeX) y Prism.js (resaltado de código).
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + RLS + RPCs).
- **Deployment**: Vercel.

## 3. Architecture Rules (Reglas de Arquitectura)

- **Motor de Quiz (`main.js`)**: Carga asíncrona de `.txt`, parseo, shuffle y validación. Coordina todos los módulos JS vía `window.*`.
- **Módulos JS globales**: Cada fichero en `public/resources/js/` expone un singleton en `window.*`. El orden de carga importa (ver `BaseLayout.astro`). Módulos: `SupabaseClient`, `Auth`, `Failures`, `TestProgress`, `ExamMode`, `Reports`, `AIFeatures`, `AIGenerate`, `Notifications`.
- **Estado Persistente del Quiz**: `estadosPreguntas` guarda selecciones del usuario para navegar sin pérdida de datos.
- **Data Protocol**: Preguntas en `public/resources/data/*.txt`. Soporte nativo para Markdown, código (`` ` ``), LaTeX (`$$ ... $$`) e imágenes `![Alt](URL){width=X height=Y}`.
- **Rutas Dinámicas**: `src/pages/[subject].astro` inyecta el ID de asignatura al motor JS.
- **Persistencia**: **TODA** la persistencia de datos y preferencias de usuario va a Supabase. El `localStorage` solo actúa como **caché de arranque** para evitar flash visual (FOUC) al cargar la página — se rellena automáticamente desde el perfil Supabase en cada inicio de sesión vía `auth.js → syncPrefsToLocalStorage()`. Nunca se escribe directamente a `localStorage` como fuente de verdad.

## 4. File/Directory Structure (Estructura de Archivos)

### Frontend

- `src/layouts/BaseLayout.astro`: Layout maestro. Carga todos los scripts globales en orden correcto.
- `src/pages/index.astro`: Página principal con listado de asignaturas.
- `src/pages/[subject].astro`: Página de quiz por asignatura.
- `src/pages/[subject]/resumen.astro`: Resumen/temario de la asignatura.
- `src/pages/login.astro`: Autenticación con Google.
- `src/pages/auth/callback.astro`: Callback OAuth de Supabase.
- `src/pages/perfil.astro`: Perfil del usuario (reportes, contribuciones).
- `src/pages/perfil/ajustes.astro`: Ajustes (nombre, tema, API keys de IA, instrucciones de IA).
- `src/pages/admin.astro`: Panel de administración (reportes, contribuciones, usuarios, anuncios).
- `src/pages/contribuir.astro`: Formulario para contribuir preguntas.
- `src/styles/global.css`: Variables CSS semánticas y configuración base de Tailwind.

### JS Modules (`public/resources/js/`)

El orden de carga de los módulos importa y está definido en `BaseLayout.astro`:

1. `supabase-client.js` → `window.SupabaseClient`: Cliente Supabase inicializado.
2. `utils.js` → `window.Utils`: Helpers compartidos: `getDb()`, `userId()`, `esc()` (XSS), `lockBody()`, `unlockBody()`, `redirectToLogin()`, `$(id)`. **Debe cargarse antes que todos los demás módulos.**
3. `auth.js` → `window.Auth`: Sesión, perfil (incluye `ai_custom_instructions`), login/logout.
4. `main.js`: Motor central del quiz.
5. `quiz-parser-core.js`: Parser de preguntas desde `.txt`.
6. `quiz-data.js`: Gestión de datos del quiz.
7. `formatters.js`: Formateadores de texto (Markdown, LaTeX, código).
8. `failures.js` → `window.Failures`: Seguimiento de preguntas falladas.
9. `test-progress.js` → `window.TestProgress`: Guardado/restauración de progreso.
10. `exam-mode.js` → `window.ExamMode`: Modo examen con cronómetro y calificación.
11. `reports.js` → `window.Reports`: Sistema de reportes de errores.
12. `ai-features.js` → `window.AIFeatures`: Drawer de explicación con IA (Gemini, Groq, DeepSeek). Lee instrucciones personalizadas desde `window.Auth.getProfile().ai_custom_instructions`.
13. `ai-generate.js` → `window.AIGenerate`: Generación de preguntas con IA.
14. `notifications.js` → `window.Notifications`: Notificaciones en tiempo real (Supabase Realtime).

### Data & Backend

- `public/resources/data/*.txt`: Datasets de preguntas.
- `supabase/migrations/`: Migraciones SQL en orden numérico.

## 5. Database Schema (Tablas Supabase)

- `profiles`: Usuario (username, avatar_url, role, banned, **ai_custom_instructions**).
- `subjects`: Asignaturas disponibles.
- `sections`: Secciones/bloques de preguntas por asignatura.
- `questions`: Preguntas (con soporte para contribuciones de usuarios).
- `options`: Opciones de respuesta por pregunta.
- `reports`: Reportes de errores en preguntas (pendiente / aceptado / rechazado).
- `user_failures`: Preguntas falladas por usuario.
- `test_progress`: Progreso guardado por sección.
- `notifications`: Notificaciones (report_accepted, report_rejected, contribution_accepted, contribution_rejected, announcement).
- `api_keys_encrypted`: Claves de API de IA encriptadas con AES-256.

## 6. Coding Conventions (Convenciones de Código)

- **Nomenclatura datos**: Los archivos de preguntas se llaman `[id-asignatura]Preguntas.txt` (excepciones explícitas en `main.js`).
- **UI/UX**: Usa clases Tailwind respetando las variables semánticas (`surface`, `background`, `text-main`, `text-muted`, `border-subtle`) de `global.css`. Nunca hardcodees colores que rompan el modo oscuro. Usa las clases de utilidad de `global.css`: `.btn`, `.btn-primary`, `.btn-ghost`, `.mi-sm/md/lg/xl` (iconos Material Icons), `.spinner`, `.modal-enter`.
- **XSS**: Usa siempre `window.Utils.esc(str)` antes de interpolar datos externos en `innerHTML`. Nunca interpoles directamente.
- **CSS dinámico**: El HTML generado mediante `innerHTML` en JS no recibe el scope de Astro. Usa `<style is:global>` para estilos que apliquen a ese HTML.
- **Accesibilidad**: Mantener navegación por teclado (teclas 1-5, Enter, etc.) en todos los componentes interactivos.
- **Rendimiento**: Preferir `<script is:inline>` para librerías de terceros. No hinchar el bundle de Astro.
- **Notificaciones**: Los mensajes insertados en `notifications` deben estar en español e indicar claramente el resultado (aceptado/rechazado) sin ambigüedad.

## 7. "Never" Section (Lo que NUNCA debes hacer)

- **NUNCA** uses `localStorage` como fuente de verdad para ningún dato o preferencia del usuario. El `localStorage` es exclusivamente un caché de arranque (anti-FOUC) que `auth.js` rellena desde Supabase al iniciar sesión. Toda escritura de preferencias va a Supabase; el `localStorage` se actualiza solo como reflejo.
- **NUNCA** introduzcas frameworks JS reactivos (React, Vue, Svelte) para la lógica core; mantén Vanilla JS estricto.
- **NUNCA** alteres el formato posicional y de salto de línea de los archivos `.txt` de preguntas.
- **NUNCA** asumas SSR; Astro opera aquí como SSG puro.
- **NUNCA** uses colores hardcodeados en HTML/CSS que rompan el modo oscuro.
- **NUNCA** expongas claves de API en el frontend; las claves de IA se guardan encriptadas en `api_keys_encrypted` mediante RPCs.

## 8. Specific Commands (Comandos Específicos)

- `npm install` — Instalar dependencias.
- `npm run dev` — Servidor de desarrollo en `localhost:4321`.
- `npm run build` — Compilación estática (`dist/`).
- `npm run preview` — Previsualizar la build de producción.
- `npm test` — Ejecuta el suite de tests con Vitest (tests en `tests/quiz-parser-core.test.js`).

Para correr un test concreto: `npx vitest run tests/quiz-parser-core.test.js`.

## 9. Pointers to Reference Files (Puntos de Referencia)

- **Sistema de Diseño y Paletas**: `src/styles/global.css`.
- **Orden de carga de scripts**: `src/layouts/BaseLayout.astro`.
- **Migraciones y esquema**: `supabase/migrations/` (en orden numérico).
- **Documentación de usuario**: `README.md`.
