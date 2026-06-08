/**
 * Núcleo puro del parser del quiz.
 *
 * Se carga como script clásico para que `main.js` pueda reutilizarlo sin
 * cambiar el modo de carga actual, y los tests lo ejecutan directamente en
 * un contexto aislado para validar exactamente la misma implementación.
 */
(function (global) {
    "use strict";

    /** Baraja un array in-place mediante Fisher-Yates. */
    function shuffle(array, randomFn = Math.random) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(randomFn() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /** Hash pequeño y estable para identificar preguntas entre sesiones. */
    function hashString(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
        }
        return hash.toString(36);
    }

    /** Reubica índices correctos 1-based tras el shuffle de opciones. */
    function remapAnswerIndices(originalOptions, shuffledOptions, correctIndices) {
        return correctIndices.map((index) => shuffledOptions.indexOf(originalOptions[index - 1]) + 1);
    }

    /**
     * Convierte un bloque de texto en una pregunta parseada.
     * El bloque sigue el formato estricto:
     *   <pregunta>
     *   <índices correctos separados por coma>
     *   <opción 1>
     *   <opción 2>
     *   ...
     */
    function parsePregunta(block, options = {}) {
        const shuffleFn = options.shuffleFn || shuffle;
        const [pregunta, respuesta, ...opcionesRaw] = block.split("\n");
        const opciones = opcionesRaw.filter((opcion) => opcion.trim() !== "");

        const indicesOriginales = respuesta.split(",").map((item) => parseInt(item.trim(), 10));
        const indicesUnicos = Array.from(new Set(indicesOriginales));
        const tieneDuplicados = indicesOriginales.length !== indicesUnicos.length;

        const opcionesMezcladas = shuffleFn([...opciones]);
        const respuestasMezcladas = remapAnswerIndices(opciones, opcionesMezcladas, indicesUnicos);

        return {
            id: hashString(`${pregunta}\n${respuesta}\n${opciones.join("\n")}`),
            pregunta,
            respuestas: respuestasMezcladas,
            opciones: opcionesMezcladas,
            multiple: tieneDuplicados || respuestasMezcladas.length > 1,
        };
    }

    /** Convierte el texto de un `.txt` en una lista de preguntas. */
    function parsePreguntasTxt(preguntasTxt, options = {}) {
        return preguntasTxt.split(/\n{2,}/).map((bloque) => parsePregunta(bloque, options));
    }

    global.QuizParserCore = {
        shuffle,
        hashString,
        remapAnswerIndices,
        parsePregunta,
        parsePreguntasTxt,
    };
})(typeof window !== "undefined" ? window : globalThis);
