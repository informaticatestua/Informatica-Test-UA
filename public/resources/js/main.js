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
 * El motor se ejecuta dentro de una IIFE para evitar contaminar `window`.
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
        "sti-oficial": "stiPreguntas.txt",
        "stiEnero26": "stiEnero26.txt",
        "stiJulio26": "stiJulio26.txt",
    });

    /**
     * Asignaturas que combinan varios archivos en una sola sesión de quiz.
     * Mantener el orden tiene relevancia: el resumen se construye con la
     * misma lista cuando el usuario abre el botón "Resumen".
     */
    const MULTI_FILE_GROUPS = Object.freeze({
        redes_full: {
            displayName: "Redes full",
            files: [
                "redesPreguntas.txt",
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
        /** Si la sesión actual es un examen (sin feedback hasta el final). */
        modoExamen: false,
        /** Si las preguntas provienen de Supabase (ids UUID, sincronizables). */
        fromSupabase: false,
        /** Si la pantalla de resultados de la sesión está visible. */
        sessionFinished: false,
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
        const prefix = state.modoExamen ? "Examen" : state.modoRepaso ? "Repaso" : "Total";
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

        reviewBtn.style.display = "flex";
        reviewBtn.disabled = !state.modoRepaso && totalErrores === 0;

        const label = $("review-errors-label") || reviewBtn;
        label.innerText = state.modoRepaso
            ? "Salir del repaso"
            : totalErrores > 0
                ? `Repasar fallos (${totalErrores})`
                : "Repasar fallos";
    }

    /** Número de preguntas verificadas en la sesión actual. */
    function getVerifiedQuestionsCount() {
        return state.preguntas.reduce((count, pregunta) => {
            return state.estadosPreguntas[pregunta.id]?.isVerified ? count + 1 : count;
        }, 0);
    }

    /** Oculta o muestra el bloque principal del quiz. */
    function toggleQuizQuestionUI(visible) {
        ["pregunta", "opciones", "resultado", "action-buttons-container"].forEach((id) => {
            const el = $(id);
            if (!el) return;
            el.classList.toggle("hidden", !visible);
        });
    }

    /** Controla la visibilidad de los botones superiores del quiz. */
    function toggleQuizUtilityButtons(visible) {
        const reportBtn = $("report-btn");
        const copyBtn = $("copyButton");
        if (reportBtn) reportBtn.classList.toggle("hidden", !visible);
        if (copyBtn) copyBtn.classList.toggle("hidden", !visible);
    }

    /** Copy breve para la pantalla final según el rendimiento. */
    function getResultsTone(accuracy) {
        if (accuracy === 100) {
            return {
                title: "Módulo dominado",
                subtitle: "Has cerrado la sesión con pleno. Muy buena señal de dominio.",
            };
        }
        if (accuracy >= 75) {
            return {
                title: "Muy buen resultado",
                subtitle: "La base está sólida. Un repaso corto de los fallos puede dejarla redonda.",
            };
        }
        if (accuracy >= 50) {
            return {
                title: "Progreso claro",
                subtitle: "Ya hay bastante asentado. Ahora compensa atacar justo lo que más ha costado.",
            };
        }
        return {
            title: "Sesión completada",
            subtitle: "Has terminado el módulo. El siguiente mejor paso es repasar los fallos con calma.",
        };
    }

    /** Muestra la pantalla de resultados al completar el módulo. */
    function mostrarResultadosSesion() {
        const resultsEl = $("session-results");
        if (!resultsEl) return;

        const total = state.preguntas.length;
        const correct = state.preguntasCorrectas;
        const incorrect = Math.max(total - correct, 0);
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const tone = getResultsTone(accuracy);

        // Test completado: el progreso guardado deja de tener sentido.
        clearSavedProgress();

        state.sessionFinished = true;

        const titleEl = $("results-title");
        const subtitleEl = $("results-subtitle");
        const correctEl = $("results-correct");
        const incorrectEl = $("results-incorrect");
        const accuracyEl = $("results-accuracy");
        const summaryEl = $("results-summary");
        const reviewBtn = $("results-review-btn");

        if (titleEl) titleEl.innerText = tone.title;
        if (subtitleEl) subtitleEl.innerText = tone.subtitle;
        if (correctEl) correctEl.innerText = String(correct);
        if (incorrectEl) incorrectEl.innerText = String(incorrect);
        if (accuracyEl) accuracyEl.innerText = `${accuracy}%`;
        if (summaryEl) {
            summaryEl.innerHTML =
                `<strong>Has completado ${total} preguntas.</strong> ` +
                `Terminas con ${correct} aciertos y ${incorrect} fallos.` +
                (incorrect > 0
                    ? " Puedes repetir el módulo o entrar directamente en repaso de fallos."
                    : " Si quieres reforzarlo aún más, puedes repetir el módulo desde cero.");
        }
        if (reviewBtn) {
            reviewBtn.disabled = incorrect === 0;
            reviewBtn.classList.toggle("hidden", incorrect === 0);
        }

        toggleQuizQuestionUI(false);
        toggleQuizUtilityButtons(false);
        $("tools-trigger-wrap")?.classList.add("hidden");
        resultsEl.classList.remove("hidden");
        hideElement("stats-panel");
        hideElement("report-warning");
    }

    /** Cierra la pantalla final y devuelve la UI habitual del quiz. */
    function ocultarResultadosSesion() {
        const resultsEl = $("session-results");
        if (resultsEl) resultsEl.classList.add("hidden");
        state.sessionFinished = false;
        toggleQuizQuestionUI(true);
        toggleQuizUtilityButtons(true);
        $("tools-trigger-wrap")?.classList.remove("hidden");
    }

    /** Resetea progreso y UI para arrancar un modo de quiz desde cero. */
    function resetQuizProgress() {
        ocultarResultadosSesion();
        state.preguntaActual = 0;
        state.totalPreguntas = 0;
        state.preguntasCorrectas = 0;
        resetEstadosPreguntas();

        clearResultado();

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
        window.Failures?.add(questionId, state.quizKey);
        actualizarBotonRepaso();
    }

    /** Elimina una pregunta del repaso tras responderla correctamente. */
    function resolverFalloPregunta(questionId) {
        if (!questionId) return;
        state.erroresSesion.delete(questionId);
        state.erroresHistoricos.delete(questionId);
        saveStoredErrors();
        window.Failures?.remove(questionId);
        actualizarBotonRepaso();
    }

    /**
     * Mezcla los fallos guardados en Supabase con el histórico local.
     * Solo añade ids presentes en el banco actual para no inflar el contador.
     */
    function mergeRemoteFailures() {
        if (!window.Failures || !window.Auth) return;
        window.Auth.onReady(async (user) => {
            if (!user) return;
            const remote = await window.Failures.load();
            if (remote.size === 0) return;
            const bankIds = new Set(state.todasLasPreguntas.map((p) => p.id));
            let added = false;
            remote.forEach((id) => {
                if (bankIds.has(id) && !state.erroresHistoricos.has(id)) {
                    state.erroresHistoricos.add(id);
                    added = true;
                }
            });
            if (added) actualizarBotonRepaso();
        });
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
     * Restaura el banco completo tras salir de un subconjunto temporal
     * como el modo examen, evitando que queden "pegadas" sus preguntas.
     */
    function restaurarBancoCompleto({ reshuffle = true } = {}) {
        state.preguntas = [...state.todasLasPreguntas];
        if (reshuffle) shuffle(state.preguntas);
        state.todasLasPreguntas = [...state.preguntas];
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5b. MODO EXAMEN REAL
    // ─────────────────────────────────────────────────────────────────────

    /** Alterna la UI exclusiva del examen (cronómetro, panel de navegación, botón móvil). */
    function toggleExamUI(active) {
        const timerChip = $("exam-timer-chip");
        const explicarBtn = $("explicar-ia-btn");
        const navPanel = $("exam-nav-panel");
        const mobileFinishBtn = $("exam-finish-mobile");

        if (timerChip) timerChip.classList.toggle("hidden", !active);
        if (navPanel) navPanel.classList.toggle("hidden", !active);
        if (mobileFinishBtn) mobileFinishBtn.classList.toggle("hidden", !active);
        // Sin feedback durante el examen → sin explicaciones de IA.
        if (explicarBtn) explicarBtn.classList.toggle("hidden", active);
        // El menú "Más opciones" cambiaría el estado del examen: fuera.
        $("tools-trigger-wrap")?.classList.toggle("hidden", active);
    }

    /** Arranca un examen con la configuración del modal. */
    function iniciarModoExamen(config) {
        window.ExamMode?.setConfig(config);

        const banco = [...state.todasLasPreguntas];
        shuffle(banco);

        state.modoExamen = true;
        state.modoRepaso = false;
        state.preguntas = banco.slice(0, config.count);
        resetQuizProgress();
        hideElement("exam-results");

        actualizarTotalPreguntasLabel();
        actualizarBotonRepaso();
        toggleExamUI(true);
        renderExamNavPanel();
        mostrarPregunta();

        window.ExamMode?.startTimer((label) => {
            const el = $("exam-timer-label");
            if (el) el.innerText = label;
        });
    }

    /** Avanza en el examen guardando la selección, sin verificar nada. */
    function examAdvance() {
        guardarEstadoActual();
        const siguiente = state.preguntaActual + 1;
        // Cuando se llega a la última pregunta se vuelve al inicio para permitir
        // revisar o responder las omitidas. El usuario finaliza con el botón "Finalizar".
        state.preguntaActual = siguiente < state.preguntas.length ? siguiente : 0;
        mostrarPregunta();
        restaurarEstadoActual();
        actualizarContador();
    }

    /** Corrige el examen y muestra la pantalla de resultados. */
    function finalizarExamen() {
        if (!state.modoExamen || !window.ExamMode) return;

        guardarEstadoActual();

        const sinResponder = state.preguntas.filter((p) => {
            const sel = state.estadosPreguntas[p.id]?.seleccionadas;
            return !sel || sel.length === 0;
        }).length;

        if (sinResponder > 0) {
            const seguir = confirm(
                `Tienes ${sinResponder} pregunta${sinResponder > 1 ? "s" : ""} sin responder. ` +
                `¿Finalizar el examen igualmente?`,
            );
            if (!seguir) return;
        }

        const elapsed = window.ExamMode.stopTimer();
        const cfg = window.ExamMode.getConfig();
        const res = window.ExamMode.grade(state.preguntas, state.estadosPreguntas);

        // Los fallos del examen también alimentan el repaso.
        res.detail.forEach((d) => {
            if (d.status === "wrong") registrarFalloPregunta(d.pregunta.id);
        });

        state.sessionFinished = true;

        // ── Pintar resultados ────────────────────────────────────────────
        const score = Math.round(res.score * 100) / 100;
        const maxScore = Math.round(state.preguntas.length * cfg.pointsOk * 100) / 100;

        const set = (id, val) => { const el = $(id); if (el) el.innerText = val; };
        set("exam-score", String(score));
        set("exam-time", window.ExamMode.formatTime(elapsed));
        set("exam-correct", String(res.correct));
        set("exam-wrong", String(res.wrong));
        set("exam-blank", String(res.blank));

        const subtitle = $("exam-results-subtitle");
        if (subtitle) {
            subtitle.innerText =
                `Puntuación: ${score} de ${maxScore} posibles ` +
                `(+${cfg.pointsOk} por acierto, −${cfg.pointsBad} por fallo).`;
        }

        const breakdown = $("exam-breakdown");
        if (breakdown) {
            breakdown.innerHTML = res.detail.map((d, i) => {
                const cls =
                    d.status === "correct" ? "border-green-500/50 bg-green-50 dark:bg-green-900/15"
                    : d.status === "wrong" ? "border-red-500/50 bg-red-50 dark:bg-red-900/15"
                    : "border-border-subtle bg-surface-hover/60";
                const icon =
                    d.status === "correct" ? `<span class="material-icons text-green-600 dark:text-green-400" style="font-size:1.2rem;">check_circle</span>`
                    : d.status === "wrong" ? `<span class="material-icons text-red-600 dark:text-red-400" style="font-size:1.2rem;">cancel</span>`
                    : `<span class="material-icons text-text-muted" style="font-size:1.2rem;">remove_circle_outline</span>`;

                const textoOpcion = (idx) => formatTextWithCode(d.pregunta.opciones[idx - 1] ?? "");
                const tuRespuesta = d.seleccionadas.length > 0
                    ? d.seleccionadas.map(textoOpcion).join(", ")
                    : "<em>Sin responder</em>";
                const correcta = d.correctas.map(textoOpcion).join(", ");

                return `
                    <div class="border rounded-xl p-4 ${cls}">
                        <div class="flex items-start gap-2.5">
                            ${icon}
                            <div class="flex-1 min-w-0 text-[0.9em]">
                                <p class="font-medium text-text-main m-0 mb-2 leading-snug"><span class="text-text-muted mr-1">${i + 1}.</span>${formatTextWithCode(d.pregunta.pregunta)}</p>
                                <p class="m-0 text-text-muted text-[0.92em]">Tu respuesta: <span class="${d.status === "wrong" ? "text-red-600 dark:text-red-400 font-medium" : "text-text-main"}">${tuRespuesta}</span></p>
                                ${d.status !== "correct" ? `<p class="m-0 mt-0.5 text-text-muted text-[0.92em]">Correcta: <span class="text-green-700 dark:text-green-400 font-medium">${correcta}</span></p>` : ""}
                            </div>
                        </div>
                    </div>`;
            }).join("");
            renderMath(breakdown);
            highlightCode();
        }

        toggleQuizQuestionUI(false);
        toggleQuizUtilityButtons(false);
        toggleExamUI(false);
        $("tools-trigger-wrap")?.classList.add("hidden");
        hideElement("stats-panel");
        hideElement("report-warning");
        showElement("exam-results");
    }

    /** Sale del examen y restaura el modo test normal. */
    function salirModoExamen() {
        state.modoExamen = false;
        state.sessionFinished = false;
        window.ExamMode?.stopTimer();
        hideElement("exam-results");
        toggleExamUI(false);
        $("tools-trigger-wrap")?.classList.remove("hidden");

        restaurarBancoCompleto();
        resetQuizProgress();
        actualizarTotalPreguntasLabel();
        actualizarBotonRepaso();
        toggleQuizQuestionUI(true);
        toggleQuizUtilityButtons(true);
        showElement("stats-panel");
        mostrarPregunta();
    }

    /** Construye el grid de números del panel de navegación del examen. */
    function renderExamNavPanel() {
        const grid = $("exam-nav-grid");
        const totalEl = $("exam-nav-total");
        if (!grid) return;

        grid.innerHTML = "";
        if (totalEl) totalEl.textContent = String(state.preguntas.length);

        state.preguntas.forEach((pregunta, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "exam-nav-q-btn";
            btn.textContent = String(i + 1);
            btn.setAttribute("data-exam-q-idx", String(i));
            btn.addEventListener("click", () => {
                guardarEstadoActual();
                state.preguntaActual = i;
                mostrarPregunta();
                restaurarEstadoActual();
                actualizarContador();
            });
            grid.appendChild(btn);
        });

        updateExamNavPanel();
    }

    /** Actualiza el estado visual (respondida / actual) de los botones del panel. */
    function updateExamNavPanel() {
        const grid = $("exam-nav-grid");
        const answeredEl = $("exam-nav-answered");
        if (!grid) return;

        let answered = 0;
        grid.querySelectorAll("[data-exam-q-idx]").forEach((btn) => {
            const idx = parseInt(btn.getAttribute("data-exam-q-idx"), 10);
            const pregunta = state.preguntas[idx];
            const sel = pregunta ? (state.estadosPreguntas[pregunta.id]?.seleccionadas || []) : [];
            const isAnswered = sel.length > 0;
            const isCurrent = idx === state.preguntaActual;

            btn.classList.remove("exam-nav-q-btn--answered", "exam-nav-q-btn--current");
            if (isCurrent) {
                btn.classList.add("exam-nav-q-btn--current");
            } else if (isAnswered) {
                btn.classList.add("exam-nav-q-btn--answered");
            }

            if (isAnswered) answered++;
        });

        if (answeredEl) answeredEl.textContent = String(answered);
    }

    /** Abre el modal de configuración del examen. */
    function abrirModalExamen() {
        const max = state.todasLasPreguntas.length;
        if (max === 0) return;

        const maxEl = $("exam-max-questions");
        if (maxEl) maxEl.innerText = String(max);

        const countInput = $("exam-question-count");
        if (countInput) {
            countInput.max = String(max);
            countInput.value = String(Math.min(20, max));
        }
        $("exam-config-error")?.classList.add("hidden");

        showElement("exam-overlay");
        showElement("exam-modal");
    }

    function cerrarModalExamen() {
        hideElement("exam-overlay");
        hideElement("exam-modal");
    }

    /** Valida la configuración y lanza el examen. */
    function confirmarConfigExamen() {
        const errorBox = $("exam-config-error");
        const showError = (msg) => {
            if (errorBox) { errorBox.innerText = msg; errorBox.classList.remove("hidden"); }
        };

        const pointsOk  = parseFloat($("exam-points-ok")?.value);
        const pointsBad = parseFloat($("exam-points-bad")?.value);
        const count     = parseInt($("exam-question-count")?.value, 10);
        const max       = state.todasLasPreguntas.length;

        if (!Number.isFinite(pointsOk) || pointsOk <= 0) { showError("La puntuación por acierto debe ser mayor que 0."); return; }
        if (!Number.isFinite(pointsBad) || pointsBad < 0) { showError("La penalización no puede ser negativa."); return; }
        if (!Number.isInteger(count) || count < 1) { showError("Indica un número de preguntas válido."); return; }
        if (count > max) { showError(`Solo hay ${max} preguntas disponibles en este banco.`); return; }

        cerrarModalExamen();
        iniciarModoExamen({ pointsOk, pointsBad, count });
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
    // 3b. AVISO DE REPORTES, PROGRESO DE TEST Y MODO EXAMEN
    // ─────────────────────────────────────────────────────────────────────

    /** Pinta el aviso de pregunta reportada antes de las opciones de respuesta. */
    function renderReportWarning(pregunta) {
        const box = $("report-warning");
        if (!box) return;

        const count = pregunta?.reportCount || 0;
        if (count < 5) {
            box.classList.add("hidden");
            box.classList.remove("report-warning--strong");
            box.innerHTML = "";
            box.removeAttribute("aria-label");
            return;
        }

        const strong = count >= 10;
        const badgeLabel = `${count} reportes`;
        const title = strong ? "Pregunta muy reportada" : "Pregunta reportada";
        const body = strong
            ? "Muchos estudiantes coinciden en que la respuesta marcada no es correcta. Revísala con criterio."
            : `${count} estudiantes han señalado un posible error en esta pregunta.`;

        box.className = "report-warning" + (strong ? " report-warning--strong" : "");
        box.classList.remove("hidden");
        box.setAttribute(
            "aria-label",
            `${badgeLabel}. ${title}. ${body}`
        );
        box.innerHTML =
            `<div class="report-warning__inner">` +
                `<div class="report-warning__icon" aria-hidden="true">` +
                    `<span class="material-icons">${strong ? "error_outline" : "flag"}</span>` +
                `</div>` +
                `<div class="report-warning__content">` +
                    `<div class="report-warning__header">` +
                        `<span class="report-warning__badge">${badgeLabel}</span>` +
                        `<p class="report-warning__title">${title}</p>` +
                    `</div>` +
                    `<p class="report-warning__text">${body}</p>` +
                    `<div class="report-warning__actions">` +
                        (window.Reports?.hasUserReported?.(pregunta.id)
                            ? `<span class="report-warning__reported-label">Ya has reportado esta pregunta</span>`
                            : `<button id="report-warning-confirm" type="button" class="report-warning__btn report-warning__btn--primary" title="Indica que tú también ves un error en esta pregunta">` +
                                `Yo también veo un error` +
                              `</button>`) +
                        `<button id="report-warning-detail" type="button" class="report-warning__btn report-warning__btn--ghost" title="Abrir formulario para describir el problema">` +
                            `Detallar problema` +
                        `</button>` +
                    `</div>` +
                `</div>` +
            `</div>`;

        box.querySelector("#report-warning-confirm")
            ?.addEventListener("click", () => window.Reports?.confirmReport());
        box.querySelector("#report-warning-detail")
            ?.addEventListener("click", () => window.Reports?.open());
    }

    /** Instantánea del estado actual para poder retomar el test. */
    function buildProgressSnapshot() {
        return {
            question_ids:   state.preguntas.map((p) => p.id),
            states:         state.estadosPreguntas,
            current_index:  state.preguntaActual,
            correct_count:  state.preguntasCorrectas,
            answered_count: state.totalPreguntas,
        };
    }

    /** Programa el guardado del progreso (solo tests normales de Supabase). */
    function scheduleProgressSave(immediate = false) {
        if (!state.fromSupabase || state.modoRepaso || state.modoExamen || state.sessionFinished) return;
        if (!window.TestProgress || !window.Auth?.isLoggedIn()) return;

        const snap = buildProgressSnapshot();
        if (immediate) window.TestProgress.saveNow(state.quizKey, snap);
        else window.TestProgress.save(state.quizKey, snap);
    }

    /** Borra el progreso guardado del quiz actual. */
    function clearSavedProgress() {
        if (state.fromSupabase && window.TestProgress && window.Auth?.isLoggedIn()) {
            window.TestProgress.clear(state.quizKey);
        }
    }

    /** Ofrece retomar un test guardado si existe progreso para este quiz. */
    function ofrecerRetomarProgreso() {
        if (!window.TestProgress || !window.Auth) return;

        window.Auth.onReady(async (user) => {
            if (!user || !state.fromSupabase || state.modoExamen || state.modoRepaso) return;

            const prog = await window.TestProgress.load(state.quizKey);
            if (!prog || !Array.isArray(prog.question_ids) || prog.question_ids.length === 0) return;
            if (!prog.answered_count || prog.answered_count <= 0) return;

            const byId = new Map(state.todasLasPreguntas.map((p) => [p.id, p]));
            const ordered = prog.question_ids.map((id) => byId.get(id)).filter(Boolean);
            if (ordered.length < 2) return;

            const info = $("resume-modal-info");
            if (info) {
                info.textContent =
                    `Llevabas ${prog.answered_count} de ${ordered.length} preguntas respondidas. ` +
                    `¿Quieres continuar donde lo dejaste?`;
            }
            showElement("resume-overlay");
            showElement("resume-modal");

            const cerrar = () => {
                hideElement("resume-overlay");
                hideElement("resume-modal");
            };

            const contBtn = $("resume-continue-btn");
            const discBtn = $("resume-discard-btn");
            if (contBtn) contBtn.onclick = () => { cerrar(); aplicarProgresoGuardado(ordered, prog); };
            if (discBtn) discBtn.onclick = () => { cerrar(); window.TestProgress.clear(state.quizKey); };
        });
    }

    /** Restaura un progreso guardado: orden, respuestas y contadores. */
    function aplicarProgresoGuardado(ordered, prog) {
        state.preguntas = ordered;
        state.estadosPreguntas = prog.states && typeof prog.states === "object" ? prog.states : {};
        state.preguntasCorrectas = prog.correct_count || 0;
        state.totalPreguntas = prog.answered_count || 0;
        state.preguntaActual = Math.min(Math.max(prog.current_index || 0, 0), ordered.length - 1);

        actualizarTotalPreguntasLabel();
        actualizarContador();
        mostrarPregunta();
        setVerificarMode("verificar");
        clearResultado();
        restaurarEstadoActual();
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
        // En modo examen el botón siempre avanza y está habilitado.
        if (state.modoExamen) {
            btn.innerText = "Siguiente";
            btn.disabled = false;
        }
    }

    /** Actualiza el HUD inferior derecho con aciertos y porcentaje. */
    function actualizarContador() {
        const contador = $("contador");
        if (!contador) return;

        // En examen no se desvela ningún resultado: solo el avance.
        if (state.modoExamen) {
            const respondidas = state.preguntas.reduce((n, p) => {
                const sel = state.estadosPreguntas[p.id]?.seleccionadas;
                return sel && sel.length > 0 ? n + 1 : n;
            }, 0);
            contador.innerText = `Respondidas: ${respondidas} / ${state.preguntas.length}`;
            return;
        }

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
        ocultarResultadosSesion();

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
        state.modoExamen = false;
        state.fromSupabase = false;
        state.sessionFinished = false;
        state.erroresSesion = new Set();
        state.erroresHistoricos = new Set();
        window.ExamMode?.stopTimer();
        toggleExamUI(false);
        hideElement("exam-results");
        hideElement("report-warning");
        setVerificarMode("verificar");
        resetEstadosPreguntas();
        actualizarContador();
        actualizarBotonRepaso();
    }

    function showQuizActionButtons() {
        toggleQuizQuestionUI(true);
        toggleQuizUtilityButtons(true);
    }

    function clearResultado() {
        const r = $("resultado");
        if (r) r.innerText = "";
    }

    function resetEstadosPreguntas() {
        state.estadosPreguntas = {};
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
        if (state.sessionFinished) return;

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

                // resetea el historial al dar la vuelta completa (nunca en examen).
                if (nextIndex === 0 && !state.modoExamen) {
                    state.estadosPreguntas = {}
                };

                state.preguntaActual = nextIndex;
                mostrarPregunta();
                restaurarEstadoActual();
                scheduleProgressSave();
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

        // Aviso de reportes de la pregunta visible.
        renderReportWarning(pregunta);

        // Pregunta y opciones.
        contenedorPregunta.innerHTML = formatTextWithCode(pregunta.pregunta);
        highlightCode();

        renderOpciones(pregunta, contenedorOpciones);
        bindOpcionesChangeHandler(contenedorOpciones);

        // KaTeX requiere correr después de inyectar el HTML.
        renderMath(contenedorPregunta);
        renderMath(contenedorOpciones);

        // En modo examen el botón siempre avanza (sin verificación).
        if (state.modoExamen && verificarBtn) {
            verificarBtn.innerText = "Siguiente";
            verificarBtn.disabled = false;
        }

        if (state.preguntaActual > 0) showElement("volver-pregunta");
        else hideElement("volver-pregunta");

        if (state.modoExamen) updateExamNavPanel();
    }

    /**
     * Verifica la respuesta seleccionada contra la correcta, actualiza
     * los contadores y bloquea los inputs para impedir más cambios.
     */
    function verificarRespuesta() {
        // En modo examen no hay verificación: el botón avanza sin feedback.
        if (state.modoExamen) {
            examAdvance();
            return;
        }

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

        // Persistir el estado recién verificado y el progreso del test.
        guardarEstadoActual();
        scheduleProgressSave();

        const explicarBtn = $("explicar-ia-btn");
        if (explicarBtn) explicarBtn.disabled = false;
    }

    /** Guarda el estado de la pregunta visible antes de cambiar de índice. */
    function guardarEstadoActual() {
        const seleccionadas = Array.from(
            document.querySelectorAll('input[name="opcion"]:checked'),
        ).map((input) => parseInt(input.value, 10));

        // En examen nada queda "verificado": solo se conserva la selección.
        const isVerified = !state.modoExamen && $("verificar")?.innerText === "Siguiente";
        state.estadosPreguntas[getPreguntaStateKey()] = { seleccionadas, isVerified };

        if (state.modoExamen) updateExamNavPanel();
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
                resetEstadosPreguntas();
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
        const sessionComplete = getVerifiedQuestionsCount() >= state.preguntas.length;

        if (nextIndex === 0 && sessionComplete) {
            mostrarResultadosSesion();
            return;
        }

        // Al completar el ciclo, limpia el historial para evitar que aparezcan respuestas previas destacadas.
        if (nextIndex === 0 && !state.modoExamen) {
            resetEstadosPreguntas();
        }

        state.preguntaActual = nextIndex;
        mostrarPregunta();
        setVerificarMode("verificar");
        clearResultado();
        restaurarEstadoActual();
        scheduleProgressSave();
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
        clearResultado();
        restaurarEstadoActual();
        scheduleProgressSave();
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
        showElement("stats-panel");
    }

    /**
     * Carga una asignatura desde un único archivo `.txt`. En caso de
     * error redirigimos al menú principal: la URL puede ser inválida o
     * el archivo no existir.
     */
    async function iniciarAsignatura(archivo) {
        resetAppState();

        showQuizActionButtons();

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

        showQuizActionButtons();

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
     * A partir del id de la URL (slug) carga las preguntas:
     *
     *  1. Intenta obtenerlas desde Supabase (via window.QuizData).
     *  2. Si Supabase no responde o no hay datos, cae al fallback
     *     de archivos .txt (grupos multi-archivo o convención estándar).
     */
    async function cargarDesdeUrl(id, sourceFile) {
        state.quizKey = id;

        // ── 1. Fuente Supabase ──────────────────────────────────────────
        if (window.QuizData) {
            let preguntas = null;
            try {
                preguntas = await window.QuizData.getQuestions(id, sourceFile);
            } catch (err) {
                console.warn("[QuizData] Error al consultar Supabase:", err);
            }

            if (preguntas && preguntas.length > 0) {
                resetAppState();

                const resumenBtn = $("resumenBtn");
                const copyButton = $("copyButton");
                const aigenBtn   = $("aigen-open-btn");
                const examBtn    = $("exam-open-btn");
                if (resumenBtn) resumenBtn.style.display = "flex";
                if (copyButton) copyButton.style.display = "flex";
                if (aigenBtn)   aigenBtn.style.display   = "flex";
                if (examBtn)    examBtn.style.display    = "flex";

                state.archivoActual = id;
                state.fromSupabase = true;
                state.erroresHistoricos = loadStoredErrors();

                const displayName = id.toUpperCase().replace(/-/g, " ");
                const titleMain = document.querySelector("#asignatura-nombre .title-main");
                if (titleMain) titleMain.innerText = displayName;

                state.preguntas = preguntas;
                shuffle(state.preguntas);
                state.todasLasPreguntas = [...state.preguntas];
                actualizarTotalPreguntasLabel();
                actualizarBotonRepaso();
                mostrarPregunta();
                mostrarUIQuiz();

                // Fallos remotos + posible test a medias (requieren sesión).
                mergeRemoteFailures();
                ofrecerRetomarProgreso();
                return;
            }
        }

        // ── 2. Fallback: archivos .txt ──────────────────────────────────
        const grupo = MULTI_FILE_GROUPS[id];
        if (grupo) {
            iniciarMultiplesArchivos(grupo.displayName, grupo.files);
            return;
        }

        if (NAME_EXCEPTIONS[id]) {
            iniciarAsignatura(NAME_EXCEPTIONS[id]);
            return;
        }

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

    /**
     * Panel "Herramientas": rejilla accesible sin scroll de página.
     * En móvil abre como bottom sheet; en desktop como diálogo centrado.
     */
    function bindMoreOptionsMenu() {
        const toggleBtn = $("more-options-btn");
        const sheet = $("tools-sheet");
        const panel = $("tools-sheet-panel");
        const backdrop = $("tools-sheet-backdrop");
        const closeBtn = $("tools-sheet-close");
        if (!toggleBtn || !sheet || !panel) return;

        const closeSheet = () => {
            sheet.classList.remove("tools-sheet--open");
            sheet.setAttribute("aria-hidden", "true");
            toggleBtn.setAttribute("aria-expanded", "false");
            document.body.classList.remove("tools-sheet-body-lock");
        };
        const openSheet = () => {
            sheet.classList.add("tools-sheet--open");
            sheet.setAttribute("aria-hidden", "false");
            toggleBtn.setAttribute("aria-expanded", "true");
            document.body.classList.add("tools-sheet-body-lock");
            closeBtn?.focus();
        };

        toggleBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            if (sheet.classList.contains("tools-sheet--open")) closeSheet();
            else openSheet();
        });

        closeBtn?.addEventListener("click", closeSheet);
        backdrop?.addEventListener("click", closeSheet);

        panel.addEventListener("click", (event) => {
            if (event.target.closest("button") && event.target.closest("button") !== closeBtn) {
                closeSheet();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && sheet.classList.contains("tools-sheet--open")) {
                closeSheet();
                toggleBtn.focus();
            }
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

    /** Acciones disponibles desde la pantalla final de sesión. */
    function bindSessionResultsButtons() {
        const restartBtn = $("results-restart-btn");
        const reviewBtn = $("results-review-btn");
        const resumenBtn = $("results-resumen-btn");

        if (restartBtn) {
            restartBtn.addEventListener("click", () => {
                clearSavedProgress();
                state.modoRepaso = false;
                state.sessionFinished = false;
                state.erroresSesion = new Set();
                state.preguntas = [...state.todasLasPreguntas];
                shuffle(state.preguntas);
                state.todasLasPreguntas = [...state.preguntas];
                resetQuizProgress();
                actualizarTotalPreguntasLabel();
                actualizarBotonRepaso();
                mostrarUIQuiz();
                mostrarPregunta();
            });
        }

        if (reviewBtn) {
            reviewBtn.addEventListener("click", () => {
                ocultarResultadosSesion();
                iniciarModoRepaso();
                mostrarUIQuiz();
            });
        }

        if (resumenBtn) {
            resumenBtn.addEventListener("click", () => {
                $("resumenBtn")?.click();
            });
        }
    }

    /** Botones del modo examen: menú, modal de configuración y resultados. */
    function bindExamButtons() {
        $("exam-open-btn")?.addEventListener("click", abrirModalExamen);
        $("exam-close")?.addEventListener("click", cerrarModalExamen);
        $("exam-overlay")?.addEventListener("click", cerrarModalExamen);
        $("exam-start-btn")?.addEventListener("click", confirmarConfigExamen);
        $("exam-finish-btn")?.addEventListener("click", finalizarExamen);
        $("exam-finish-mobile")?.addEventListener("click", finalizarExamen);
        $("exam-exit-btn")?.addEventListener("click", salirModoExamen);
        $("exam-retry-btn")?.addEventListener("click", () => {
            hideElement("exam-results");
            iniciarModoExamen(window.ExamMode?.getConfig() || { pointsOk: 1, pointsBad: 0.25, count: 20 });
            toggleQuizQuestionUI(true);
            toggleQuizUtilityButtons(true);
            showElement("stats-panel");
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !$("exam-modal")?.classList.contains("hidden")) {
                cerrarModalExamen();
            }
        });
    }

    /** Enlaces a contribuir pregunta y al foro de la asignatura actual. */
    function bindCommunityButtons() {
        $("contribute-btn")?.addEventListener("click", () => {
            window.location.href = "/contribuir?subject=" + encodeURIComponent(state.quizKey || "");
        });
        $("forum-btn")?.addEventListener("click", () => {
            window.location.href = "/foro/" + encodeURIComponent(state.quizKey || "");
        });
    }

    /** Refresca el aviso de reportes cuando el usuario reporta la pregunta. */
    function bindReportEvents() {
        document.addEventListener("question-reported", (e) => {
            const questionId = e.detail?.questionId;
            if (!questionId) return;
            const pregunta = state.todasLasPreguntas.find((p) => p.id === questionId);
            if (pregunta) pregunta.reportCount = (pregunta.reportCount || 0) + 1;
            const actual = getPreguntaActual();
            if (actual?.id === questionId) renderReportWarning(actual);
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
        bindMoreOptionsMenu();
        bindReviewButton();
        bindSessionResultsButtons();
        bindKeyboardShortcuts();
        bindExamButtons();
        bindCommunityButtons();
        bindReportEvents();

        window.addEventListener("pageshow", (event) => {
            if (!event.persisted || state.todasLasPreguntas.length === 0) return;

            // Al regresar desde el back/forward cache (bfcache) el navegador
            // restaura la página con el estado en memoria "congelado". Si ese
            // estado era un subconjunto temporal (examen, repaso) o la pantalla
            // final de resultados, quedarían pegadas las preguntas de la sesión
            // anterior (p. ej. las del modo examen) en lugar del banco completo.
            const estadoCongelado =
                state.modoExamen ||
                state.modoRepaso ||
                state.sessionFinished ||
                state.preguntas.length !== state.todasLasPreguntas.length;
            if (!estadoCongelado) return;

            state.modoExamen = false;
            state.modoRepaso = false;
            state.sessionFinished = false;
            window.ExamMode?.stopTimer();
            hideElement("exam-results");
            ocultarResultadosSesion();
            toggleExamUI(false);
            $("tools-trigger-wrap")?.classList.remove("hidden");
            restaurarBancoCompleto();
            resetQuizProgress();
            actualizarTotalPreguntasLabel();
            actualizarBotonRepaso();
            toggleQuizQuestionUI(true);
            toggleQuizUtilityButtons(true);
            showElement("stats-panel");
            mostrarPregunta();
        });
    }

    /** Punto de entrada: lee el slug de la URL y arranca si procede. */
    function init() {
        bindPersistentListeners();

        const path = window.location.pathname;
        const asignaturaId = path.substring(1).replace(/\/$/, "");

        // Sección concreta dentro de la asignatura (columna source_file).
        // Se pasa como query param, p. ej. /hada?src=HADA%20Julio%202026
        const sourceFile = new URLSearchParams(window.location.search).get("src") || undefined;

        if (asignaturaId && path !== "/" && path !== "/index.html") {
            cargarDesdeUrl(asignaturaId, sourceFile);
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

        /** Pregunta actualmente visible (incluye id de Supabase si procede). */
        getCurrentQuestion: () => getPreguntaActual(),

        /**
         * Reemplaza las preguntas del quiz con las generadas por IA y
         * resetea todos los contadores y estados para comenzar desde cero.
         */
        injectGeneratedQuestions(nuevasPreguntas) {
            state.modoRepaso = false;
            state.modoExamen = false;
            // Las preguntas de IA no existen en la BD: sin sync ni progreso.
            state.fromSupabase = false;
            window.ExamMode?.stopTimer();
            toggleExamUI(false);
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
