# Especificaciones Funcionales — Informatica Test UA

> Documento de referencia para el desarrollo de nuevas funcionalidades.
> Stack: Astro 5 (SSG) · Vanilla JS · Tailwind CSS 4 · Supabase (Auth + PostgreSQL + RLS)

---

## 1. Roles del Sistema

El sistema tiene únicamente **dos tipos de usuario**:

| Rol | Origen | Capacidades |
|-----|--------|-------------|
| `user` | Registro público en la web | Ver preguntas, reportar, enviar preguntas nuevas, guardar fallos, usar el foro |
| `admin` | Alta manual exclusiva en Supabase (sin registro público) | Todo lo anterior + gestionar reportes, aceptar/rechazar contribuciones y reportes |

**Regla crítica**: No existe ningún formulario de registro de administrador en la web. La cuenta de admin se crea directamente desde el panel de Supabase y se le asigna manualmente `role = 'admin'` en la tabla `profiles`. Cualquier usuario que se registre desde la web obtiene `role = 'user'` automáticamente.

---

## 2. Reportar Preguntas

### 2.1 ¿Quién puede reportar?

Cualquier usuario con sesión iniciada puede reportar una pregunta. Un mismo usuario **no puede reportar la misma pregunta más de una vez**.

### 2.2 Flujo de reporte

1. El usuario hace clic en el botón **"Reportar"** dentro de una pregunta.
2. Aparece un modal con:
   - **Motivo** (selector obligatorio):
     - Respuesta incorrecta
     - Pregunta duplicada
     - Pregunta desactualizada
     - Otro
   - **Detalles** (campo de texto libre, obligatorio): para que el usuario explique el problema.
3. Al enviar, el reporte queda registrado con estado `pendiente`.
4. El usuario ve una confirmación: *"Reporte enviado. Gracias por contribuir a mejorar el contenido."*

### 2.3 Contador de reportes por pregunta

- Cada pregunta muestra públicamente un **contador de reportes** (`report_count`).
- El contador es visible para **todos los usuarios** (con o sin sesión), directamente en la tarjeta de la pregunta durante el test.
- Propósito: avisar a otros usuarios de que esa pregunta es sospechosa, para que no confíen ciegamente en la respuesta marcada como correcta.
- **Texto de aviso sugerido** (aparece cuando el contador ≥ 1):
  > ⚠️ *N usuarios han reportado esta pregunta. La respuesta podría no ser correcta.*
- **Reinicio del contador**: cuando el admin acepta un reporte y modifica la respuesta correcta de la pregunta, el contador se reinicia a 0 automáticamente y todos los reportes asociados a esa pregunta pasan a estado `resuelto`.

### 2.4 Estados de un reporte

| Estado | Descripción |
|--------|-------------|
| `pendiente` | Recién enviado, pendiente de revisión por el admin |
| `aceptado` | El admin lo ha revisado y ha modificado la pregunta |
| `rechazado` | El admin lo ha revisado y ha considerado que la pregunta es correcta |

### 2.5 Visibilidad del estado para el usuario

El usuario puede consultar el estado de sus reportes en su perfil (sección *"Mis reportes"*). Ve: pregunta reportada, motivo enviado, estado actual y, si fue aceptado, una nota de que la pregunta fue corregida.

---

## 3. Gestión de Reportes por el Admin

### 3.1 Panel de administración

El admin accede a `/admin` (ruta protegida por rol). El acceso se verifica en el cliente: si `profile.role !== 'admin'` se redirige al inicio.

El panel tiene una sección **"Reportes pendientes"** con:
- Lista de reportes ordenados por número de reportes por pregunta (más reportada primero).
- Por cada reporte: enunciado de la pregunta, opciones actuales, motivo del reporte, detalles del usuario, fecha.
- Si hay múltiples reportes sobre la misma pregunta, se agrupan bajo esa pregunta.

### 3.2 Acciones del admin sobre un reporte

