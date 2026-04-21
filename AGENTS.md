# DCA Test UA — Guía del Proyecto

## Descripción
**DCA Test UA** es una plataforma web interactiva diseñada para que estudiantes de Ingeniería Informática de la Universidad de Alicante (UA) practiquen con baterías de preguntas de exámenes reales y simulacros. 

El sistema permite navegar por diferentes asignaturas, responder cuestionarios con retroalimentación inmediata, visualizar fórmulas matemáticas complejas (LaTeX) y fragmentos de código, todo integrado en una interfaz moderna con soporte para modo oscuro.

## Stack Tecnológico
- **Framework**: [Astro 5](https://astro.build/) (Generación Estática + Rutas Dinámicas).
- **Lógica Core**: JavaScript purista (Vanilla JS) en el cliente.
- **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/) + CSS nativo.
- **Matemáticas**: [KaTeX](https://katex.org/) para renderizado de fórmulas LaTeX.
- **Resaltado de Código**: [Prism.js](https://prismjs.com/) para bloques de código C++ y otros.
- **Despliegue**: Optimizado para Vercel (ver `astro.config.mjs`).

## Estructura del Repositorio
```
/
├── AGENTS.md                ← esta guía
├── README.md                 ← documentación de usuario
├── public/                  ← activos estáticos y motor JS
│   └── resources/
│       ├── data/            ← datasets de preguntas (.txt)
│       ├── js/
│       │   └── main.js      ← motor principal del quiz
│       └── css/             ← estilos de librerías externas
├── src/                     ← código fuente Astro
│   ├── components/          ← componentes UI (modales, etc.)
│   ├── layouts/             ← BaseLayout.astro (layout maestro)
│   ├── pages/               ← rutas (index, [subject], resumen)
│   └── styles/              ← CSS global y configuración Tailwind
└── astro.config.mjs         ← configuración del framework
```

## Protocolo de Datos (Preguntas)
Las preguntas se almacenan en archivos `.txt` dentro de `public/resources/data/` con el siguiente formato:
```text
Enunciado de la pregunta (soporta Markdown e imágenes)
Índice de respuesta correcta (1-N) o lista (1,2)
- Opción A
- Opción B
- Opción C
- Opción D
[Línea en blanco opcional]
```
- **Soporte de Código**: Usa triple backtick ` ``` ` para bloques de código.
- **Soporte LaTeX**: Usa `$$ ... $$` para fórmulas matemáticas.
- **Imágenes**: Usa sintaxis Markdown `![Alt](URL){width=X height=Y}`.

## Conceptos de Implementación
1. **Motor Mono-Archivo (`main.js`)**: Maneja la carga asíncrona de archivos `.txt`, el parseo, la mezcla (shuffle), el control de estado de la sesión y la validación de respuestas.
2. **Navegación Fluida**: Se guarda el estado de cada pregunta en `estadosPreguntas` para permitir navegar hacia atrás sin perder las selecciones ni los resultados.
3. **Rutas Dinámicas**: `src/pages/[subject].astro` captura el ID de la asignatura de la URL y lo pasa al motor JS para cargar el dataset correspondiente.
4. **Resumen de Resultados**: Al finalizar, el sistema calcula estadísticas y permite visualizarlas en una vista dedicada que puede exportarse (vía session storage).

## Comandos de Desarrollo
- `npm install`: Instala dependencias.
- `npm run dev`: Inicia el servidor de desarrollo en `http://localhost:4321`.
- `npm run build`: Genera el sitio estático para producción.
- `npm run preview`: Previsualiza la build de producción localmente.

## Estándares de Código
- **Nomenclatura**: Nombres de archivos de datos deben seguir el patrón `[id-asignatura]Preguntas.txt` (con excepciones mapeadas en `main.js`).
- **UI/UX**: Mantener fidelidad a las variables de color globales definidas en `global.css` (Tailwind 4).
- **Accesibilidad**: Todos los botones de opciones deben ser accesibles vía teclado (números 1-5 y Enter).
- **Rendimiento**: Evitar dependencias pesadas innecesarias; preferir librerías `is:inline` que no saturen el bundle de Astro si el peso es crítico.
