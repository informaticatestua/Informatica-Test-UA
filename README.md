<div align="center">
  <h1>🖥️ DCA Test UA</h1>
  <p><em>Plataforma web ágil e interactiva de simulación de pruebas para estudiantes universitarios.</em></p>

  <p>
    <a href="https://github.com/usuario/dca">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
    </a>
    <a href="https://github.com/usuario/dca/releases">
      <img src="https://img.shields.io/badge/version-1.0.0-green.svg" alt="Version">
    </a>
    <a href="https://github.com/usuario/dca/stargazers">
      <img src="https://img.shields.io/github/stars/usuario/dca?style=social" alt="Estrellas de GitHub">
    </a>
    <img src="https://img.shields.io/badge/tech-HTML5%20%7C%20CSS3%20%7C%20JS-orange.svg" alt="Tecnologías usadas">
    <img src="https://img.shields.io/badge/status-activo-brightgreen.svg" alt="Estado del proyecto">
  </p>
</div>

Diseñada con un enfoque de alto rendimiento para cargar baterías de preguntas de Ingeniería Informática, permitiendo realizar repasos instantáneos, mantener el progreso bidireccionalmente y verificar soluciones con explicaciones matemáticas (LaTeX).

---

## 📸 Screenshots

<div align="center">
  <!-- TODO: añadir captura Pantalla de inicio / menú -->
  <img src="screenshots/inicio.png" width="700" alt="Pantalla de inicio / menú"/>
  <br/><br/>
  <!-- TODO: añadir captura Vista de pregunta activa -->
  <img src="screenshots/pregunta_activa.png" width="700" alt="Vista de pregunta activa"/>
  <br/><br/>
  <!-- TODO: añadir captura Vista de respuesta correcta e incorrecta -->
  <img src="screenshots/validacion.png" width="700" alt="Vista de respuesta correcta e incorrecta"/>
  <br/><br/>
  <!-- TODO: añadir captura Vista de resumen final -->
  <img src="screenshots/resumen.png" width="700" alt="Vista de resumen final"/>
</div>

---

## ✨ Características principales

- ⚡ **Rendimiento Ultrarrápido**: Construida sobre tecnologías estáticas y **Astro** para un LCP cercano a 0.
- 🌓 **Modo Oscuro Integrado**: Tematización inteligente (`dark/light theme`) adaptado a las preferencias del usuario.
- 🔙 **Historial Constante**: Navegación de preguntas guardando estado (forward/backward) que previene perder tu puntuación o avance accidental.
- 📱 **Soporte Responsivo**: Optimizado para estudiar en móvil, tablet o PC gracias a estilos en cascada CSS/Tailwind.
- 📋 **Acciones de Productividad**: Funciones nativas de portapapeles (`Clipboard API`) para llevarte la pregunta o revisar las fórmulas matemáticas interactivas de las opciones.

---

## 🛠️ Tech Stack

| Tecnología | Uso |
|------------|-----|
| **HTML5**      | Estructura y semántica de componentes |
| **CSS3 / Tailwind**| Estilos en cascada globales, Shadow DOM y tema oscuro |
| **JavaScript** | Lógica purista (Vanilla JS) del quiz, validación y estados |
| **Astro**      | Framework generador de múltiples rutas y compilado rápido |

---

## 🚀 Instalación y uso

Instrucciones para levantar el proyecto de DCA localmente:

1. Clona el repositorio:
```bash
git clone https://github.com/usuario/dca.git
```

2. Accede al directorio del proyecto local:
```bash
cd dca
```

3. Instala todas las dependencias modulares:
```bash
npm install
```

4. Arranca el motor de servidor en entorno de desarrollo:
```bash
npm run dev
```

5. Abre en tu navegador la URL `http://localhost:4321`.

---

## 📂 Estructura del proyecto

```text
dca/
├── public/                 # Recursos e imágenes públicas
│   └── resources/
│       ├── data/           # Ficheros TXT con las baterías de tests
│       └── js/             # Motor de validación Vanilla JS (main.js)
├── src/                    # Origen y componentes
│   ├── layouts/            # Plantillas maestras (BaseLayout, ResumenLayout)
│   ├── pages/              # Astro pages and dynamic routes ([subject].astro)
│   └── styles/             # Archivos CSS globales
├── screenshots/            # Directorio local de muestras visuales
├── package.json            # Scripts y dependencias generales
└── README.md               # Documentación de ayuda y setup
```

---

## 🤝 Contribución

Cualquier mejora en los cuestionarios o funcionalidades adicionales es completamente bienvenida. Para contribuir el proceso es estandarizado:

1. Haz un **Fork** de este proyecto.
2. Crea tu rama de despliegue particular (`git checkout -b feature/NuevaCaracteristica`).
3. Envía tus commits (`git commit -m 'Añadir alguna NuevaCaracteristica'`).
4. Sube la rama remotamente (`git push origin feature/NuevaCaracteristica`).
5. Abre un **Pull Request** para nuestra revisión.

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT** - consulta los detalles explícitos dentro de cada componente y repositorio principal en `LICENSE`.

---

<div align="center">
  <p>Hecho con ❤️ por estudiantes de la <a href="https://www.ua.es">UA</a></p>
</div>