**Aceptar reporte** (la pregunta tiene un error):
1. El admin selecciona cuál es la opción correcta real (o edita el enunciado si procede).
2. Al confirmar:
   - Se actualiza `is_correct` en la tabla `options` de esa pregunta.
   - Todos los reportes de esa pregunta pasan a estado `aceptado`.
   - El `report_count` de la pregunta se reinicia a 0.
   - Se envía una notificación a cada usuario que reportó: *"Tu reporte sobre la pregunta X fue aceptado. La respuesta ha sido corregida."*

**Rechazar reporte** (la pregunta es correcta):
1. El admin puede añadir una nota opcional explicando por qué la rechaza.
2. Al confirmar:
   - El reporte pasa a estado `rechazado`.
   - El `report_count` **se reinicia a 0** (la pregunta ha sido revisada y confirmada como correcta).
   - Se envía una notificación al usuario que reportó: *"Tu reporte fue revisado. La respuesta ha sido confirmada como correcta."*

**Eliminar pregunta**:

1. El admin puede eliminar una pregunta (por ejemplo, si está desactualizada o es inválida).
2. Al confirmar la eliminación:
   - La pregunta se elimina de la base de datos.
   - Todos los reportes asociados a esa pregunta se eliminan en cascada.
   - No se envía notificación a los usuarios que la reportaron.

**Banear usuario**:

1. El admin puede banear a cualquier usuario desde el panel.
2. Al confirmar el baneo:
   - El campo `banned = true` se actualiza en la tabla `profiles`.
   - La cuenta queda **suspendida**: el usuario no puede iniciar sesión ni acceder a ninguna funcionalidad que requiera sesión.
   - Si el usuario tenía sesión activa, se le cierra la sesión en el siguiente request.
3. El admin puede **desbanear** al usuario en cualquier momento, restaurando el acceso normal.

---

## 4. Contribución de Preguntas Nuevas

### 4.1 ¿Quién puede contribuir?

Cualquier usuario con sesión iniciada puede enviar una pregunta nueva para una asignatura y sección.

### 4.2 Flujo de contribución

1. El usuario accede al formulario de contribución (botón visible en la página de cada asignatura o sección).
2. Rellena:
   - **Asignatura** (preseleccionada si viene desde una página de asignatura).
   - **Sección / Tema** (selector desplegable).
   - **Enunciado** de la pregunta.
   - **4 opciones de respuesta** (mínimo 2, máximo 4), marcando cuál es la correcta.
   - **Adjunto** (opcional): el usuario puede adjuntar una imagen o un bloque de código para complementar el enunciado.
3. Al enviar, la contribución queda con estado `pendiente`.
4. El usuario ve: *"Pregunta enviada. El equipo la revisará próximamente."*

### 4.3 Gestión de contribuciones por el admin

En el panel `/admin`, sección **"Contribuciones pendientes"**:
- Lista de preguntas enviadas con: asignatura, sección, enunciado, opciones, explicación, usuario que la envió, fecha.
- Acciones:
  - **Aceptar**: la pregunta se añade oficialmente al banco de preguntas de esa asignatura con estado `aprobado`. Se notifica al usuario: *"Tu pregunta para [Asignatura] fue aceptada y ya está disponible."*
  - **Rechazar**: el admin puede indicar el motivo (opcional). La contribución pasa a `rechazado`. Se notifica al usuario: *"Tu contribución para [Asignatura] no fue aceptada. [Motivo opcional]."*

### 4.4 Visibilidad para el usuario

En su perfil, sección *"Mis contribuciones"*, el usuario ve: enunciado enviado, asignatura, estado actual (`pendiente` / `aceptado` / `rechazado`) y, si fue rechazado, el motivo.

---

## 5. Funcionalidades que Requieren Sesión Iniciada

Las siguientes funciones **solo están disponibles para usuarios con sesión activa**. Si un usuario sin sesión intenta acceder, se le redirige a la página de login con un mensaje explicativo.

### 5.1 Guardar preguntas falladas

- Cuando un usuario responde incorrectamente una pregunta durante un test, esta se guarda **automáticamente** en su lista de fallos para esa sección.
- En cada sección hay un modo **"Repasar fallos"** accesible directamente desde la página de la sección, que muestra únicamente las preguntas falladas en orden aleatorio.
- Si el usuario acierta una pregunta en el modo de repaso, **se elimina automáticamente** de su lista de fallos.
- Si la vuelve a fallar en el repaso, permanece en la lista.
- Si falla la misma pregunta en múltiples sesiones de test normales, no se duplica: simplemente se mantiene en la lista.

