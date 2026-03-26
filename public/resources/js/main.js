let totalPreguntas = 0;
let preguntasCorrectas = 0;
let archivoActual = "";

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
    document.getElementById("copyButton").style.display = "block";
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
    const pregunta = preguntas[preguntaActual];
    const contenedorPregunta = document.getElementById("pregunta");
    const contenedorOpciones = document.getElementById("opciones");

    // Establece el contenido de la pregunta
    contenedorPregunta.innerHTML = formatTextWithCode(pregunta.pregunta);

    // Resaltar el código, si hay alguno en la pregunta
    Prism.highlightAll();

    // Establece el contenido de las opciones
    contenedorOpciones.innerHTML = "";
    pregunta.opciones.forEach((opcion, i) => {
        // Omitir si es "NO MARCAR" o cualquier otra lógica que tengas
        if (opcion.toUpperCase() !== "NO MARCAR") {
            const input = document.createElement(pregunta.multiple ? "input" : "input");
            input.type = pregunta.multiple ? "checkbox" : "radio";
            input.name = "opcion";
            input.id = `opcion${i + 1}`;
            input.value = i + 1;
            
            const label = document.createElement("label");
            label.htmlFor = `opcion${i + 1}`;
            label.className = "opcion-container";
            
            const span = document.createElement("span");
            span.innerHTML = splitLongText(opcion); // Usa innerHTML si la opción podría contener LaTeX
            span.className = "opcion-label";
            
            label.appendChild(input);
            label.appendChild(span);
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
    totalPreguntas++; // Incrementa el total de preguntas contestadas

    const respuestaSeleccionada = document.querySelectorAll('input[name="opcion"]:checked');
    if (respuestaSeleccionada.length === 0) {
        alert("Selecciona una opción antes de verificar.");
        return;
    }

    const respuestaCorrecta = preguntas[preguntaActual].respuestas; // Array de respuestas correctas
    const opciones = document.getElementById("opciones");
    const labels = opciones.getElementsByTagName("label");

    let respuestaEsCorrecta = false;

    // Crear un array con las opciones seleccionadas
    const seleccionadas = Array.from(respuestaSeleccionada).map((input) => parseInt(input.value));

    // Comparar arrays de respuestas
    const correctas = [...respuestaCorrecta].sort((a, b) => a - b);
    const seleccionadasOrdenadas = [...seleccionadas].sort((a, b) => a - b);

    if (arraysEqual(correctas, seleccionadasOrdenadas)) {
        respuestaEsCorrecta = true;
        preguntasCorrectas++;
    }

    // Resaltar las opciones correctas e incorrectas
    for (let i = 0; i < labels.length; i++) {
        const span = labels[i].querySelector("span");
        const valor = parseInt(labels[i].htmlFor.replace("opcion", ""));
        if (respuestaCorrecta.includes(valor)) {
            span.classList.add("correct");
        }
        if (seleccionadas.includes(valor) && !respuestaCorrecta.includes(valor)) {
            span.classList.add("incorrect");
        }
    }

    document.getElementById("verificar").removeEventListener("click", verificarRespuesta);
    document.getElementById("verificar").addEventListener("click", siguientePregunta);
    document.getElementById("verificar").innerText = "Siguiente";

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
    preguntaActual = (preguntaActual + 1) % preguntas.length;
    mostrarPregunta();

    const opciones = document.getElementById("opciones");
    const inputs = opciones.querySelectorAll("input");
    inputs.forEach((input) => {
        input.checked = false;
        const span = input.closest("label").querySelector("span");
        if (span) span.classList.remove("correct", "incorrect");
    });

    document.getElementById("verificar").removeEventListener("click", siguientePregunta);
    document.getElementById("verificar").addEventListener("click", verificarRespuesta);
    document.getElementById("verificar").innerText = "Verificar";
    document.getElementById("resultado").innerText = "";
}

const verificarBtn = document.getElementById("verificar");
if (verificarBtn) {
    verificarBtn.addEventListener("click", verificarRespuesta);
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
    showElement("asignaturas-container");
    showElement("app-title");
    document.getElementById("pregunta").innerText = "";
    document.getElementById("opciones").innerHTML = "";
    document.getElementById("resultado").innerText = "";

    document.getElementById("verificar").removeEventListener("click", siguientePregunta);
    document.getElementById("verificar").addEventListener("click", verificarRespuesta);
    document.getElementById("verificar").innerText = "Verificar";
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
    document.getElementById("copyButton").style.display = "block";
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
