let totalPreguntas = 0;
let preguntasCorrectas = 0;
let archivoActual = "";
let estadosPreguntas = {}; // index: state mapping

async function cargarPreguntas(archivo) {
    const response = await fetch("/resources/data/" + archivo);

    // 1. Comprobamos si el servidor nos dice explícitamente que no existe (Error 404)
    if (!response.ok) {
        throw new Error("Archivo no encontrado (404)");
    }

    let preguntasTxt = await response.text();

    // 2. Comprobamos si el servidor nos ha intentado engañar devolviendo código HTML
    if (
        preguntasTxt.trim().toLowerCase().startsWith("<!doctype html>") ||
        preguntasTxt.trim().toLowerCase().startsWith("<html")
    ) {
        throw new Error("Se recibió una página web en lugar de las preguntas");
    }

    // Si todo está bien, limpiamos el texto como antes
    preguntasTxt = preguntasTxt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    return preguntasTxt;
}

async function cargarMultiplesArchivos(archivos) {
    let todasLasPreguntas = [];

    // Cargar cada archivo y combinar las preguntas
    for (const archivo of archivos) {
        try {
            const preguntasTxt = await cargarPreguntas(archivo);
            const preguntasDelArchivo = preguntasTxt.split(/\n{2,}/).map((preguntaTxt) => {
                const [pregunta, respuesta, ...opciones] = preguntaTxt.split("\n");
                const respuestasCorrectasOriginal = respuesta.split(",").map((r) => parseInt(r.trim()));

                // Detectar duplicados
                const respuestasUnicas = Array.from(new Set(respuestasCorrectasOriginal));
                const hasDuplicates = respuestasCorrectasOriginal.length !== respuestasUnicas.length;

                const opcionesMezcladas = shuffleArray([...opciones]);
                const respuestasMezcladas = respuestasUnicas.map((r) => opcionesMezcladas.indexOf(opciones[r - 1]) + 1);

                return {
                    pregunta,
                    respuestas: respuestasMezcladas,
                    opciones: opcionesMezcladas,
                    multiple: hasDuplicates || respuestasMezcladas.length > 1,
                };
            });

            todasLasPreguntas = todasLasPreguntas.concat(preguntasDelArchivo);
        } catch (error) {
            console.error(`Error cargando el archivo ${archivo}:`, error);
        }
    }

    return todasLasPreguntas;
}

const resumenBtn = document.getElementById("resumenBtn");
if (resumenBtn) {
    resumenBtn.addEventListener("click", function () {
        // Cogemos la URL actual limpia (ej: "/sds-no-oficial")
        const currentPath = window.location.pathname.replace(/\/$/, "");

        if (archivoActual === "SDSFULL") {
            sessionStorage.setItem(
                "sdsfullArchivos",
                JSON.stringify([
                    "sds01-presentacionPreguntas.txt",
                    "sds02-introgoPreguntas.txt",
                    "sds03-introcriptoPreguntas.txt",
                    "sds04-aleatoriosPreguntas.txt",
                    "sds05-flujoPreguntas.txt",
                    "sds06-bloquePreguntas.txt",
                    "sds07-hashPreguntas.txt",
                    "sds08-publicaPreguntas.txt",
                    "sds09-transportePreguntas.txt",
                    "sds10-ejerciciosPreguntas.txt",
                    "sds11-malwarePreguntas.txt",
                    "sds12-ataquesPreguntas.txt",
                    "sds13-wirelessPreguntas.txt",
                    "sds14-recomendacionesPreguntas.txt",
                ]),
            );
        }

        // Redirigimos a la nueva URL limpia: "/sds-no-oficial/resumen"
        window.location.href = currentPath + "/resumen";
    });
}

let preguntas = [];

function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden"); // Solo lo oculta si el elemento existe
}

function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden"); // Solo lo muestra si el elemento existe
}

function cerrarTodasLasSublistas() {
    // Obtener todas las sublistas (elementos que terminan con -sublist)
    const sublistas = document.querySelectorAll('[id$="-sublist"]');
    // Ocultar cada sublista
    sublistas.forEach((sublista) => {
        sublista.style.display = "none";
    });
}

