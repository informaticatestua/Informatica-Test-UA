/**
 * Utilidades de formateo compartidas entre el motor del quiz (main.js) y
 * la pantalla de resumen (resumen.js).
 *
 * Vive aparte porque ambas pantallas se sirven como Astro estáticas
 * separadas y no compartirían módulos sin un bundler. Al cargarlo
 * con `<script is:inline>` antes que sus consumidores, las funciones
 * quedan disponibles en `window.QuizFormat`.
 *
 * Se mantiene el contrato exacto de las funciones originales (firmas
 * y semántica) para que cualquier punto del proyecto que las invoque
 * pueda reemplazarlas sin cambios de comportamiento.
 */
(function (global) {
    "use strict";

    /**
     * Escapa los 5 caracteres peligrosos para inyección de HTML.
     * El orden importa: `&` se reemplaza primero para no doble-escapar
     * las entidades introducidas a continuación.
     */
    function escapeHTML(str) {
        if (str == null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /**
     * Renderiza una pregunta/opción con soporte para:
     *   - Bloques de código entre triple backtick (```).
     *   - Imágenes Markdown con dimensiones: `![Alt](URL){width=X height=Y}`.
     *   - Conversión de los literales `\n` y `\t` (escritos así en los `.txt`).
     *
     * El texto fuera de los bloques se escapa como HTML para evitar XSS;
     * dentro de los bloques de código, se escapa antes de inyectar.
     */
    function formatTextWithCode(text) {
        if (!text) return "";

        // ``` divide el texto en pares (texto, código, texto, ...).
        const parts = text.split("```");
        let out = "";

        parts.forEach((part, index) => {
            const isCodeBlock = index % 2 === 1;

            if (isCodeBlock) {
                out +=
                    '<pre><code class="language-cpp">' +
                    escapeHTML(part)
                        .replace(/\\n/g, "<br>")
                        .replace(/\\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;") +
                    "</code></pre>";
                return;
            }

            let html = escapeHTML(part)
                .replace(/\\n/g, "<br>")
                .replace(/\\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");

            // Imágenes Markdown (con o sin atributos width/height entre llaves).
            html = html.replace(
                /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g,
                (_match, alt, url, attrs) => {
                    let style = "max-width: 100%; height: auto;";
                    if (attrs) {
                        attrs.split(/\s+/).forEach((pair) => {
                            const [key, value] = pair.split("=");
                            if (!key || !value) return;
                            const k = key.toLowerCase();
                            if (k === "width") style += ` width:${value}px;`;
                            else if (k === "height") style += ` height:${value}px;`;
                        });
                    }
                    return `<img src="${url}" alt="${alt}" style="${style}" />`;
                },
            );

            out += html;
        });

        return out;
    }

    /**
     * Inserta un `<br>` aproximadamente en el centro de un texto largo
     * para evitar opciones excesivamente anchas. Solo actúa sobre texto
     * plano; si el texto ya contiene HTML/código/LaTeX se devuelve tal cual.
     *
     * Reglas heurísticas (preservadas del comportamiento original):
     *   - Mínimo 75 caracteres para considerarse "largo".
     *   - El corte cae en el espacio más cercano al centro.
     *   - No se parte si el corte queda a menos de 25 caracteres del borde.
     */
    function splitLongText(text) {
        if (!text || text.length < 75) return text;

        if (
            text.includes("<") ||
            text.includes("\n") ||
            text.includes("```") ||
            text.includes("$$") ||
            text.includes("\\[")
        ) {
            return text;
        }

        const midPoint = Math.floor(text.length / 2);
        const leftSpace = text.lastIndexOf(" ", midPoint);
        const rightSpace = text.indexOf(" ", midPoint);

        let nearestSpace;
        if (leftSpace === -1 && rightSpace === -1) return text;
        else if (leftSpace === -1) nearestSpace = rightSpace;
        else if (rightSpace === -1) nearestSpace = leftSpace;
        else nearestSpace =
            midPoint - leftSpace <= rightSpace - midPoint ? leftSpace : rightSpace;

        if (nearestSpace < 25 || nearestSpace > text.length - 25) return text;

        return text.substring(0, nearestSpace) + "<br>" + text.substring(nearestSpace + 1);
    }

    global.QuizFormat = Object.freeze({
        escapeHTML,
        formatTextWithCode,
        splitLongText,
    });
})(window);