### 5.2 Reportar preguntas

Descrito en el punto 2. Requiere sesión.

### 5.3 Consultar estado de reportes y contribuciones

Descrito en los puntos 2.5 y 4.4. Accesible desde el perfil del usuario.

### 5.4 Progreso de test por módulo

- El sistema guarda automáticamente el progreso de cada test iniciado, organizado por asignatura y sección (módulo).
- Si el usuario abandona un test a mitad, al volver a entrar en esa sección puede **retomar el test** desde donde lo dejó, con las respuestas ya dadas conservadas.
- Solo se guarda un progreso activo por sección: si el usuario inicia un nuevo test en una sección que ya tenía progreso guardado, el progreso anterior se descarta.
- Al completar el test el progreso guardado se elimina.

### 5.5 Foro por asignatura

- Cada asignatura tiene su propio hilo de foro.
- El foro es **público en lectura**: cualquier usuario (con o sin sesión) puede leer los hilos y posts.
- Para **crear un hilo nuevo o responder** es necesario tener sesión iniciada.
- Funcionalidades del foro:
  - Crear un hilo nuevo con título y mensaje.
  - Responder a un hilo existente.
  - Votar positivamente (👍) una respuesta.
  - El admin puede **pinear** hilos importantes o **bloquear** hilos (no se pueden añadir más respuestas).

---

## 6. Modo Examen Real

### 6.1 Configuración previa

Antes de iniciar, el usuario configura el examen mediante un formulario:

- **Puntuación por pregunta correcta**: valor numérico que suma cada acierto (ej. `0.5`).
- **Penalización por pregunta incorrecta**: valor numérico que resta cada fallo (ej. `0.25`).
- **Número de preguntas**: cantidad de preguntas a incluir. No puede superar el total disponible en el banco de preguntas de esa sección.

### 6.2 Durante el examen

- Las preguntas se muestran en orden aleatorio.
- En la parte superior aparece un **contador de tiempo** (cronómetro ascendente) que muestra cuánto tiempo lleva el usuario realizando el examen.
- El usuario puede navegar entre preguntas y cambiar su respuesta antes de finalizar.
- No hay retroalimentación inmediata: no se indica si la respuesta es correcta hasta que el examen termina.

### 6.3 Resultados

Al finalizar el examen se muestra un resumen con:

- Tiempo total empleado.
- Número de aciertos, fallos y preguntas sin responder.
- Puntuación final calculada según los valores configurados.
- Desglose pregunta a pregunta: respuesta dada, respuesta correcta e indicación de acierto/fallo.

---

## 7. Funcionalidades Existentes que se Mantienen

Las siguientes funcionalidades ya existen y **no deben verse afectadas** por los cambios:

- Navegación y selección de asignaturas desde la página de inicio.
- Modo test con preguntas aleatorias por sección.
- Navegación entre preguntas con teclado (teclas 1–4, Enter, flechas).
- Renderizado de fórmulas matemáticas con KaTeX.
- Resaltado de código con Prism.js.
- Soporte de imágenes en preguntas.
- Retroalimentación inmediata al responder (respuesta correcta/incorrecta).
- Modo oscuro / claro.
- Los ficheros `.txt` en `public/resources/data/` se conservan en el repositorio únicamente como respaldo de referencia. En la web, **todas las preguntas se consultan desde Supabase**, no desde los ficheros locales.

---

## 8. Autenticación y Sesión

- **Método**: Google OAuth exclusivamente, gestionado por Supabase Auth. No hay formulario de email/contraseña para usuarios normales.
- **Excepción admin**: la cuenta de admin se da de alta manualmente en Supabase con email/contraseña. No inicia sesión con Google.
- **Flujo de login**:
  1. El usuario hace clic en "Iniciar sesión con Google".
  2. Supabase redirige a la pantalla de selección de cuenta de Google.
  3. Tras autenticarse, Google redirige de vuelta a la web con la sesión activa.
  4. Si es la primera vez que ese usuario entra, se crea automáticamente su `profile` (trigger en BD) usando el nombre y foto de su cuenta de Google.