function iniciarAsignatura(archivo) {
    resetAppState();
    document.getElementById("resumenBtn").style.display = "block";
    document.getElementById("copyButton").style.display = "flex";
    archivoActual = archivo;

    const asignaturaNombre = archivo.split("Preguntas.txt")[0].toUpperCase();
    document.querySelector("#asignatura-nombre .title-main").innerText = asignaturaNombre;

    cargarPreguntas(archivo)
        .then((preguntasTxt) => {
            preguntas = preguntasTxt.split(/\n{2,}/).map((preguntaTxt) => {
                // ... (todo tu código interno del map se queda exactamente igual) ...
                const [pregunta, respuesta, ...opciones] = preguntaTxt.split("\n");
                const respuestasCorrectasOriginal = respuesta.split(",").map((r) => parseInt(r.trim()));

                const respuestasUnicas = Array.from(new Set(respuestasCorrectasOriginal));
                const hasDuplicates = respuestasCorrectasOriginal.length !== respuestasUnicas.length;

                const opcionesMezcladas = shuffleArray([...opciones]);
                const respuestasMezcladas = respuestasUnicas.map((r) => opcionesMezcladas.indexOf(opciones[r - 1]) + 1);

                return {
                    pregunta,
                    respuestas: respuestasMezcladas,
                    opciones: opcionesMezcladas,
                    multiple: hasDuplicates || respuestasMezcladas.length > 1,
                };
            });

            document.getElementById("total-preguntas").innerText = `Total: ${preguntas.length}`;
            shuffle(preguntas);
            mostrarPregunta();
        })
        .catch((error) => {
            // AQUÍ ESTÁ LA PROTECCIÓN: Si falla la carga, redirigimos al menú principal (index.html)
            console.warn("URL inválida o asignatura no encontrada:", error);
            window.location.href = "/";
        });

    hideElement("asignaturas-container");
    hideElement("app-title");
    showElement("verificar");
    showElement("volver");
    showElement("total-preguntas");
    showElement("contador");
}

let preguntaActual = 0;

