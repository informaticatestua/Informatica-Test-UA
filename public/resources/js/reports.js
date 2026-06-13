/**
 * reports.js — Modal de reporte de preguntas + confirmación rápida.
 *
 * Uso externo:
 *   window.Reports.open()              → abre el modal para la pregunta actual
 *   window.Reports.close()             → cierra el modal
 *   window.Reports.confirmReport()     → +1 rápido sin modal
 *   window.Reports.hasUserReported(id) → true si el usuario ya reportó esa pregunta
 */
(function () {
    "use strict";

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // ─── Set en memoria de preguntas ya reportadas por el usuario ────────────
    // Se rellena desde Supabase al hacer login; se actualiza al reportar.

    const _reportedByUser = new Set();

    function hasUserReported(questionId) {
        return _reportedByUser.has(questionId);
    }

    function markAsReported(questionId) {
        _reportedByUser.add(questionId);
    }

    async function loadUserReports(userId) {
        const db = window.Utils?.getDb();
        if (!db || !userId) return;
        try {
            const { data, error } = await db
                .from("reports")
                .select("question_id")
                .eq("user_id", userId);
            if (error) {
                console.error("[Reports] loadUserReports error:", error);
                return;
            }
            (data || []).forEach((r) => _reportedByUser.add(r.question_id));
        } catch (e) {
            console.error("[Reports] loadUserReports exception:", e);
        }
    }

    // ─── Modal helpers ────────────────────────────────────────────────────────

    function openModal() {
        if (!window.Auth?.isLoggedIn()) {
            window.Utils?.redirectToLogin();
            return;
        }

        const q = window.QuizAPI?.getCurrentQuestion();
        if (!q?.id || !UUID_RE.test(q.id)) {
            alert("Esta pregunta no puede reportarse porque no está en la base de datos aún.");
            return;
        }

        const modal = document.getElementById("report-modal");
        if (modal) modal.dataset.questionId = q.id;

        const detailsEl = document.getElementById("report-details");
        const errorEl   = document.getElementById("report-error");
        const successEl = document.getElementById("report-success");
        const formEl    = document.getElementById("report-form-body");
        const submitBtn = document.getElementById("report-submit-btn");

        if (detailsEl) detailsEl.value = "";
        if (errorEl)   errorEl.classList.add("hidden");
        if (successEl) successEl.classList.add("hidden");
        if (formEl)    formEl.classList.remove("hidden");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Enviar reporte"; }

        document.getElementById("report-overlay")?.classList.remove("hidden");
        document.getElementById("report-modal")?.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    }

    function closeModal() {
        document.getElementById("report-overlay")?.classList.add("hidden");
        document.getElementById("report-modal")?.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    function showError(msg) {
        const el = document.getElementById("report-error");
        if (el) { el.textContent = msg; el.classList.remove("hidden"); }
    }

    // ─── Submit (modal completo) ──────────────────────────────────────────────

    async function submitReport() {
        const db         = window.Utils?.getDb();
        const userId     = window.Utils?.userId();
        const modal      = document.getElementById("report-modal");
        const questionId = modal?.dataset.questionId;

        if (!db || !userId || !questionId) return;

        const details = document.getElementById("report-details")?.value?.trim();

        if (!details) { showError("Describe el problema en el campo de detalles."); return; }

        const submitBtn = document.getElementById("report-submit-btn");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Enviando..."; }

        try {
            const { error } = await db.from("reports").insert({
                question_id: questionId,
                user_id:     userId,
                reason:      "otro",
                details,
            });

            if (error) {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Enviar reporte"; }
                if (error.code === "23505") {
                    markAsReported(questionId);
                    showError("Ya has reportado esta pregunta anteriormente.");
                } else {
                    showError("Error al enviar el reporte. Inténtalo de nuevo.");
                    console.error("[Reports] insert error:", error);
                }
                return;
            }

            markAsReported(questionId);
            try { await db.rpc("increment_report_count", { p_question_id: questionId }); } catch (_) {}
            document.dispatchEvent(new CustomEvent("question-reported", { detail: { questionId } }));

            document.getElementById("report-form-body")?.classList.add("hidden");
            document.getElementById("report-success")?.classList.remove("hidden");
            setTimeout(closeModal, 2200);
        } catch (err) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Enviar reporte"; }
            showError("Error al enviar el reporte. Inténtalo de nuevo.");
            console.error("[Reports] unexpected error:", err);
        }
    }

    // ─── Confirmación rápida (+1) ─────────────────────────────────────────────

    async function confirmReport() {
        if (!window.Auth?.isLoggedIn()) {
            window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
            return;
        }

        const db     = window.Utils?.getDb();
        const userId = window.Utils?.userId();
        const q      = window.QuizAPI?.getCurrentQuestion();

        if (!db || !userId || !q?.id || !UUID_RE.test(q.id)) return;

        const btn = document.getElementById("report-warning-confirm");

        try {
            const { error } = await db.from("reports").insert({
                question_id: q.id,
                user_id:     userId,
                reason:      "respuesta_incorrecta",
                details:     "Confirmado por usuario adicional.",
            });

            if (error) {
                if (error.code === "23505") {
                    markAsReported(q.id);
                    if (btn) { btn.textContent = "Ya lo habías reportado"; btn.disabled = true; }
                } else {
                    console.error("[Reports] confirmReport error:", error);
                    if (btn) {
                        btn.textContent = "Error al reportar";
                        btn.disabled = true;
                        setTimeout(() => { btn.textContent = "Yo también veo un error"; btn.disabled = false; }, 2000);
                    }
                }
                return;
            }

            markAsReported(q.id);
            try { await db.rpc("increment_report_count", { p_question_id: q.id }); } catch (_) {}
            document.dispatchEvent(new CustomEvent("question-reported", { detail: { questionId: q.id } }));

            if (btn) { btn.textContent = "Gracias por confirmar"; btn.disabled = true; }
        } catch (err) {
            console.error("[Reports] confirmReport error:", err);
        }
    }

    // ─── Wiring ───────────────────────────────────────────────────────────────

    function init() {
        document.getElementById("report-btn")?.addEventListener("click", openModal);
        document.getElementById("report-overlay")?.addEventListener("click", closeModal);
        document.getElementById("report-close")?.addEventListener("click", closeModal);
        document.getElementById("report-submit-btn")?.addEventListener("click", submitReport);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !document.getElementById("report-modal")?.classList.contains("hidden")) {
                closeModal();
            }
        });

        // Cargar qué preguntas ya ha reportado el usuario en cuanto haya sesión.
        window.Auth?.onReady((user) => {
            if (user) loadUserReports(user.id);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.Reports = { open: openModal, close: closeModal, confirmReport, hasUserReported };
})();