- **No hay página de registro separada**: el primer login con Google ya registra al usuario.
- **Persistencia de sesión**: la sesión se mantiene activa entre visitas (localStorage gestionado por el SDK de Supabase).
- **Páginas de auth**:
  - `/login`: página con únicamente el botón "Continuar con Google".
  - `/perfil`: perfil propio del usuario (accesible solo con sesión).
- **Cierre de sesión**: botón disponible en la barra de navegación cuando el usuario está logueado.

---

## 9. Perfil de Usuario

### 9.1 Generación automática al registrarse

Cuando un usuario inicia sesión con Google por primera vez, el sistema genera automáticamente:

- **Nombre de usuario**: formato `user` seguido de una cadena de dígitos aleatorios (ej. `user482931`). Se garantiza unicidad comprobando que no exista ya en la tabla `profiles`.

Estos valores se crean en el trigger de BD que ya crea el `profile` tras el primer login con Google.

### 9.2 Ajustes de perfil (`/perfil/ajustes`)

El usuario accede desde su perfil a una página de ajustes donde puede:

- **Cambiar nombre de usuario** (campo de texto): se valida que no esté en uso y que cumpla el formato (solo letras, números y guiones bajos, entre 3 y 30 caracteres).
- **Regenerar avatar aleatoriamente** (botón "Nuevo avatar"): realiza una nueva llamada a `/api/v1/random` y actualiza `profiles.avatar_url` con el resultado. El usuario puede pulsar el botón tantas veces como quiera hasta encontrar un avatar que le guste.

Los cambios se guardan explícitamente con un botón **"Guardar cambios"**.

### 9.3 Panel "Mis reportes"

Dentro de `/perfil`, el usuario dispone de una sección **"Mis reportes"** con una tabla que muestra:

| Campo | Descripción |
| ----- | ----------- |
| Pregunta reportada | Enunciado (truncado) con enlace a la asignatura |
| Motivo | El motivo seleccionado al reportar |
| Detalles | El texto libre que introdujo |
| Estado | `pendiente` / `aceptado` / `rechazado` (con badge de color) |
| Fecha | Fecha en que se envió el reporte |
| Nota del admin | Visible solo si el reporte fue rechazado y el admin dejó nota |

Los reportes se ordenan por fecha descendente (más reciente primero). No hay límite de reportes mostrados, pero se pagina a partir de 20 entradas.

---

## 10. Notificaciones

Las notificaciones son internas a la web (no por email). El usuario las ve en un icono de campana en la barra de navegación (solo si tiene sesión).

| Evento | Quién la recibe | Mensaje |
|--------|----------------|---------|
| Reporte aceptado | Usuario que reportó | "Tu reporte fue aceptado. La respuesta ha sido corregida." |
| Reporte rechazado | Usuario que reportó | "Tu reporte fue revisado. La respuesta es correcta." |
| Contribución aceptada | Usuario que contribuyó | "Tu pregunta para [Asignatura] ya está disponible." |
| Contribución rechazada | Usuario que contribuyó | "Tu contribución no fue aceptada. [Motivo]" |
| Respuesta en el foro | Autor del hilo | "Alguien ha respondido a tu hilo en [Asignatura]." |

Las notificaciones se marcan como leídas al abrirlas. No hay límite de notificaciones almacenadas, pero el contador del icono solo muestra las no leídas.

---

## 11. Restricciones y Reglas de Negocio

1. Un usuario **no puede reportar la misma pregunta dos veces**.
2. Las preguntas con `report_count >= 5` pueden destacarse visualmente con un aviso más prominente (umbral configurable).
3. El admin **no tiene página de registro pública**. Su cuenta se gestiona íntegramente desde el panel de Supabase.
4. Todos los datos del usuario (fallos guardados, reportes, contribuciones) se eliminan si el usuario borra su cuenta.
5. Un usuario baneado no puede iniciar sesión ni usar ninguna funcionalidad que requiera sesión. El baneo es reversible por el admin.
