/**
 * failures.js — Sincronización de preguntas falladas con Supabase.
 *
 * Tabla: saved_errors (user_id, question_id, subject_id) con RLS de dueño.
 * Solo sincroniza preguntas cuyo id es un UUID de Supabase; las preguntas
 * generadas por IA o cargadas desde .txt siguen viviendo en localStorage
 * (de eso se encarga main.js).
 *
 * API (window.Failures):
 *   load()                    → Promise<Set<uuid>> con los fallos remotos
 *   add(questionId, quizKey)  → fire-and-forget
 *   remove(questionId)        → fire-and-forget
 *   isSyncable(questionId)    → boolean (es UUID)
 */
(function () {
    "use strict";

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function isSyncable(questionId) {
        return typeof questionId === "string" && UUID_RE.test(questionId);
    }

    async function load() {
        const db = window.Utils?.getDb();
        const uid = window.Utils?.userId();
        if (!db || !uid) return new Set();

        const { data, error } = await db
            .from("saved_errors")
            .select("question_id")
            .eq("user_id", uid);

        if (error) {
            console.warn("[Failures] No se pudieron cargar los fallos remotos:", error.message);
            return new Set();
        }
        return new Set((data || []).map((r) => r.question_id));
    }

    async function add(questionId, quizKey) {
        const db = getDb();
        const uid = userId();
        if (!db || !uid || !isSyncable(questionId)) return;

        const row = { user_id: uid, question_id: questionId, subject_id: quizKey || null };
        let { error } = await db
            .from("saved_errors")
            .upsert(row, { onConflict: "user_id,question_id", ignoreDuplicates: true });

        // El slug puede no existir en subjects (grupos multi-archivo) → reintento sin él
        if (error && error.code === "23503") {
            ({ error } = await db
                .from("saved_errors")
                .upsert({ ...row, subject_id: null }, { onConflict: "user_id,question_id", ignoreDuplicates: true }));
        }
        if (error) console.warn("[Failures] add error:", error.message);
    }

    async function remove(questionId) {
        const db = getDb();
        const uid = userId();
        if (!db || !uid || !isSyncable(questionId)) return;

        const { error } = await db
            .from("saved_errors")
            .delete()
            .eq("user_id", uid)
            .eq("question_id", questionId);

        if (error) console.warn("[Failures] remove error:", error.message);
    }

    window.Failures = { load, add, remove, isSyncable };
})();
