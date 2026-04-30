/**
 * DCA Test UA — Página de Resumen.
 *
 * Carga las preguntas de una asignatura (o grupo multi-archivo) y las
 * pinta como una lista con la respuesta correcta marcada. No reutiliza
 * el motor (main.js), pero sí las utilidades de formateo compartidas
 * vía `window.QuizFormat` para evitar duplicación de código.
 *
 * Organización interna del archivo:
 *   1. Configuración (constantes, mapas).
 *   2. Carga y parseo de datos.
 *   3. Renderizado del resumen.
 *   4. Inicialización (lectura de URL).
 */
(function () {
    "use strict";

    // ─────────────────────────────────────────────────────────────────────
    // 1. CONFIGURACIÓN
    // ─────────────────────────────────────────────────────────────────────

    const DATA_PATH = "/resources/data/";

    const { formatTextWithCode, splitLongText } = window.QuizFormat;

    /**
     * Mismas excepciones de nombres que en main.js: hay que mantenerlas
     * sincronizadas porque algunos archivos no siguen la convención
     * `${id}Preguntas.txt`.
     */
    const NAME_EXCEPTIONS = Object.freeze({
        "dca-oficial": "dcaPreguntas.txt",
        "ada-full": "adaPreguntas.txt",
        "ic-p1": "ic-p1.txt",
        "taes-definitivo": "taesDefinitivoPreguntas.txt",
        "ac_CP-F2": "ac_CP-F2_Preguntas.txt",
        "ac_CP-F3": "ac_CP-F3_Preguntas.txt",
        "ac_CT1-2": "ac_CT1-2_Preguntas.txt",
        "ac_CT3-4": "ac_CT3-4_Preguntas.txt",
    });

    /** Defaults para grupos multi-archivo (en sync con main.js). */
    const MULTI_FILE_GROUPS = Object.freeze({
        redes_full: [
            "redesPreguntas.txt",
            "redesEnero2324Preguntas.txt",
            "redesEnero2425Preguntas.txt",
            "redesJulio2425Preguntas.txt",
            "redesEnero2526Preguntas.txt",
        ],
        sdsfull: [
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
        ],
    });

    /** KaTeX en el resumen sí admite display mode (formulas centradas). */
    const KATEX_OPTIONS = {
        delimiters: [
            { left: "$$", right: "$$", display: false },
            { left: "\\[", right: "\\]", display: true },
        ],
    };

    // ─────────────────────────────────────────────────────────────────────
    // 2. CARGA Y PARSEO
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Descarga un archivo de preguntas y devuelve su texto normalizado.
     * Detecta el caso típico de hosting que sirve un HTML 200 ante un
     * `.txt` inexistente.
     */
    async function fetchPreguntasTxt(archivo) {
        let response;
        try {
            response = await fetch(DATA_PATH + archivo);
        } catch (networkErr) {
            throw new Error(`Error de red al descargar ${archivo}: ${networkErr.message}`);
        }

        if (!response.ok) {
            throw new Error(`Archivo no encontrado (${response.status}): ${archivo}`);
        }

        const raw = await response.text();
        const sniff = raw.trim().toLowerCase();
        if (sniff.startsWith("<!doctype html>") || sniff.startsWith("<html")) {
            throw new Error(`El servidor devolvió HTML en lugar de las preguntas: ${archivo}`);
        }

        return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    }

    /**
     * Convierte el texto crudo en una lista de preguntas con sus opciones.
     * Cada opción se devuelve enriquecida con `{ texto, correcta }` para
     * facilitar el render: el resumen no baraja, presenta los datos tal
     * y como están en el archivo (con NO MARCAR filtrada).
     */
    function parsePreguntasTxt(preguntasTxt) {
        return preguntasTxt.split(/\n{2,}/).map((bloque) => {
            const [pregunta, respuesta, ...opcionesRaw] = bloque.split("\n");
            const opciones = opcionesRaw.filter((op) => op.trim() !== "");

            // 1-based: las respuestas correctas vienen como índices empezando en 1.
            const indicesCorrectos = respuesta.split(",").map((r) => parseInt(r.trim(), 10));

            const opcionesAnotadas = opciones
                .filter((op) => op && op.toUpperCase() !== "NO MARCAR")
                .map((texto, i) => ({
                    texto,
                    correcta: indicesCorrectos.includes(i + 1),
                }));

            return { pregunta, opciones: opcionesAnotadas };
        });
    }

    /**
     * Carga varios archivos en paralelo. Tolera fallos individuales:
     * los registramos pero seguimos pintando los que sí cargaron.
     */
    async function loadMultipleFiles(archivos) {
        const resultados = await Promise.allSettled(archivos.map(fetchPreguntasTxt));
        const preguntas = [];

        resultados.forEach((res, i) => {
            if (res.status === "fulfilled") {
                preguntas.push(...parsePreguntasTxt(res.value));
            } else {
                console.error(`Error cargando el archivo ${archivos[i]}:`, res.reason);
            }
        });

        return preguntas;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. RENDERIZADO
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Crea el `<li>` de una opción con su icono (✓ correcta, ○ incorrecta).
     * Mantenemos los inline-styles porque el `ResumenLayout` no incluye
     * todas las clases utilitarias del quiz, y mover esto a clases CSS
     * obligaría a tocar el sistema de estilos (fuera del scope del refactor).
     */
    function renderOpcionLi(opcion) {
        const li = document.createElement("li");
        li.style.cssText =
            "margin-bottom: 8px; padding: 12px 14px; border-radius: 6px;" +
            " display: flex; align-items: flex-start; gap: 12px;" +
            " border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));";

        const iconSpan = document.createElement("span");
        iconSpan.style.cssText =
            "flex-shrink: 0; display: flex; align-items: center; justify-content: center;" +
            " font-size: 1.1em; line-height: 1.2; margin-top: 2px; width: 24px; height: 24px;";

        const textDiv = document.createElement("div");
        textDiv.style.cssText = "flex-grow: 1; margin: 0; padding: 0;";
        textDiv.innerHTML = formatTextWithCode(splitLongText(opcion.texto));

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
        return li;
    }

    /** Pinta el resumen completo dentro del contenedor `#resumen`. */
    function renderizarResumen(preguntas) {
        const resumenContainer = document.getElementById("resumen");
        if (!resumenContainer) return;
        resumenContainer.innerHTML = "";

        preguntas.forEach((pregunta, index) => {
            const preguntaElement = document.createElement("p");
            preguntaElement.style.cssText = "margin-bottom: 8px; font-weight: 600;";
            preguntaElement.innerHTML = `<strong>${index + 1}.</strong> ${formatTextWithCode(pregunta.pregunta)}`;
            resumenContainer.appendChild(preguntaElement);

            const lista = document.createElement("ul");
            lista.style.cssText = "list-style: none; padding: 0; margin: 0 0 20px 12px;";
            pregunta.opciones.forEach((opcion) => lista.appendChild(renderOpcionLi(opcion)));
            resumenContainer.appendChild(lista);
        });

        // KaTeX y Prism: los aplicamos al final, una sola vez.
        if (typeof window.renderMathInElement === "function") {
            window.renderMathInElement(resumenContainer, KATEX_OPTIONS);
        }
        if (typeof window.Prism !== "undefined") window.Prism.highlightAll();
    }

    /** Muestra un mensaje de error si la asignatura no existe. */
    function renderError() {
        const app = document.getElementById("app");
        if (app) {
            app.innerHTML =
                "<h1>Error: No se encontró el resumen para esta asignatura.</h1>";
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. ARRANQUE DESDE LA URL
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Resuelve qué archivo(s) cargar a partir del slug de la URL.
     * Devuelve `{ files, isMultiple }` o `null` si el slug es desconocido.
     *
     * Para SDSFULL prioriza los archivos guardados en sessionStorage
     * (escritos por main.js justo antes de navegar al resumen). Esto
     * permite mantener exactamente la misma combinación que el usuario
     * vio en el quiz, incluso si la lista cambiase en main.js.
     */
    function resolverArchivos(id) {
        if (id === "sdsfull") {
            const desdeStorage = JSON.parse(sessionStorage.getItem("sdsfullArchivos") || "[]");
            const files = desdeStorage.length > 0 ? desdeStorage : MULTI_FILE_GROUPS.sdsfull;
            return { files, isMultiple: true };
        }

        if (MULTI_FILE_GROUPS[id]) {
            return { files: MULTI_FILE_GROUPS[id], isMultiple: true };
        }

        const archivo = NAME_EXCEPTIONS[id] || `${id}Preguntas.txt`;
        return { files: [archivo], isMultiple: false };
    }

    /** Carga, parsea y pinta el resumen para el slug `id`. */
    async function cargarResumenDesdeId(id) {
        const resolucion = resolverArchivos(id);
        if (!resolucion) {
            renderError();
            return;
        }

        try {
            const preguntas = resolucion.isMultiple
                ? await loadMultipleFiles(resolucion.files)
                : parsePreguntasTxt(await fetchPreguntasTxt(resolucion.files[0]));

            if (preguntas.length === 0) {
                renderError();
                return;
            }
            renderizarResumen(preguntas);
        } catch (error) {
            console.warn("Error cargando el resumen:", error);
            renderError();
        }
    }

    /** Punto de entrada: extrae el slug del primer segmento de la ruta. */
    function init() {
        const pathParts = window.location.pathname.split("/").filter(Boolean);
        if (pathParts.length === 0) return;
        cargarResumenDesdeId(pathParts[0]);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
