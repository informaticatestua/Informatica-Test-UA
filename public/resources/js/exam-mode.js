/**
 * exam-mode.js — Utilidades del Modo Examen Real.
 *
 * Gestiona la configuración, el cronómetro ascendente y el cálculo de la
 * puntuación. La orquestación del flujo (preguntas, navegación, UI) vive
 * en main.js, que consume esta API.
 *
 * API (window.ExamMode):
 *   setConfig({ pointsOk, pointsBad, count })
 *   getConfig()                  → copia de la configuración
 *   startTimer(onTick)           → onTick(label) cada segundo
 *   stopTimer()                  → devuelve segundos transcurridos
 *   getElapsed()                 → segundos transcurridos
 *   formatTime(seconds)          → "m:ss" / "h:mm:ss"
 *   grade(preguntas, estados)    → { score, correct, wrong, blank, detail[] }
 */
(function () {
    "use strict";

    let _config = { pointsOk: 1, pointsBad: 0.25, count: 20 };

    let _timerInterval = null;
    let _startedAt     = null;
    let _elapsed       = 0;

    // ─── Configuración ────────────────────────────────────────────────────────

    function setConfig(cfg) {
        _config = { ..._config, ...cfg };
    }

    function getConfig() {
        return { ..._config };
    }

    // ─── Cronómetro ───────────────────────────────────────────────────────────

    function formatTime(totalSeconds) {
        const s = Math.max(0, Math.floor(totalSeconds));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        return `${m}:${String(sec).padStart(2, "0")}`;
    }

    function startTimer(onTick) {
        stopTimer();
        _startedAt = Date.now();
        _elapsed = 0;
        if (typeof onTick === "function") onTick(formatTime(0));

        _timerInterval = setInterval(() => {
            _elapsed = (Date.now() - _startedAt) / 1000;
            if (typeof onTick === "function") onTick(formatTime(_elapsed));
        }, 1000);
    }

    function stopTimer() {
        if (_timerInterval) {
            clearInterval(_timerInterval);
            _timerInterval = null;
            if (_startedAt !== null) {
                _elapsed = (Date.now() - _startedAt) / 1000;
            }
        }
        return _elapsed;
    }

    function getElapsed() {
        if (_startedAt === null) return 0;
        return _timerInterval ? (Date.now() - _startedAt) / 1000 : _elapsed;
    }

    // ─── Corrección ───────────────────────────────────────────────────────────

    /**
     * Corrige el examen comparando selecciones guardadas con las respuestas.
     *
     * @param {Array}  preguntas — las preguntas del examen (formato main.js)
     * @param {Object} estados   — estadosPreguntas: { [id]: { seleccionadas: [] } }
     */
    function grade(preguntas, estados) {
        let correct = 0, wrong = 0, blank = 0;
        const detail = [];

        for (const pregunta of preguntas) {
            const seleccionadas = (estados[pregunta.id]?.seleccionadas || []).slice().sort((a, b) => a - b);
            const correctas     = (pregunta.respuestas || []).slice().sort((a, b) => a - b);

            let status;
            if (seleccionadas.length === 0) {
                status = "blank";
                blank++;
            } else if (
                seleccionadas.length === correctas.length &&
                seleccionadas.every((v, i) => v === correctas[i])
            ) {
                status = "correct";
                correct++;
            } else {
                status = "wrong";
                wrong++;
            }

            detail.push({ pregunta, seleccionadas, correctas, status });
        }

        const score = correct * _config.pointsOk - wrong * _config.pointsBad;

        return { score, correct, wrong, blank, detail };
    }

    window.ExamMode = { setConfig, getConfig, startTimer, stopTimer, getElapsed, formatTime, grade };
})();
