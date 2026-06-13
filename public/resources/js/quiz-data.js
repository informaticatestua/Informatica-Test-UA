/**
 * quiz-data.js — Repositorio de preguntas desde Supabase.
 *
 * Esquema real en BD (ver migration 015 para renombrados):
 *   questions: id, subject_id, content, is_multiple, report_count, source_file, position_in_file, content_hash
 *   options:   id, question_id, content, is_correct, is_no_marcar, position
 *   subjects:  id (= slug URL), display_name, parent_id
 *
 * Transforma las filas al formato interno que main.js espera:
 *   { id, pregunta, opciones[], respuestas[], multiple, reportCount }
 *
 * Expone window.QuizData. Si SupabaseClient no está disponible,
 * los métodos devuelven null y main.js carga desde archivos .txt.
 */
(function () {
    "use strict";

    /**
     * Slugs de grupos multi-asignatura → parent_id en subjects.
     * Se usa cuando el slug de la URL no coincide con ningún subject_id
     * directo, pero sí con el parent_id de un grupo de asignaturas.
     */
    const GROUP_PARENT_MAP = Object.freeze({
        sdsfull:    "sds",
        redes_full: "redes_parent",
    });

    /**
     * Transforma una pregunta del formato Supabase al formato de main.js.
     *
     * Filtra automáticamente las opciones marcadas como is_no_marcar.
     */
    function transformQuestion(q) {
        const validOpts = (q.options || [])
            .filter((o) => !o.is_no_marcar)
            .sort((a, b) => a.position - b.position);

        const opciones = validOpts.map((o) => o.content);
        const respuestas = validOpts
            .map((o, i) => (o.is_correct ? i + 1 : null))
            .filter(Boolean);

        return {
            id:          q.id,
            pregunta:    q.content,
            opciones,
            respuestas,
            multiple:    q.is_multiple || respuestas.length > 1,
            reportCount: q.report_count || 0,
        };
    }

    /**
     * Carga preguntas de uno o varios subject_id en una sola llamada.
     * Devuelve null si hay error o no hay resultados.
     */
    async function fetchBySubjectIds(subjectIds) {
        const db = window.SupabaseClient;
        if (!db) return null;

        const { data, error } = await db
            .from("questions")
            .select("id, content, is_multiple, report_count, options(id, content, is_correct, is_no_marcar, position)")
            .in("subject_id", subjectIds);

        if (error || !data || data.length === 0) return null;

        return data.map(transformQuestion);
    }

    /**
     * Obtiene los subject_id de los hijos de un parent_id.
     */
    async function getChildSubjectIds(parentId) {
        const db = window.SupabaseClient;
        if (!db) return [];

        const { data, error } = await db
            .from("subjects")
            .select("id")
            .eq("parent_id", parentId);

        if (error || !data) return [];
        return data.map((s) => s.id);
    }

    /**
     * Punto de entrada principal para main.js.
     *
     * Estrategia de resolución (en orden):
     *  1. subject_id directo → `questions WHERE subject_id = slug`
     *  2. Grupo mapeado → `GROUP_PARENT_MAP[slug]` → busca hijos por parent_id
     *  3. Slug = parent_id → busca hijos con `subjects WHERE parent_id = slug`
     *  4. Devuelve null → main.js usa el fallback de archivos .txt
     */
    async function getQuestions(slug) {
        if (!window.SupabaseClient) return null;

        // 1. Coincidencia directa con subject_id
        const direct = await fetchBySubjectIds([slug]);
        if (direct !== null) return direct;

        // 2. Grupo con parent_id mapeado explícitamente
        const mappedParent = GROUP_PARENT_MAP[slug];
        if (mappedParent) {
            const childIds = await getChildSubjectIds(mappedParent);
            if (childIds.length > 0) {
                return await fetchBySubjectIds(childIds);
            }
        }

        // 3. El slug es directamente un parent_id (p.ej. "ada" → ada-full, ada-p1…)
        const childIds = await getChildSubjectIds(slug);
        if (childIds.length > 0) {
            return await fetchBySubjectIds(childIds);
        }

        return null;
    }

    window.QuizData = { getQuestions, fetchBySubjectIds, transformQuestion };
})();
