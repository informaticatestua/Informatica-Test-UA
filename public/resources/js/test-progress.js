/**
 * test-progress.js — Guardar y retomar el progreso de un test.
 *
 * Tabla: test_progress (UNIQUE user_id + quiz_key) con RLS de dueño.
 * Solo aplica a tests cargados desde Supabase (ids UUID) con sesión activa.
 *
 * API (window.TestProgress):
 *   load(quizKey)              → Promise<fila|null>
 *   save(quizKey, snapshot)    → guardado debounced (1,5 s)
 *   saveNow(quizKey, snapshot) → guardado inmediato
 *   clear(quizKey)             → elimina el progreso guardado
 *
 * snapshot = { question_ids, states, current_index, correct_count, answered_count }
 */
(function () {
    "use strict";

    const DEBOUNCE_MS = 1500;
    let _timer   = null;
    let _pending = null;

    async function load(quizKey) {
        const db = window.Utils?.getDb();
        const uid = window.Utils?.userId();
        if (!db || !uid || !quizKey) return null;

        const { data, error } = await db
            .from("test_progress")
            .select("question_ids, states, current_index, correct_count, answered_count, updated_at")
            .eq("user_id", uid)
            .eq("quiz_key", quizKey)
            .maybeSingle();

        if (error) {
            console.warn("[TestProgress] load error:", error.message);
            return null;
        }
        return data;
    }

    async function flush() {
        if (!_pending) return;
        const { quizKey, snapshot } = _pending;
        _pending = null;

        const db = window.Utils?.getDb();
        const uid = window.Utils?.userId();
        if (!db || !uid) return;

        try {
            const { error } = await db
                .from("test_progress")
                .upsert({
                    user_id:        uid,
                    quiz_key:       quizKey,
                    question_ids:   snapshot.question_ids,
                    states:         snapshot.states,
                    current_index:  snapshot.current_index,
                    correct_count:  snapshot.correct_count,
                    answered_count: snapshot.answered_count,
                    updated_at:     new Date().toISOString(),
                }, { onConflict: "user_id,quiz_key" });

            if (error) console.error("[TestProgress] save error:", error.message);
        } catch (e) {
            console.error("[TestProgress] flush exception:", e);
        }
    }

    function save(quizKey, snapshot) {
        if (!window.Utils?.userId() || !quizKey) return;
        _pending = { quizKey, snapshot };
        clearTimeout(_timer);
        _timer = setTimeout(flush, DEBOUNCE_MS);
    }

    function saveNow(quizKey, snapshot) {
        if (!window.Utils?.userId() || !quizKey) return;
        _pending = { quizKey, snapshot };
        clearTimeout(_timer);
        flush();
    }

    async function clear(quizKey) {
        clearTimeout(_timer);
        _pending = null;

        const db = window.Utils?.getDb();
        const uid = window.Utils?.userId();
        if (!db || !uid || !quizKey) return;

        const { error } = await db
            .from("test_progress")
            .delete()
            .eq("user_id", uid)
            .eq("quiz_key", quizKey);

        if (error) console.warn("[TestProgress] clear error:", error.message);
    }

    // Volcado final si el usuario cierra la pestaña con un guardado pendiente
    window.addEventListener("beforeunload", () => { if (_pending) flush(); });

    window.TestProgress = { load, save, saveNow, clear };
})();
