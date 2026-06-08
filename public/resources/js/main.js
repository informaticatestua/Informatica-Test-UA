/**
 * DCA Test UA — Motor del Quiz (Vanilla JS, IIFE).
 *
 * Se mantiene como un único archivo (CLAUDE.md), pero internamente está
 * dividido en bloques funcionales para facilitar el mantenimiento:
 *
 *   1. Configuración (constantes, mapas de excepciones, agrupaciones).
 *   2. Estado de la aplicación (única fuente de verdad mutable).
 *   3. Utilidades genéricas (DOM, formato, shuffle, etc.).
 *   4. Carga y parseo de datos (.txt -> objetos pregunta).
 *   5. Renderizado y controladores de UI (mostrar pregunta, verificar...).
 *   6. Inicialización (lectura de la URL y arranque del quiz).
 *
 * El motor se ejecuta dentro de una IIFE para evitar contaminar `window`,
 * exceptuando los hooks que ya consumían otros componentes
 * (`window.openReportModal` se sigue invocando desde fuera).
 */
(function () {
    "use strict";

    // ─────────────────────────────────────────────────────────────────────
    // 1. CONFIGURACIÓN
    // ─────────────────────────────────────────────────────────────────────

    /** Ruta base donde residen los archivos `.txt` con las preguntas. */
    const DATA_PATH = "/resources/data/";

    /**
     * Asignaturas cuyo archivo `.txt` no sigue la convención
     * `${id}Preguntas.txt`. Se mapean por su id de URL.
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

    /**
     * Asignaturas que combinan varios archivos en una sola sesión de quiz.
     * Mantener el orden tiene relevancia: el resumen se construye con la
     * misma lista cuando el usuario abre el botón "Resumen".
     */
    const MULTI_FILE_GROUPS = Object.freeze({
        redes_full: {
            displayName: "REDESFULL",
            files: [
                "redesPreguntas.txt",
                "redesEnero2324Preguntas.txt",
                "redesEnero2425Preguntas.txt",
                "redesJulio2425Preguntas.txt",
                "redesEnero2526Preguntas.txt",
            ],
        },
        sdsfull: {
            displayName: "SDSFULL",
            files: [
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
        },
    });

    /** Atajos de teclado 1-5 para seleccionar opciones. */
    const KEY_TO_INDEX = Object.freeze({
        "1": 0, Numpad1: 0,
        "2": 1, Numpad2: 1,
        "3": 2, Numpad3: 2,
        "4": 3, Numpad4: 3,
        "5": 4, Numpad5: 4,
    });

    /** Delimitadores de KaTeX (mantener el comportamiento previo: solo inline). */
    const KATEX_OPTIONS = {
        delimiters: [{ left: "$$", right: "$$", display: false }],
    };

    /** Namespace de persistencia para historial de fallos por quiz. */
    const REVIEW_STORAGE_PREFIX = "quizIncorrectHistory:";

    // ─────────────────────────────────────────────────────────────────────
    // 2. ESTADO
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Estado global de la sesión actual del quiz. Se concentra en un único
     * objeto para evitar variables sueltas y facilitar el seguimiento.
     */
    const state = {
        /** Lista de preguntas ya parseadas y barajadas. */
        preguntas: [],
        /** Banco completo de preguntas de la asignatura actual. */
        todasLasPreguntas: [],
        /** Índice de la pregunta visible. */
        preguntaActual: 0,
        /** Total de preguntas verificadas (correctas + incorrectas). */
        totalPreguntas: 0,
        /** Cuántas se han respondido correctamente. */
        preguntasCorrectas: 0,
        /** Identificador del archivo / grupo activo (para el botón Resumen). */
        archivoActual: "",
        /** Clave estable del quiz actual para persistir fallos. */
        quizKey: "",
        /** Si el usuario está repasando únicamente preguntas falladas. */
        modoRepaso: false,
        /** Fallos detectados en esta sesión. */
        erroresSesion: new Set(),
        /** Fallos persistidos localmente desde sesiones anteriores. */
        erroresHistoricos: new Set(),
        /**
         * Snapshot por pregunta de las opciones seleccionadas y si el
         * usuario ya pulsó "Verificar". Permite navegar atrás/adelante
         * sin perder respuestas.
         */
        estadosPreguntas: {},
    };

    // ─────────────────────────────────────────────────────────────────────
    // 3. UTILIDADES
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Las utilidades de formateo (escapeHTML, formatTextWithCode,
     * splitLongText) viven en `formatters.js` para compartirlas con
     * la pantalla de resumen sin duplicar código (DRY).
     */
    const { formatTextWithCode, splitLongText } = window.QuizFormat;
    const { shuffle, hashString, parsePreguntasTxt } = window.QuizParserCore;

    /** Acceso corto al DOM por id. */
    const $ = (id) => document.getElementById(id);

    /** Oculta un elemento añadiendo la clase utilitaria `hidden`. */
    function hideElement(id) {
        const el = $(id);
        if (el) el.classList.add("hidden");
    }

    /** Muestra un elemento eliminando la clase utilitaria `hidden`. */
    function showElement(id) {
        const el = $(id);
        if (el) el.classList.remove("hidden");
    }

    /** Comparación rápida de dos arrays numéricos del mismo orden. */
    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
    }

    /** Devuelve la pregunta visible o `undefined` si aún no hay datos. */
    function getPreguntaActual() {
        return state.preguntas[state.preguntaActual];
    }

    /** Clave estable para guardar/restaurar estado de una pregunta. */
    function getPreguntaStateKey(index = state.preguntaActual) {
        const pregunta = state.preguntas[index];
        return pregunta?.id || String(index);
    }

    /** Lee el historial persistido de fallos del quiz actual. */
    function loadStoredErrors() {
        if (!state.quizKey || typeof localStorage === "undefined") return new Set();
        try {
            const raw = localStorage.getItem(REVIEW_STORAGE_PREFIX + state.quizKey);
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
            console.warn("No se pudo leer el historial de fallos:", error);
            return new Set();
        }
    }

    /** Persiste el historial de fallos del quiz actual. */
    function saveStoredErrors() {
        if (!state.quizKey || typeof localStorage === "undefined") return;
        try {
            localStorage.setItem(
                REVIEW_STORAGE_PREFIX + state.quizKey,
                JSON.stringify(Array.from(state.erroresHistoricos)),
            );
        } catch (error) {
            console.warn("No se pudo guardar el historial de fallos:", error);
        }
    }

    /** Unión de fallos actuales e históricos. */
    function getReviewQuestionIds() {
        return new Set([...state.erroresSesion, ...state.erroresHistoricos]);
    }

    /** Subconjunto de preguntas que deben entrar en el repaso. */
    function getReviewQuestions() {
        const errores = getReviewQuestionIds();
        return state.todasLasPreguntas.filter((pregunta) => errores.has(pregunta.id));
    }

    /** Ajusta el contador de preguntas según el modo actual. */
    function actualizarTotalPreguntasLabel() {
        const totalEl = $("total-preguntas");
        if (!totalEl) return;
        const prefix = state.modoRepaso ? "Repaso" : "Total";
        totalEl.innerText = `${prefix}: ${state.preguntas.length}`;
    }

    /** Sincroniza visibilidad y texto del botón de repaso. */
    function actualizarBotonRepaso() {
        const reviewBtn = $("review-errors-btn");
        if (!reviewBtn) return;

        const totalErrores = getReviewQuestionIds().size;
        if (state.preguntas.length === 0 && totalErrores === 0) {
            reviewBtn.style.display = "none";
            reviewBtn.disabled = true;
            return;
        }

        reviewBtn.style.display = "inline-flex";
        reviewBtn.disabled = !state.modoRepaso && totalErrores === 0;
        reviewBtn.innerText = state.modoRepaso
            ? "Salir del repaso"
            : totalErrores > 0
                ? `Repasar fallos (${totalErrores})`
                : "Repasar fallos";
    }

    /** Resetea progreso y UI para arrancar un modo de quiz desde cero. */
    function resetQuizProgress() {
        state.preguntaActual = 0;
        state.totalPreguntas = 0;
        state.preguntasCorrectas = 0;
        state.estadosPreguntas = {};

        const resultado = $("resultado");
        if (resultado) resultado.innerText = "";

        const verificarBtn = $("verificar");
        if (verificarBtn) verificarBtn.disabled = true;

        const explicarBtn = $("explicar-ia-btn");
        if (explicarBtn) explicarBtn.disabled = true;

        setVerificarMode("verificar");
        actualizarContador();
    }

    /** Marca una pregunta como pendiente de repaso. */
    function registrarFalloPregunta(questionId) {
        if (!questionId) return;
        state.erroresSesion.add(questionId);
        state.erroresHistoricos.add(questionId);
        saveStoredErrors();
        actualizarBotonRepaso();
    }

    /** Elimina una pregunta del repaso tras responderla correctamente. */
    function resolverFalloPregunta(questionId) {
        if (!questionId) return;
        state.erroresSesion.delete(questionId);
        state.erroresHistoricos.delete(questionId);
        saveStoredErrors();
        actualizarBotonRepaso();
    }

    /** Sale del modo repaso y vuelve al banco completo. */
    function salirModoRepaso() {
        state.modoRepaso = false;
        state.preguntas = [...state.todasLasPreguntas];
        resetQuizProgress();
        actualizarTotalPreguntasLabel();
        actualizarBotonRepaso();
        if (state.preguntas.length > 0) mostrarPregunta();
    }

    /** Activa el modo de repaso usando sesión actual + histórico local. */
    function iniciarModoRepaso() {
        const preguntasRepaso = getReviewQuestions();
        if (preguntasRepaso.length === 0) {
            alert("Todavía no hay preguntas falladas para repasar.");
            actualizarBotonRepaso();
            return;
        }

        state.modoRepaso = true;
        state.preguntas = preguntasRepaso;
        resetQuizProgress();
        actualizarTotalPreguntasLabel();
        actualizarBotonRepaso();
        mostrarPregunta();
    }

    /**
     * Llamada segura a renderMathInElement de KaTeX. Si la librería aún
     * no está cargada (carga `is:inline` desde CDN) silenciamos el error
     * para no romper la primera pintura.
     */
    function renderMath(element) {
        if (typeof window.renderMathInElement === "function") {
            window.renderMathInElement(element, KATEX_OPTIONS);
        }
    }

    /** Resaltado de código con Prism, defensivo ante carga diferida. */
    function highlightCode() {
        if (typeof window.Prism !== "undefined") window.Prism.highlightAll();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. CARGA Y PARSEO DE DATOS
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Descarga un archivo de preguntas y devuelve su texto normalizado.
     *
     * Nota sobre robustez: algunos hostings devuelven un 200 con HTML
     * (página fallback) cuando el archivo no existe. Detectamos ese caso
     * inspeccionando el inicio del cuerpo y lo tratamos como error.
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

        // Normalizamos saltos de línea para que el parser sea agnóstico al SO.
        return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    }

    /**
     * Carga y parsea varios archivos en paralelo. Si alguno falla se
     * registra en consola pero el resto continúa cargándose, evitando
     * que un único error rompa la sesión completa (importante para
     * SDSFULL y REDESFULL, donde se combinan 5-14 archivos).
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
    // 5. RENDERIZADO Y CONTROLADORES DE UI
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Crea (o reutiliza) un icono de estado dentro de un `<label>` de
     * opción. Centraliza el HTML para evitar duplicación entre la
     * verificación inicial y la restauración del estado.
     */
    function ensureStatusIcon(label, iconName) {
        if (label.querySelector(".status-icon")) return;
        const icon = document.createElement("span");
        icon.className = "status-icon";
        icon.innerHTML = `<span class="material-icons">${iconName}</span>`;
        label.appendChild(icon);
    }

    /**
     * Marca visualmente el resultado en cada `<label>`: clase `correct`
     * para las respuestas correctas, `incorrect` para las marcadas que
     * no lo eran. Inhabilita los inputs para impedir cambios.
     */
    function pintarResultado(labels, respuestasCorrectas, seleccionadas) {
        for (const label of labels) {
            const valor = parseInt(label.htmlFor.replace("opcion", ""), 10);
            const inp = label.querySelector("input");
            label.classList.remove("selected");
            if (inp) inp.disabled = true;

            if (respuestasCorrectas.includes(valor)) {
                label.classList.add("correct");
                ensureStatusIcon(label, "check_circle");
            }
            if (seleccionadas.includes(valor) && !respuestasCorrectas.includes(valor)) {
                label.classList.add("incorrect");
                ensureStatusIcon(label, "cancel");
            }
        }
    }

    /**
     * Conmuta el botón "Verificar" entre sus dos modos:
     *   - "verificar": dispara la comprobación de la respuesta.
     *   - "siguiente": pasa a la siguiente pregunta.
     *
     * Mantener un único punto de cambio evita el bug clásico de listeners
     * duplicados/olvidados que existía en la versión previa.
     */
    function setVerificarMode(mode) {
        const btn = $("verificar");
        if (!btn) return;
        btn.removeEventListener("click", verificarRespuesta);
        btn.removeEventListener("click", siguientePregunta);
        if (mode === "verificar") {
            btn.addEventListener("click", verificarRespuesta);
            btn.innerText = "Verificar";
        } else {
            btn.addEventListener("click", siguientePregunta);
            btn.innerText = "Siguiente";
        }
    }

    /** Actualiza el HUD inferior derecho con aciertos y porcentaje. */
    function actualizarContador() {
        const contador = $("contador");
        if (!contador) return;

        const porcentaje =
            state.totalPreguntas !== 0
                ? `| ${Math.round((state.preguntasCorrectas / state.totalPreguntas) * 100)}%`
                : "";

        const modo = state.modoRepaso ? " | Modo repaso" : "";
        contador.innerText = `Correctas: ${state.preguntasCorrectas} | Contestadas: ${state.totalPreguntas} ${porcentaje}${modo}`;
    }

    /**
     * Devuelve la app al estado "menú": limpia containers, oculta los
     * controles del quiz y resetea el mapa de estados por pregunta.
     */
    function resetAppState() {
        hideElement("verificar");
        hideElement("volver");
        hideElement("volver-pregunta");
        showElement("asignaturas-container");
        showElement("app-title");

        const pregunta = $("pregunta");
        const opciones = $("opciones");
        const resultado = $("resultado");
        if (pregunta) pregunta.innerText = "";
        if (opciones) opciones.innerHTML = "";
        if (resultado) resultado.innerText = "";

        state.preguntas = [];
        state.todasLasPreguntas = [];
        state.preguntaActual = 0;
        state.totalPreguntas = 0;
        state.preguntasCorrectas = 0;
        state.modoRepaso = false;
        state.erroresSesion = new Set();
        state.erroresHistoricos = new Set();
        setVerificarMode("verificar");
        state.estadosPreguntas = {};
        actualizarContador();
        actualizarBotonRepaso();
    }

    /**
     * Configura el botón "Reportar" para abrir el modal global con el
     * enunciado y las opciones de la pregunta visible. Se reasigna en
     * cada render porque depende del DOM actualmente pintado.
     */
    function bindReportButton() {
        const btn = $("report-btn");
        if (!btn) return;

        btn.onclick = () => {
            const preguntaTexto = $("pregunta")?.innerText || "";
            const opcionLabels = document.querySelectorAll("form#opciones label .opcion-label");
            const letras = ["A", "B", "C", "D", "E", "F"];
            const opcionesTexto = Array.from(opcionLabels)
                .map((el, i) => `  ${letras[i] || i + 1}. ${el.innerText.trim()}`)
                .join("\n");

            const textoCompleto = `PREGUNTA:\n${preguntaTexto}\n\nOPCIONES:\n${opcionesTexto}`;
            if (typeof window.openReportModal === "function") {
                window.openReportModal(textoCompleto);
            }
        };
    }

    /**
     * Pinta los `<label>` con sus inputs (radio o checkbox) según si la
     * pregunta admite múltiples respuestas. Se omiten las opciones marcadas
     * como "NO MARCAR" en los datasets oficiales.
     */
    function renderOpciones(pregunta, contenedorOpciones) {
        contenedorOpciones.innerHTML = "";

        pregunta.opciones.forEach((opcion, i) => {
            if (opcion.toUpperCase() === "NO MARCAR") return;

            const input = document.createElement("input");
            input.type = pregunta.multiple ? "checkbox" : "radio";
            input.name = "opcion";
            input.id = `opcion${i + 1}`;
            input.value = i + 1;

            const label = document.createElement("label");
            label.htmlFor = `opcion${i + 1}`;
            label.className = "opcion-container";

            const span = document.createElement("span");
            span.innerHTML = splitLongText(formatTextWithCode(opcion));
            span.className = "opcion-label";

            label.appendChild(input);
            label.appendChild(span);
            contenedorOpciones.appendChild(label);
        });
    }

    /**
     * Listener delegado en el contenedor de opciones que mantiene la
     * clase `selected` sincronizada con los inputs marcados y habilita
     * el botón "Verificar" en cuanto se elige al menos una opción.
     *
     * Lo guardamos en `_changeHandler` para poder retirarlo entre
     * preguntas y evitar listeners apilados (issue real en la v.previa).
     */
    function bindOpcionesChangeHandler(contenedorOpciones) {
        if (contenedorOpciones._changeHandler) {
            contenedorOpciones.removeEventListener("change", contenedorOpciones._changeHandler);
        }

        contenedorOpciones._changeHandler = function (e) {
            if (!e.target || e.target.name !== "opcion") return;

            const verificarBtn = $("verificar");
            if (verificarBtn) verificarBtn.disabled = false;

            const labels = contenedorOpciones.getElementsByTagName("label");
            for (const lbl of labels) lbl.classList.remove("selected");

            contenedorOpciones.querySelectorAll("input:checked").forEach((inp) => {
                const parentLabel = inp.closest("label");
                if (parentLabel) parentLabel.classList.add("selected");
            });
        };

        contenedorOpciones.addEventListener("change", contenedorOpciones._changeHandler);
    }

    /**
     * Render principal: dibuja la pregunta visible y resetea/conecta
     * todos los controles dependientes.
     */
    function mostrarPregunta() {
        const verificarBtn = $("verificar");
        if (verificarBtn) verificarBtn.disabled = true;

        const explicarBtn = $("explicar-ia-btn");
        if (explicarBtn) explicarBtn.disabled = true;

        // Accesibilidad de los botones secundarios.
        const volverBtn = $("volver-pregunta");
        if (volverBtn) {
            volverBtn.tabIndex = 0;
            volverBtn.setAttribute("aria-label", "Anterior");
        }
        const saltarBtn = $("saltar-pregunta");
        if (saltarBtn) {
            saltarBtn.tabIndex = 0;
            saltarBtn.setAttribute("aria-label", "Saltar pregunta");
            saltarBtn.onclick = function () {
                guardarEstadoActual();

                const nextIndex = (state.preguntaActual + 1) % state.preguntas.length;
                
                // resetea el historial al dar la vuelta completa.
                if (nextIndex === 0) {
                    state.estadosPreguntas = {}
                };

                state.preguntaActual = nextIndex;
                mostrarPregunta();
                restaurarEstadoActual();
            };
        }

        const pregunta = getPreguntaActual();
        const contenedorPregunta = $("pregunta");
        const contenedorOpciones = $("opciones");

        // Barra de progreso opcional (solo si los elementos existen en el DOM).
        const progressBar = $("progress-bar");
        const progressLabel = $("progress-label");
        if (progressBar && progressLabel) {
            const total = state.preguntas.length;
            const actual = state.preguntaActual + 1;
            progressBar.style.width = `${(actual / total) * 100}%`;
            progressLabel.textContent = `${actual} / ${total}`;
        }

        // Badge opcional con el tema (si los datos lo incluyen en el futuro).
        const badgeTema = $("badge-tema");
        if (badgeTema) badgeTema.textContent = pregunta.tema || "Tema";

        // Pregunta y opciones.
        contenedorPregunta.innerHTML = formatTextWithCode(pregunta.pregunta);
        highlightCode();

        bindReportButton();
        renderOpciones(pregunta, contenedorOpciones);
        bindOpcionesChangeHandler(contenedorOpciones);

        // KaTeX requiere correr después de inyectar el HTML.
        renderMath(contenedorPregunta);
        renderMath(contenedorOpciones);

        if (state.preguntaActual > 0) showElement("volver-pregunta");
        else hideElement("volver-pregunta");
    }

    /**
     * Verifica la respuesta seleccionada contra la correcta, actualiza
     * los contadores y bloquea los inputs para impedir más cambios.
     */
    function verificarRespuesta() {
        const seleccionadasInputs = document.querySelectorAll('input[name="opcion"]:checked');
        if (seleccionadasInputs.length === 0) {
            alert("Selecciona una opción antes de verificar.");
            return;
        }

        state.totalPreguntas++;

        const preguntaActual = getPreguntaActual();
        const respuestasCorrectas = preguntaActual.respuestas;
        const opciones = $("opciones");
        const labels = opciones.getElementsByTagName("label");
        const seleccionadas = Array.from(seleccionadasInputs).map((i) => parseInt(i.value, 10));
        const questionId = preguntaActual.id;

        // El orden no importa: comparamos arrays ordenados.
        const correctasOrdenadas = [...respuestasCorrectas].sort((a, b) => a - b);
        const seleccionadasOrdenadas = [...seleccionadas].sort((a, b) => a - b);
        if (arraysEqual(correctasOrdenadas, seleccionadasOrdenadas)) {
            state.preguntasCorrectas++;
            resolverFalloPregunta(questionId);
        } else {
            registrarFalloPregunta(questionId);
        }

        pintarResultado(labels, respuestasCorrectas, seleccionadas);
        setVerificarMode("siguiente");
        actualizarContador();

        const explicarBtn = $("explicar-ia-btn");
        if (explicarBtn) explicarBtn.disabled = false;
    }

    /** Guarda el estado de la pregunta visible antes de cambiar de índice. */
    function guardarEstadoActual() {
        const seleccionadas = Array.from(
            document.querySelectorAll('input[name="opcion"]:checked'),
        ).map((input) => parseInt(input.value, 10));

        const isVerified = $("verificar")?.innerText === "Siguiente";
        state.estadosPreguntas[getPreguntaStateKey()] = { seleccionadas, isVerified };
    }

    /**
     * Restaura el estado guardado al volver a una pregunta. Si ya estaba
     * verificada, repintamos resultado y dejamos el botón en modo
     * "Siguiente" para mantener la coherencia con la versión previa.
     */
    function restaurarEstadoActual() {
        const guardado = state.estadosPreguntas[getPreguntaStateKey()];
        if (!guardado) return;

        const opciones = $("opciones");
        const inputs = opciones.querySelectorAll("input");

        inputs.forEach((input) => {
            if (guardado.seleccionadas.includes(parseInt(input.value, 10))) {
                input.checked = true;
            }
        });

        // Pinta selección y reactiva Verificar si solo había selección sin verificar.
        if (guardado.seleccionadas.length > 0) {
            const labels = opciones.getElementsByTagName("label");
            for (const lbl of labels) {
                const inp = lbl.querySelector("input");
                if (inp && inp.checked) lbl.classList.add("selected");
            }
            const vBtn = $("verificar");
            if (vBtn && !guardado.isVerified) vBtn.disabled = false;
        }

        if (guardado.isVerified) {
            const respuestasCorrectas = state.preguntas[state.preguntaActual].respuestas;
            pintarResultado(
                opciones.getElementsByTagName("label"),
                respuestasCorrectas,
                guardado.seleccionadas,
            );
            setVerificarMode("siguiente");
            const vBtn = $("verificar");
            if (vBtn) vBtn.disabled = false;

            const explicarBtn = $("explicar-ia-btn");
            if (explicarBtn) explicarBtn.disabled = false;
        }
    }

    /** Avanza al siguiente índice (con wrap-around) y restaura su estado. */
    function siguientePregunta() {
        guardarEstadoActual();

        if (state.modoRepaso) {
            const currentQuestionId = getPreguntaActual()?.id;
            const previousIndex = state.preguntaActual;
            const preguntasRepaso = getReviewQuestions();

            if (preguntasRepaso.length === 0) {
                salirModoRepaso();
                return;
            }

            const currentIndex = preguntasRepaso.findIndex((pregunta) => pregunta.id === currentQuestionId);
            const nextIndex =
                currentIndex === -1
                    ? previousIndex % preguntasRepaso.length
                    : (currentIndex + 1) % preguntasRepaso.length;

            if (nextIndex === 0) {
                state.estadosPreguntas = {};
            }

            state.preguntas = preguntasRepaso;
            state.preguntaActual = nextIndex;
            actualizarTotalPreguntasLabel();
            mostrarPregunta();
            setVerificarMode("verificar");
            const resultado = $("resultado");
            if (resultado) resultado.innerText = "";
            restaurarEstadoActual();
            return;
        }

        const nextIndex = (state.preguntaActual + 1) % state.preguntas.length;

        // Al completar el ciclo, limpia el historial para evitar que aparezcan respuestas previas destacadas.
        if (nextIndex === 0) {
            state.estadosPreguntas = {};
        }

        state.preguntaActual = nextIndex;
        mostrarPregunta();
        setVerificarMode("verificar");
        const resultado = $("resultado");
        if (resultado) resultado.innerText = "";
        restaurarEstadoActual();
    }

    /** Vuelve a la pregunta anterior si no estamos en la primera. */
    function volverPreguntaAnterior() {
        if (state.preguntaActual === 0) return;
        guardarEstadoActual();

        if (state.modoRepaso) {
            state.preguntas = getReviewQuestions();
            if (state.preguntas.length === 0) {
                salirModoRepaso();
                return;
            }
        }

        state.preguntaActual -= 1;
        mostrarPregunta();
        setVerificarMode("verificar");
        const resultado = $("resultado");
        if (resultado) resultado.innerText = "";
        restaurarEstadoActual();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. ARRANQUE DE UNA SESIÓN
    // ─────────────────────────────────────────────────────────────────────

    /** Muestra los controles del quiz tras pasar del menú a una asignatura. */
    function mostrarUIQuiz() {
        hideElement("asignaturas-container");
        hideElement("app-title");
        showElement("verificar");
        showElement("volver");
        showElement("total-preguntas");
        showElement("contador");
    }

    /**
     * Carga una asignatura desde un único archivo `.txt`. En caso de
     * error redirigimos al menú principal: la URL puede ser inválida o
     * el archivo no existir.
     */
    async function iniciarAsignatura(archivo) {
        resetAppState();

        const resumenBtn = $("resumenBtn");
        const copyButton = $("copyButton");
        const aigenBtn   = $("aigen-open-btn");
        if (resumenBtn) resumenBtn.style.display = "block";
        if (copyButton) copyButton.style.display = "flex";
        if (aigenBtn)   aigenBtn.style.display   = "flex";

        state.archivoActual = archivo;
        state.erroresHistoricos = loadStoredErrors();
        const asignaturaNombre = archivo.split("Preguntas.txt")[0].toUpperCase();
        const titleMain = document.querySelector("#asignatura-nombre .title-main");
        if (titleMain) titleMain.innerText = asignaturaNombre;

        try {
            const preguntasTxt = await fetchPreguntasTxt(archivo);
            state.preguntas = parsePreguntasTxt(preguntasTxt);
            shuffle(state.preguntas);
            state.todasLasPreguntas = [...state.preguntas];
            actualizarTotalPreguntasLabel();
            actualizarBotonRepaso();

            mostrarPregunta();
        } catch (error) {
            console.warn("URL inválida o asignatura no encontrada:", error);
            window.location.href = "/";
            return;
        }

        mostrarUIQuiz();
    }

    /** Variante de inicio para grupos multi-archivo (REDESFULL, SDSFULL). */
    async function iniciarMultiplesArchivos(displayName, archivos) {
        resetAppState();

        const resumenBtn = $("resumenBtn");
        const copyButton = $("copyButton");
        const aigenBtn   = $("aigen-open-btn");
        if (resumenBtn) resumenBtn.style.display = "block";
        if (copyButton) copyButton.style.display = "flex";
        if (aigenBtn)   aigenBtn.style.display   = "flex";

        state.archivoActual = displayName;
        state.erroresHistoricos = loadStoredErrors();
        const titleEl = $("asignatura-nombre");
        if (titleEl) titleEl.innerText = displayName;

        const todas = await loadMultipleFiles(archivos);
        state.preguntas = todas;
        shuffle(state.preguntas);
        state.todasLasPreguntas = [...state.preguntas];
        actualizarTotalPreguntasLabel();
        actualizarBotonRepaso();
        mostrarPregunta();
        mostrarUIQuiz();
    }

    /**
     * A partir del id de la URL (slug) decide si arrancar un quiz
     * de un único archivo o de un grupo. La regla por defecto es
     * `${id}Preguntas.txt`; las excepciones se mapean explícitamente.
     */
    function cargarDesdeUrl(id) {
        state.quizKey = id;

        // 1) Grupos multi-archivo (REDESFULL, SDSFULL...).
        const grupo = MULTI_FILE_GROUPS[id];
        if (grupo) {
            iniciarMultiplesArchivos(grupo.displayName, grupo.files);
            return;
        }

        // 2) Asignaturas con nombre de archivo no estándar.
        if (NAME_EXCEPTIONS[id]) {
            iniciarAsignatura(NAME_EXCEPTIONS[id]);
            return;
        }

        // 3) Convención por defecto.
        iniciarAsignatura(`${id}Preguntas.txt`);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 7. WIRING DE BOTONES Y EVENTOS GLOBALES
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Configura el botón "Resumen" (visible una vez iniciada la asignatura).
     * Para SDSFULL persistimos la lista de archivos en sessionStorage para
     * que la pantalla de resumen sepa qué cargar aunque cambie el `id`.
     */
    function bindResumenBtn() {
        const resumenBtn = $("resumenBtn");
        if (!resumenBtn) return;

        resumenBtn.addEventListener("click", () => {
            const currentPath = window.location.pathname.replace(/\/$/, "");

            if (state.archivoActual === MULTI_FILE_GROUPS.sdsfull.displayName) {
                sessionStorage.setItem(
                    "sdsfullArchivos",
                    JSON.stringify(MULTI_FILE_GROUPS.sdsfull.files),
                );
            }

            window.location.href = currentPath + "/resumen";
        });
    }

    /**
     * Atajos de teclado: 1-5 seleccionan opción y disparan `change`,
     * Enter pulsa "Verificar". Compatibilidad con teclado numérico.
     */
    function bindKeyboardShortcuts() {
        document.addEventListener("keydown", (event) => {
            const opciones = document.getElementsByName("opcion");
            if (opciones.length === 0) return;

            const idx = KEY_TO_INDEX[event.key];
            if (idx !== undefined) {
                const target = opciones[idx];
                if (target && !target.disabled) {
                    target.checked = true;
                    target.dispatchEvent(new Event("change", { bubbles: true }));
                }
                return;
            }

            if (event.key === "Enter" || event.key === "NumpadEnter") {
                const verificarBtn = $("verificar");
                if (verificarBtn && !verificarBtn.disabled) verificarBtn.click();
            }
        });
    }

    /**
     * Botón "Copiar": vuelca enunciado + opciones en el portapapeles y
     * da feedback visual durante 2 segundos.
     */
    function bindCopyButton() {
        const copyBtn = $("copyButton");
        if (!copyBtn) return;

        copyBtn.addEventListener("click", () => {
            const pregunta = $("pregunta")?.innerText || "";
            const opciones = Array.from(
                document.querySelectorAll("form#opciones label .opcion-label"),
            ).map((e) => e.innerText.trim());
            const contenido = pregunta + "\n\n" + "- " + opciones.join("\n- ");

            navigator.clipboard.writeText(contenido).then(
                () => {
                    const copyText = $("copyText");
                    const icon = copyBtn.querySelector(".material-icons");
                    if (!copyText || !icon) return;

                    const originalText = copyText.innerText;
                    const originalIcon = icon.innerText;

                    copyText.innerText = "Copiado";
                    icon.innerText = "check";
                    copyBtn.classList.add(
                        "text-green-600",
                        "dark:text-green-400",
                        "border-green-600",
                        "dark:border-green-400",
                    );
                    copyBtn.classList.remove("text-text-muted", "border-border-subtle");

                    setTimeout(() => {
                        copyText.innerText = originalText;
                        icon.innerText = originalIcon;
                        copyBtn.classList.remove(
                            "text-green-600",
                            "dark:text-green-400",
                            "border-green-600",
                            "dark:border-green-400",
                        );
                        copyBtn.classList.add("text-text-muted", "border-border-subtle");
                    }, 2000);
                },
                (err) => console.error("Error al copiar: ", err),
            );
        });
    }

    /** Botón de acceso al modo de repaso de fallos. */
    function bindReviewButton() {
        const reviewBtn = $("review-errors-btn");
        if (!reviewBtn) return;

        reviewBtn.addEventListener("click", () => {
            if (state.modoRepaso) {
                salirModoRepaso();
                return;
            }

            iniciarModoRepaso();
        });
    }

    /**
     * Conecta los listeners persistentes (no dependen de la pregunta
     * visible). Los listeners por pregunta se configuran en mostrarPregunta().
     */
    function bindPersistentListeners() {
        const verificarBtn = $("verificar");
        if (verificarBtn) verificarBtn.addEventListener("click", verificarRespuesta);

        const volverPreguntaBtn = $("volver-pregunta");
        if (volverPreguntaBtn) volverPreguntaBtn.addEventListener("click", volverPreguntaAnterior);

        bindResumenBtn();
        bindCopyButton();
        bindReviewButton();
        bindKeyboardShortcuts();
    }

    /** Punto de entrada: lee el slug de la URL y arranca si procede. */
    function init() {
        bindPersistentListeners();

        const path = window.location.pathname;
        const asignaturaId = path.substring(1).replace(/\/$/, "");

        if (asignaturaId && path !== "/" && path !== "/index.html") {
            cargarDesdeUrl(asignaturaId);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // ─────────────────────────────────────────────────────────────────────
    // 8. API PÚBLICA (consumida por ai-generate.js)
    // ─────────────────────────────────────────────────────────────────────

    window.QuizAPI = {
        /** Copia inmutable de las preguntas actualmente cargadas. */
        getPreguntas: () => [...state.preguntas],

        /**
         * Reemplaza las preguntas del quiz con las generadas por IA y
         * resetea todos los contadores y estados para comenzar desde cero.
         */
        injectGeneratedQuestions(nuevasPreguntas) {
            state.modoRepaso = false;
            state.erroresSesion = new Set();
            state.erroresHistoricos = new Set();
            state.preguntas = nuevasPreguntas.map((pregunta, index) => ({
                ...pregunta,
                id: pregunta.id || hashString(JSON.stringify(pregunta) + ":" + index),
            }));
            state.todasLasPreguntas = [...state.preguntas];
            resetQuizProgress();
            actualizarTotalPreguntasLabel();
            actualizarBotonRepaso();
            mostrarPregunta();
            setVerificarMode("verificar");
        },
    };
})();
