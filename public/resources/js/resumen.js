// --- CARGA DE PREGUNTAS ---
async function cargarPreguntas(archivo) {
    // Usamos la ruta absoluta igual que en main.js
    const response = await fetch("/resources/data/" + archivo);

    if (!response.ok) throw new Error("Archivo no encontrado (404)");

    let preguntasTxt = await response.text();

    if (
        preguntasTxt.trim().toLowerCase().startsWith("<!doctype html>") ||
        preguntasTxt.trim().toLowerCase().startsWith("<html")
    ) {
        throw new Error("Se recibió una página web en lugar de las preguntas");
    }

    return preguntasTxt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

// --- ARRANQUE PRINCIPAL ---
window.onload = function () {
    cargarTemaGuardado(); // Aplicamos el tema (claro/oscuro) nada más entrar

    // 1. Leemos la URL (ejemplo: "/sdsfull/resumen")
    const path = window.location.pathname;

    // Dividimos la URL por las barras y quitamos espacios vacíos. Nos quedamos con el primer trozo.
    // Ej: ["sdsfull", "resumen"] -> Nos quedamos con "sdsfull"
    const pathParts = path.split("/").filter((p) => p);

    if (pathParts.length > 0) {
        const asignaturaId = pathParts[0];
        cargarResumenDesdeId(asignaturaId);
    }
};

// --- CEREBRO PARA CARGAR LA ASIGNATURA ---
function cargarResumenDesdeId(id) {
    let archivosACargar = [];
    let esMultiple = false;

    // Detectamos si es un examen especial con múltiples archivos
    if (id === "redes_full") {
        esMultiple = true;
        archivosACargar = [
            "redesPreguntas.txt",
            "redesEnero2324Preguntas.txt",
            "redesEnero2425Preguntas.txt",
            "redesJulio2425Preguntas.txt",
            "redesEnero2526Preguntas.txt",
        ];
    } else if (id === "sdsfull") {
        esMultiple = true;
        archivosACargar = JSON.parse(sessionStorage.getItem("sdsfullArchivos") || "[]");
        // Por si alguien entra directo a la URL sin pasar por el menú
        if (archivosACargar.length === 0) {
            archivosACargar = [
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
            ];
        }
    }

    if (esMultiple) {
        cargarMultiplesArchivos(archivosACargar).then((preguntas) => renderizarResumen(preguntas));
    } else {
        // Excepciones de nombres de archivos
        const excepciones = {
            "dca-oficial": "dcaPreguntas.txt",
            "ic-p1": "ic-p1.txt",
            "taes-definitivo": "taesDefinitivoPreguntas.txt",
        };
        const archivo = excepciones[id] ? excepciones[id] : id + "Preguntas.txt";

        cargarPreguntas(archivo)
            .then((preguntasTxt) => renderizarResumen(procesarTextoPreguntas(preguntasTxt)))
            .catch((error) => {
                console.warn("Error cargando el resumen:", error);
                document.getElementById("app").innerHTML =
                    "<h1>Error: No se encontró el resumen para esta asignatura.</h1>";
            });
    }
}

// --- PROCESAMIENTO DE TEXTO ---
function procesarTextoPreguntas(preguntasTxt) {
    return preguntasTxt.split(/\n{2,}/).map((preguntaTxt) => {
        const [pregunta, respuesta, ...opciones] = preguntaTxt.split("\n");

        // Soportamos múltiples respuestas correctas (ej: "1, 3")
        const respuestasCorrectasIndices = respuesta.split(",").map((r) => parseInt(r.trim()));

        // Devolvemos todas las opciones con un flag de si son correctas
        const todasLasOpciones = opciones
            .filter((op) => op && op.toUpperCase() !== "NO MARCAR")
            .map((texto, i) => ({
                texto,
                correcta: respuestasCorrectasIndices.includes(i + 1),
            }));

        return {
            pregunta,
            opciones: todasLasOpciones,
        };
    });
}

// --- CARGA MÚLTIPLE ---
async function cargarMultiplesArchivos(archivos) {
    let todasLasPreguntas = [];
    for (const archivo of archivos) {
        try {
            const preguntasTxt = await cargarPreguntas(archivo);
            todasLasPreguntas = todasLasPreguntas.concat(procesarTextoPreguntas(preguntasTxt));
        } catch (error) {
            console.error(`Error cargando el archivo ${archivo}:`, error);
        }
    }
    return todasLasPreguntas;
}

// --- PINTAR EL RESUMEN EN LA PÁGINA ---
function renderizarResumen(preguntas) {
    const resumenContainer = document.getElementById("resumen");
    resumenContainer.innerHTML = ""; // Limpiamos por si acaso

    preguntas.forEach((pregunta, index) => {
        // Pregunta
        const preguntaElement = document.createElement("p");
        preguntaElement.style.cssText = "margin-bottom: 8px; font-weight: 600;";
        preguntaElement.innerHTML = `<strong>${index + 1}.</strong> ${formatTextWithCode(pregunta.pregunta)}`;
        resumenContainer.appendChild(preguntaElement);

        // Opciones
        const listaOpciones = document.createElement("ul");
        listaOpciones.style.cssText = "list-style: none; padding: 0; margin: 0 0 20px 12px;";

        pregunta.opciones.forEach((opcion) => {
            const li = document.createElement("li");
            li.style.cssText = "margin-bottom: 8px; padding: 12px 14px; border-radius: 6px; display: flex; align-items: flex-start; gap: 12px; border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));";
            
            const iconSpan = document.createElement("span");
            iconSpan.style.cssText = "flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1.1em; line-height: 1.2; margin-top: 2px; width: 24px; height: 24px;";
            
            const textDiv = document.createElement("div");
            textDiv.style.cssText = "flex-grow: 1; margin: 0; padding: 0;";
            textDiv.innerHTML = formatTextWithCode(opcion.texto);

            if (opcion.correcta) {
                li.className = "correct";
                iconSpan.innerHTML = "✓";
                iconSpan.style.fontWeight = "bold";
                iconSpan.style.color = "var(--green-500, #22c55e)";
            } else {
                iconSpan.innerHTML = "○";
                iconSpan.style.color = "var(--text-muted, #9ca3af)";
                li.style.backgroundColor = "transparent";
            }
            
            li.appendChild(iconSpan);
            li.appendChild(textDiv);
            listaOpciones.appendChild(li);
        });

        resumenContainer.appendChild(listaOpciones);
    });

    // Renderizar expresiones matemáticas KaTeX en todo el resumen
    if (typeof renderMathInElement !== "undefined") {
        renderMathInElement(resumenContainer, {
            delimiters: [
                { left: "$$", right: "$$", display: false },
                { left: "\\[", right: "\\]", display: true },
            ],
        });
    }

    // Resaltar el código si hay Prism
    if (typeof Prism !== "undefined") {
        Prism.highlightAll();
    }
}

// --- FUNCIONES DE FORMATEO (Copiadas de main.js) ---
function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatTextWithCode(text) {
    if (!text) return "";
    const parts = text.split("```");
    let finalText = "";

    parts.forEach((part, index) => {
        if (index % 2 === 1) {
            finalText +=
                '<pre><code class="language-cpp">' +
                escapeHTML(part)
                    .replace(/\\n/g, "<br>")
                    .replace(/\\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;") +
                "</code></pre>";
        } else {
            let escapedText = escapeHTML(part)
                .replace(/\\n/g, "<br>")
                .replace(/\\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");

            const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g;
            escapedText = escapedText.replace(imageRegex, (match, alt, url, attrs) => {
                let style = "max-width: 100%; height: auto;";
                if (attrs) {
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

// --- TEMA OSCURO / CLARO ---
function toggleTheme() {
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.querySelector("body");

    if (body.classList.contains("dark-theme")) {
        body.classList.remove("dark-theme");
        if (themeToggle) {
            themeToggle.innerHTML = "&#9728;";
            themeToggle.classList.remove("dark-mode");
            themeToggle.classList.add("light-mode");
        }
        localStorage.setItem("theme", "light");
    } else {
        body.classList.add("dark-theme");
        if (themeToggle) {
            themeToggle.innerHTML = "&#9790;";
            themeToggle.classList.remove("light-mode");
            themeToggle.classList.add("dark-mode");
        }
        localStorage.setItem("theme", "dark");
    }
}

const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);
}

function cargarTemaGuardado() {
    const savedTheme = localStorage.getItem("theme");
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.querySelector("body");

    if (savedTheme === "dark") {
        body.classList.add("dark-theme");
        if (themeToggle) {
            themeToggle.innerHTML = "&#9790;";
            themeToggle.classList.remove("light-mode");
            themeToggle.classList.add("dark-mode");
        }
    }
}