function mostrarPregunta() {
        // Botón Verificar deshabilitado hasta seleccionar opción
        const verificarBtn = document.getElementById("verificar");
        if (verificarBtn) {
            verificarBtn.disabled = true;
        }

        // Botones secundarios accesibles
        const volverBtn = document.getElementById("volver-pregunta");
        if (volverBtn) {
            volverBtn.tabIndex = 0;
            volverBtn.setAttribute("aria-label", "Anterior");
        }
        const saltarBtn = document.getElementById("saltar-pregunta");
        if (saltarBtn) {
            saltarBtn.tabIndex = 0;
            saltarBtn.setAttribute("aria-label", "Saltar pregunta");
            saltarBtn.onclick = function() {
                guardarEstadoActual();
                preguntaActual = (preguntaActual + 1) % preguntas.length;
                mostrarPregunta();
                restaurarEstadoActual();
            };
        }
    const pregunta = preguntas[preguntaActual];
    const contenedorPregunta = document.getElementById("pregunta");
    const contenedorOpciones = document.getElementById("opciones");


    // Actualizar barra de progreso
    const progressBar = document.getElementById("progress-bar");
    const progressLabel = document.getElementById("progress-label");
    if (progressBar && progressLabel) {
        const total = preguntas.length;
        const actual = preguntaActual + 1;
        progressBar.style.width = `${(actual / total) * 100}%`;
        progressLabel.textContent = `${actual} / ${total}`;
    }

    // Actualizar badge de tema (si hay metadato tema)
    const badgeTema = document.getElementById("badge-tema");
    if (badgeTema) {
        badgeTema.textContent = pregunta.tema || "Tema";
    }

    // Establece el contenido de la pregunta
    contenedorPregunta.innerHTML = formatTextWithCode(pregunta.pregunta);
    Prism.highlightAll();

    // Botón reportar (abre modal reutilizando ContributeModal)
    const reportBtn = document.getElementById("report-btn");
    if (reportBtn) {
        reportBtn.onclick = () => {
            // Reutiliza el modal de contribución pero con campos preseleccionados
            const modal = document.getElementById("contribute-modal");
            const overlay = document.getElementById("contribute-overlay");
            if (modal && overlay) {
                modal.classList.remove("hidden");
                overlay.classList.remove("hidden");
                document.body.style.overflow = "hidden";
                // Preselecciona tipo y placeholder
                const tipo = document.getElementById("contrib-tipo");
                if (tipo) tipo.value = "reportar-error";
                const textarea = document.getElementById("contrib-descripcion");
                if (textarea) textarea.placeholder = "Describe el error: ¿qué pregunta es? ¿qué está mal (enunciado, opción incorrecta, respuesta errónea)? ¿cuál crees que es la respuesta correcta?";
            }
        };
    }

    // Establece el contenido de las opciones (tarjetas/fila, radio, iconos, accesibilidad)
    contenedorOpciones.innerHTML = "";
    pregunta.opciones.forEach((opcion, i) => {
        if (opcion.toUpperCase() !== "NO MARCAR") {
            const input = document.createElement("input");
            input.type = "radio";
            input.name = "opcion";
            input.id = `opcion${i + 1}`;
            input.value = i + 1;
            input.tabIndex = 0;
            input.setAttribute("aria-label", `Opción ${i + 1}`);

            const label = document.createElement("label");
            label.htmlFor = `opcion${i + 1}`;
            label.className = "opcion-card";
            label.setAttribute("tabindex", "0");

            // Indicador circular (radio visual)
            const radioVisual = document.createElement("span");
            radioVisual.className = "radio-indicator";
            radioVisual.setAttribute("aria-hidden", "true");
            radioVisual.style.display = "inline-block";
            radioVisual.style.width = "20px";
            radioVisual.style.height = "20px";
            radioVisual.style.borderRadius = "50%";
            radioVisual.style.border = "2px solid #cbd5e1";
            radioVisual.style.marginRight = "10px";
            radioVisual.style.position = "relative";

            // Opción texto
            const span = document.createElement("span");
            span.innerHTML = splitLongText(opcion);
            span.className = "opcion-label";

            // Icono de estado (check/X)
            const icon = document.createElement("span");
            icon.className = "opcion-icon material-icons";
            icon.style.display = "none";
            label.appendChild(input);
            label.appendChild(radioVisual);
            label.appendChild(span);
            label.appendChild(icon);
            contenedorOpciones.appendChild(label);
        }
    });

    // Renderizar LaTeX en la pregunta y las opciones
    renderMathInElement(contenedorPregunta, {
        delimiters: [{ left: "$$", right: "$$", display: false }],
    });
    renderMathInElement(contenedorOpciones, {
        delimiters: [{ left: "$$", right: "$$", display: false }],
    });

    // Accesibilidad: enfocar la primera opción
    const firstInput = contenedorOpciones.querySelector("input[type='radio']");
    if (firstInput) firstInput.focus();

    // Limpiar feedback y estados
    document.getElementById("feedback-banner").className = "hidden mt-4";
    document.getElementById("feedback-banner").innerHTML = "";
    document.getElementById("verificar").disabled = true;
    document.getElementById("verificar").innerText = "Verificar";

    // Selección y microinteracciones
    contenedorOpciones.querySelectorAll("input[type='radio']").forEach((input) => {
        input.addEventListener("change", (e) => {
            contenedorOpciones.querySelectorAll("label.opcion-card").forEach((l) => l.classList.remove("selected"));
            const label = input.closest("label.opcion-card");
            if (label) label.classList.add("selected");
            document.getElementById("verificar").disabled = false;
        });
        // Accesibilidad: seleccionar con Enter/Espacio
        input.addEventListener("keydown", (e) => {
            if (e.key === " " || e.key === "Enter") {
                input.checked = true;
                input.dispatchEvent(new Event("change"));
            }
        });
    });

    if (preguntaActual > 0) {
        showElement("volver-pregunta");
    } else {
        hideElement("volver-pregunta");
    }
}

// Función para escapar caracteres HTML
function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;") // Debe ser el primero en reemplazarse.
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Función para escapar caracteres HTML
function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;") // Debe ser el primero en reemplazarse.
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Función para formatear el texto con código y procesar imágenes Markdown con dimensiones
function formatTextWithCode(text) {
    // 1. Divide el texto en partes basadas en el delimitador '```'.
    const parts = text.split("```");
    let finalText = "";

    parts.forEach((part, index) => {
        if (index % 2 === 1) {
            // Esta parte es código. Reemplaza '\\n' con '<br>' y '\\t' con espacios.
            // Además, escapa los caracteres especiales de HTML.
            finalText +=
                '<pre><code class="language-cpp">' +
                escapeHTML(part)
                    .replace(/\\n/g, "<br>") // Reemplaza '\\n' con '<br>'.
                    .replace(/\\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;") + // Reemplaza '\\t' con cuatro espacios.
                "</code></pre>";
        } else {
            // Esta parte es texto normal.
            let escapedText = escapeHTML(part)
                .replace(/\\n/g, "<br>") // Asegúrate de que los saltos de línea también se conviertan.
                .replace(/\\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;"); // Y los tabuladores también.

            // 2. Reemplazar la sintaxis de imágenes Markdown por etiquetas <img> con dimensiones.
            // Soporta la sintaxis: ![Alt](URL){width=300 height=200}
            const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g;
            escapedText = escapedText.replace(imageRegex, (match, alt, url, attrs) => {
                let style = "max-width: 100%; height: auto;"; // Estilo por defecto

                if (attrs) {
                    // Parsear los atributos de dimensiones
                    const attrPairs = attrs.split(/\s+/);
                    attrPairs.forEach((pair) => {
                        const [key, value] = pair.split("=");
                        if (key && value) {
                            if (key.toLowerCase() === "width") {
                                style += ` width:${value}px;`;
                            } else if (key.toLowerCase() === "height") {
                                style += ` height:${value}px;`;
                            }
                        }
                    });
                }

                return `<img src="${url}" alt="${alt}" style="${style}" />`;
            });

            finalText += escapedText;
        }
    });

    return finalText;
}

function verificarRespuesta() {
    totalPreguntas++;
    const respuestaSeleccionada = document.querySelectorAll('input[name="opcion"]:checked');
    if (respuestaSeleccionada.length === 0) return;
    const respuestaCorrecta = preguntas[preguntaActual].respuestas;
    const opciones = document.getElementById("opciones");
    const labels = opciones.getElementsByTagName("label");
    let respuestaEsCorrecta = false;
    const seleccionadas = Array.from(respuestaSeleccionada).map((input) => parseInt(input.value));
    const correctas = [...respuestaCorrecta].sort((a, b) => a - b);
    const seleccionadasOrdenadas = [...seleccionadas].sort((a, b) => a - b);
    if (arraysEqual(correctas, seleccionadasOrdenadas)) {
        respuestaEsCorrecta = true;
        preguntasCorrectas++;
    }
    // Estados visuales y feedback
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const input = label.querySelector("input");
        const icon = label.querySelector(".opcion-icon");
        const valor = parseInt(label.htmlFor.replace("opcion", ""));
        label.classList.remove("selected", "correct", "incorrect");
        icon.style.display = "none";
        if (respuestaCorrecta.includes(valor)) {
            label.classList.add("correct");
            if (respuestaEsCorrecta) {
                icon.textContent = "check_circle";
                icon.style.color = "#16a34a";
                icon.style.display = "inline-flex";
            } else {
                icon.textContent = "check_circle";
                icon.style.color = "#16a34a";
                icon.style.display = "inline-flex";
            }
        }
        if (seleccionadas.includes(valor) && !respuestaCorrecta.includes(valor)) {
            label.classList.add("incorrect");
            icon.textContent = "cancel";
            icon.style.color = "#dc2626";
            icon.style.display = "inline-flex";
        }
    }
    // Feedback banner
    const feedback = document.getElementById("feedback-banner");
    feedback.classList.remove("hidden", "success", "error");
    if (respuestaEsCorrecta) {
        feedback.classList.add("success");
        feedback.innerHTML = '<span class="material-icons">check_circle</span> ¡Correcto!';
    } else {
        feedback.classList.add("error");
        let correcta = labels[respuestaCorrecta[0] - 1]?.querySelector(".opcion-label")?.textContent || "";
        feedback.innerHTML = '<span class="material-icons">cancel</span> Incorrecto. La opción correcta era: <b>' + correcta + '</b>';
    }
    document.getElementById("verificar").removeEventListener("click", verificarRespuesta);
    document.getElementById("verificar").addEventListener("click", siguientePregunta);
    document.getElementById("verificar").innerText = "Continuar →";
    actualizarContador();
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function siguientePregunta() {
    guardarEstadoActual();

    preguntaActual = (preguntaActual + 1) % preguntas.length;
    mostrarPregunta();

    document.getElementById("verificar").removeEventListener("click", siguientePregunta);
    document.getElementById("verificar").addEventListener("click", verificarRespuesta);
    document.getElementById("verificar").innerText = "Verificar";
    document.getElementById("resultado").innerText = "";
    
    restaurarEstadoActual();
}

const verificarBtn = document.getElementById("verificar");
if (verificarBtn) {
    verificarBtn.addEventListener("click", verificarRespuesta);
}

function guardarEstadoActual() {
    const respuestaSeleccionada = document.querySelectorAll('input[name="opcion"]:checked');
    const seleccionadas = Array.from(respuestaSeleccionada).map((input) => parseInt(input.value));
    const isVerified = document.getElementById("verificar").innerText === "Siguiente";
    
    estadosPreguntas[preguntaActual] = {
        seleccionadas: seleccionadas,
        isVerified: isVerified
    };
}

function restaurarEstadoActual() {
    const estadoGuardado = estadosPreguntas[preguntaActual];
    if (!estadoGuardado) return;
    
    const opciones = document.getElementById("opciones");
    const inputs = opciones.querySelectorAll("input");
    
    inputs.forEach((input) => {
        const valor = parseInt(input.value);
        if (estadoGuardado.seleccionadas.includes(valor)) {
            input.checked = true;
        }
    });
    
    if (estadoGuardado.isVerified) {
        const respuestaCorrecta = preguntas[preguntaActual].respuestas;
        const labels = opciones.getElementsByTagName("label");
        
        for (let i = 0; i < labels.length; i++) {
            const span = labels[i].querySelector("span");
            const valor = parseInt(labels[i].htmlFor.replace("opcion", ""));
            if (respuestaCorrecta.includes(valor)) {
                span.classList.add("correct");
            }
            if (estadoGuardado.seleccionadas.includes(valor) && !respuestaCorrecta.includes(valor)) {
                span.classList.add("incorrect");
            }
        }
        
        const verificarBtn = document.getElementById("verificar");
        verificarBtn.removeEventListener("click", verificarRespuesta);
        verificarBtn.addEventListener("click", siguientePregunta);
        verificarBtn.innerText = "Siguiente";
    }
}

function volverPreguntaAnterior() {
    if (preguntaActual === 0) return;
    
    guardarEstadoActual();
    
    preguntaActual = preguntaActual - 1;
    mostrarPregunta();
    
    document.getElementById("verificar").removeEventListener("click", siguientePregunta);
    document.getElementById("verificar").addEventListener("click", verificarRespuesta);
    document.getElementById("verificar").innerText = "Verificar";
    document.getElementById("resultado").innerText = "";
    
    restaurarEstadoActual();
}

const volverPreguntaBtn = document.getElementById("volver-pregunta");
if (volverPreguntaBtn) {
    volverPreguntaBtn.addEventListener("click", volverPreguntaAnterior);
}

function toggleTheme() {
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.querySelector("body");

    if (body.classList.contains("dark-theme")) {
        body.classList.remove("dark-theme");
        if (themeToggle) {
            themeToggle.innerHTML = "&#9728;"; // Sol
            themeToggle.classList.remove("dark-mode");
            themeToggle.classList.add("light-mode");
        }
        // Guardamos la preferencia como "light"
        localStorage.setItem("theme", "light");
    } else {
        body.classList.add("dark-theme");
        if (themeToggle) {
            themeToggle.innerHTML = "&#9790;"; // Luna
            themeToggle.classList.remove("light-mode");
            themeToggle.classList.add("dark-mode");
        }
        // Guardamos la preferencia como "dark"
        localStorage.setItem("theme", "dark");
    }
}

const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);

    function cargarTemaGuardado() {
        const savedTheme = localStorage.getItem("theme");
        const themeToggle = document.getElementById("theme-toggle");
        const body = document.querySelector("body");

        // Si el usuario tenía guardado el modo oscuro, lo aplicamos inmediatamente
        if (savedTheme === "dark") {
            body.classList.add("dark-theme");
            if (themeToggle) {
                themeToggle.innerHTML = "&#9790;"; // Luna
                themeToggle.classList.remove("light-mode");
                themeToggle.classList.add("dark-mode");
            }
        }
        // Si era "light" o no hay nada guardado (primera vez), se queda el claro por defecto.
    }

    // Ejecutamos la función nada más cargar el script
    cargarTemaGuardado();
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function resetAppState() {
    hideElement("verificar");
    hideElement("volver");
    hideElement("volver-pregunta");
    showElement("asignaturas-container");
    showElement("app-title");
    document.getElementById("pregunta").innerText = "";
    document.getElementById("opciones").innerHTML = "";
    document.getElementById("resultado").innerText = "";

    document.getElementById("verificar").removeEventListener("click", siguientePregunta);
    document.getElementById("verificar").addEventListener("click", verificarRespuesta);
    document.getElementById("verificar").innerText = "Verificar";
    estadosPreguntas = {};
}

function actualizarContador() {
    const contador = document.getElementById("contador");

    let porcentaje = "";
    if (totalPreguntas !== 0) {
        porcentaje = `| ${Math.round((preguntasCorrectas / totalPreguntas) * 100)}%`;
    }

    contador.innerText = `Correctas: ${preguntasCorrectas} | Contestadas: ${totalPreguntas} ${porcentaje}`;
}

function mostrarContador() {
    const contador = document.getElementById("contador");
    contador.classList.toggle("hidden");
}

document.addEventListener("keydown", (event) => {
    if (event.key === "c" || event.key === "C") {
        mostrarContador();
    }
});

function resetearContador() {
    totalPreguntas = 0;
    preguntasCorrectas = 0;
    actualizarContador();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

document.addEventListener("keydown", (event) => {
    const opciones = document.getElementsByName("opcion");
    if (opciones.length > 0) {
        if (event.key === "1" || event.key === "Numpad1") {
            opciones[0].checked = true;
        } else if (event.key === "2" || event.key === "Numpad2") {
            opciones[1].checked = true;
        } else if (event.key === "3" || event.key === "Numpad3") {
            opciones[2].checked = true;
        } else if (event.key === "4" || event.key === "Numpad4") {
            opciones[3].checked = true;
        } else if (event.key === "5" || event.key === "Numpad5") {
            opciones[4].checked = true;
        } else if (event.key === "Enter" || event.key === "NumpadEnter") {
            const verificarBtn = document.getElementById("verificar");
            verificarBtn.click();
        }
    }
});

const copyBtn = document.getElementById("copyButton");
if (copyBtn) {
    copyBtn.addEventListener("click", function () {
        const pregunta = document.getElementById("pregunta").innerText;
        const opciones = Array.from(document.getElementById("opciones").getElementsByTagName("span")).map(
            (e) => e.innerText,
        );
        const contenidoParaCopiar = pregunta + "\n\n" + "- " + opciones.join("\n- ");
        navigator.clipboard.writeText(contenidoParaCopiar).then(
            function () {
                console.log("Copiado con éxito");
                const copyText = document.getElementById("copyText");
                const icon = copyBtn.querySelector(".material-icons");
                
                if (copyText && icon) {
                    const originalText = copyText.innerText;
                    const originalIcon = icon.innerText;
                    
                    copyText.innerText = "Copiado";
                    icon.innerText = "check";
                    copyBtn.classList.add("text-green-600", "dark:text-green-400", "border-green-600", "dark:border-green-400");
                    copyBtn.classList.remove("text-text-muted", "border-border-subtle");
                    
                    setTimeout(() => {
                        copyText.innerText = originalText;
                        icon.innerText = originalIcon;
                        copyBtn.classList.remove("text-green-600", "dark:text-green-400", "border-green-600", "dark:border-green-400");
                        copyBtn.classList.add("text-text-muted", "border-border-subtle");
                    }, 2000);
                }
            },
            function (err) {
                console.error("Error al copiar: ", err);
            },
        );
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Leemos la ruta de la URL (ej: "/dca-oficial")
    const path = window.location.pathname;

    // Le quitamos la primera barra "/" para quedarnos solo con "dca-oficial"
    const asignaturaId = path.substring(1).replace(/\/$/, ""); // El replace quita la barra final si la hubiera

    // Si hay un ID y no estamos en la página principal, cargamos el quiz
    if (asignaturaId && path !== "/" && path !== "/index.html") {
        cargarDesdeUrl(asignaturaId);
    }
});

function cargarDesdeUrl(id) {
    // Casos Especiales (Múltiples archivos unidos)
    if (id === "redes_full") {
        prepararEntornoMultiples("REDESFULL", [
            "redesPreguntas.txt",
            "redesEnero2324Preguntas.txt",
            "redesEnero2425Preguntas.txt",
            "redesJulio2425Preguntas.txt",
            "redesEnero2526Preguntas.txt",
        ]);
        return;
    }

    if (id === "sdsfull") {
        prepararEntornoMultiples("SDSFULL", [
            "sds01-presentacionPreguntas.txt",
            "sds02-introgoPreguntas.txt",
            "sds03-introcriptoPreguntas.txt",
            "sds04-aleatoriosPreguntas.txt",
            "sds05-flujoPreguntas.txt",
            "sds06-bloquePreguntas.txt",
            "sds07-hashPreguntas.txt",
            "sds08-publicaPreguntas.txt",
            "sds09-transportePreguntas.txt",
            "sds10-ejerciciosPreguntas.txt",
            "sds11-malwarePreguntas.txt",
            "sds12-ataquesPreguntas.txt",
            "sds13-wirelessPreguntas.txt",
            "sds14-recomendacionesPreguntas.txt",
        ]);
        return;
    }

    // Casos donde el nombre del archivo no sigue la regla de añadir "Preguntas.txt"
    const excepciones = {
        "dca-oficial": "dcaPreguntas.txt",
        "ic-p1": "ic-p1.txt",
        "taes-definitivo": "taesDefinitivoPreguntas.txt",
    };

    if (excepciones[id]) {
        iniciarAsignatura(excepciones[id]);
    } else {
        // Regla mágica general: asume que el ID del botón + "Preguntas.txt" es el archivo
        iniciarAsignatura(id + "Preguntas.txt");
    }
}

function prepararEntornoMultiples(nombre, archivos) {
    resetAppState();
    document.getElementById("resumenBtn").style.display = "block";
    document.getElementById("copyButton").style.display = "flex";
    archivoActual = nombre;
    document.getElementById("asignatura-nombre").innerText = nombre;

    cargarMultiplesArchivos(archivos).then((todasLasPreguntas) => {
        preguntas = todasLasPreguntas;
        document.getElementById("total-preguntas").innerText = `Total: ${preguntas.length}`;
        shuffle(preguntas);
        mostrarPregunta();
    });

    hideElement("asignaturas-container");
    hideElement("app-title");
    showElement("verificar");
    showElement("volver");
    showElement("total-preguntas");
    showElement("contador");
}

function splitLongText(text) {
    if (!text || text.length < 75) return text;
    
    // Prevent splitting markdown, formatting, HTML, or math
    if (text.includes('<') || text.includes('\n') || text.includes('```') || text.includes('$$') || text.includes('\\[')) return text;
    
    const midPoint = Math.floor(text.length / 2);
    let leftSpace = text.lastIndexOf(' ', midPoint);
    let rightSpace = text.indexOf(' ', midPoint);
    
    let nearestSpace = -1;
    if (leftSpace === -1 && rightSpace === -1) {
        return text; 
    } else if (leftSpace === -1) {
        nearestSpace = rightSpace;
    } else if (rightSpace === -1) {
        nearestSpace = leftSpace;
    } else {
        if (midPoint - leftSpace <= rightSpace - midPoint) {
            nearestSpace = leftSpace;
        } else {
            nearestSpace = rightSpace;
        }
    }
    
    if (nearestSpace < 25 || nearestSpace > text.length - 25) return text;
    
    return text.substring(0, nearestSpace) + '<br>' + text.substring(nearestSpace + 1);
}
