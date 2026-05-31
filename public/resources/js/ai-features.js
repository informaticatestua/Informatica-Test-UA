/**
 * ai-features.js — Panel de configuración de IA y explicación de respuestas.
 *
 * Proveedores soportados: Google Gemini, Groq, Ollama (local).
 * Toda la configuración persiste en localStorage.
 * Se expone `window.AIFeatures` con dos métodos públicos:
 *   - openSettings()    → abre el modal de ajustes
 *   - showExplanation() → abre el drawer con la explicación de la pregunta activa
 */
(function () {
    "use strict";

    // ─────────────────────────────────────────────────────────────────────
    // 1. CONSTANTES
    // ─────────────────────────────────────────────────────────────────────

    const LS = Object.freeze({
        PROVIDER:        "ai_provider",
        GEMINI_KEY:      "ai_gemini_key",
        GEMINI_MODEL:    "ai_gemini_model",
        GROQ_KEY:        "ai_groq_key",
        GROQ_MODEL:      "ai_groq_model",
        DEEPSEEK_KEY:    "ai_deepseek_key",
        DEEPSEEK_MODEL:  "ai_deepseek_model",
    });

    const GEMINI_MODELS    = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-pro"];
    const GROQ_MODELS      = [
        "llama-3.3-70b-versatile",
        "deepseek-r1-distill-llama-70b",
        "llama-3.1-8b-instant",
    ];
    const DEEPSEEK_MODELS  = ["deepseek-chat", "deepseek-reasoner"];

    // ─────────────────────────────────────────────────────────────────────
    // 2. HELPERS DE STORAGE Y DOM
    // ─────────────────────────────────────────────────────────────────────

    const get  = (key, def = "") => localStorage.getItem(key) ?? def;
    const save = (key, val)      => localStorage.setItem(key, val);

    const $    = (id) => document.getElementById(id);
    const val  = (id) => ($( id)?.value?.trim() ?? "");
    const setV = (id, v) => { const el = $(id); if (el) el.value = v; };

    // ─────────────────────────────────────────────────────────────────────
    // 3. MODAL DE AJUSTES
    // ─────────────────────────────────────────────────────────────────────

    function openSettingsModal() {
        loadFormFromStorage();
        $("ai-settings-modal")?.classList.remove("hidden");
        $("ai-settings-overlay")?.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    }

    function closeSettingsModal() {
        $("ai-settings-modal")?.classList.add("hidden");
        $("ai-settings-overlay")?.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    function loadFormFromStorage() {
        const provider = get(LS.PROVIDER, "gemini");
        const radio = document.querySelector(`input[name="ai-provider"][value="${provider}"]`);
        if (radio) radio.checked = true;

        setV("ai-gemini-key",      get(LS.GEMINI_KEY));
        setV("ai-gemini-model",    get(LS.GEMINI_MODEL, "gemini-2.0-flash"));
        setV("ai-groq-key",        get(LS.GROQ_KEY));
        setV("ai-groq-model",      get(LS.GROQ_MODEL, "llama-3.3-70b-versatile"));
        setV("ai-deepseek-key",    get(LS.DEEPSEEK_KEY));
        setV("ai-deepseek-model",  get(LS.DEEPSEEK_MODEL, "deepseek-chat"));

        updateProviderSections();
    }

    function saveSettings() {
        const provider = document.querySelector('input[name="ai-provider"]:checked')?.value ?? "gemini";
        save(LS.PROVIDER,       provider);
        save(LS.GEMINI_KEY,     val("ai-gemini-key"));
        save(LS.GEMINI_MODEL,   val("ai-gemini-model")   || "gemini-2.0-flash");
        save(LS.GROQ_KEY,       val("ai-groq-key"));
        save(LS.GROQ_MODEL,     val("ai-groq-model")     || "llama-3.3-70b-versatile");
        save(LS.DEEPSEEK_KEY,   val("ai-deepseek-key"));
        save(LS.DEEPSEEK_MODEL, val("ai-deepseek-model") || "deepseek-chat");

        const btn = $("ai-settings-save");
        if (btn) {
            const orig = btn.textContent;
            btn.textContent = "¡Guardado!";
            setTimeout(() => { btn.textContent = orig; }, 1400);
        }

        syncDrawerSelects();
        closeSettingsModal();
    }

    function updateProviderSections() {
        const provider = document.querySelector('input[name="ai-provider"]:checked')?.value ?? "gemini";
        ["gemini", "groq", "deepseek"].forEach((p) => {
            $(`ai-${p}-config`)?.classList.toggle("hidden", p !== provider);
        });
    }

    function initSettingsModal() {
        $("ai-settings-btn")?.addEventListener("click", openSettingsModal);
        $("ai-settings-overlay")?.addEventListener("click", closeSettingsModal);
        $("ai-settings-close")?.addEventListener("click", closeSettingsModal);
        $("ai-settings-save")?.addEventListener("click", saveSettings);

        document.querySelectorAll('input[name="ai-provider"]').forEach((r) => {
            r.addEventListener("change", updateProviderSections);
        });

        // Cerrar con Escape
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !$("ai-settings-modal")?.classList.contains("hidden")) {
                closeSettingsModal();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. DRAWER DE EXPLICACIÓN
    // ─────────────────────────────────────────────────────────────────────

    let abortCtrl = null;

    function openDrawer() {
        const drawer = $("ai-drawer");
        if (!drawer) return;
        drawer.classList.add("ai-drawer--open");
        drawer.setAttribute("aria-hidden", "false");
        if (window.innerWidth < 640) document.body.classList.add("ai-drawer-body-lock");
    }

    function closeDrawer() {
        if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; }
        const drawer = $("ai-drawer");
        if (!drawer) return;
        drawer.classList.remove("ai-drawer--open");
        drawer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("ai-drawer-body-lock");
    }

    function syncDrawerSelects() {
        const provider = get(LS.PROVIDER, "gemini");
        const provSel = $("ai-drawer-provider");
        if (provSel) {
            provSel.value = provider;
            populateModelSelect(provider);
        }
    }

    function populateModelSelect(provider) {
        const modelSel = $("ai-drawer-model");
        if (!modelSel) return;
        modelSel.innerHTML = "";

        let models = [];
        let currentModel = "";

        if (provider === "gemini") {
            models = GEMINI_MODELS;
            currentModel = get(LS.GEMINI_MODEL, "gemini-2.0-flash");
        } else if (provider === "groq") {
            models = GROQ_MODELS;
            currentModel = get(LS.GROQ_MODEL, "llama-3.3-70b-versatile");
        } else {
            models = DEEPSEEK_MODELS;
            currentModel = get(LS.DEEPSEEK_MODEL, "deepseek-chat");
        }

        models.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            modelSel.appendChild(opt);
        });
        modelSel.value = currentModel;
    }

    function initDrawer() {
        $("ai-drawer-close")?.addEventListener("click", closeDrawer);
        $("ai-drawer-backdrop")?.addEventListener("click", closeDrawer);

        $("ai-drawer-provider")?.addEventListener("change", function () {
            populateModelSelect(this.value);
            // Auto-regenerar al cambiar proveedor
            if (!$("ai-drawer")?.classList.contains("ai-drawer--open")) return;
            requestExplanation();
        });

        $("ai-drawer-model")?.addEventListener("change", () => {
            if (!$("ai-drawer")?.classList.contains("ai-drawer--open")) return;
            requestExplanation();
        });

        $("ai-retry-btn")?.addEventListener("click", requestExplanation);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && $("ai-drawer")?.classList.contains("ai-drawer--open")) {
                closeDrawer();
            }
        });

        initDragToClose();
    }

    function initDragToClose() {
        const panel = $("ai-drawer-panel");
        if (!panel) return;
        let startY = 0;

        panel.addEventListener("touchstart", (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        panel.addEventListener("touchmove", (e) => {
            const dy = e.touches[0].clientY - startY;
            if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
        }, { passive: true });

        panel.addEventListener("touchend", (e) => {
            const dy = e.changedTouches[0].clientY - startY;
            panel.style.transform = "";
            if (dy > 80) closeDrawer();
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. DATOS DE LA PREGUNTA ACTIVA (leídos del DOM)
    // ─────────────────────────────────────────────────────────────────────

    function getQuestionData() {
        const pregunta = $("pregunta")?.innerText?.trim() ?? "";
        const labels = document.querySelectorAll("form#opciones label");
        const opciones = Array.from(labels).map((lbl) => ({
            text:      lbl.querySelector(".opcion-label")?.innerText?.trim() ?? "",
            isCorrect: lbl.classList.contains("correct"),
            isSelected: lbl.classList.contains("incorrect"),
        }));
        return { pregunta, opciones };
    }

    function renderQuestionSummary(data) {
        const container = $("ai-question-summary");
        if (!container) return;
        const letras = ["A", "B", "C", "D", "E", "F"];
        let html = `<p class="font-medium text-text-main mb-3 leading-snug">${esc(data.pregunta)}</p><ul class="space-y-1">`;

        data.opciones.forEach((op, i) => {
            let cls = "text-text-muted";
            let badge = "";
            if (op.isCorrect) {
                cls = "text-green-700 dark:text-green-400 font-medium";
                badge = ' <span class="text-[0.68rem] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded ml-1">✓ Correcta</span>';
            } else if (op.isSelected) {
                cls = "text-red-600 dark:text-red-400 line-through opacity-70";
                badge = ' <span class="text-[0.68rem] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded ml-1">✗</span>';
            }
            html += `<li class="flex items-start gap-1 ${cls}"><span class="font-bold shrink-0">${letras[i] ?? i + 1}.</span><span>${esc(op.text)}${badge}</span></li>`;
        });

        container.innerHTML = html + "</ul>";
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. LLAMADAS A LA IA
    // ─────────────────────────────────────────────────────────────────────

    function buildPrompt(data) {
        const letras = ["A", "B", "C", "D", "E", "F"];
        const correctas = data.opciones.filter((o) => o.isCorrect).map((o) => o.text).join(", ");
        let prompt = `Eres un tutor de informática universitaria. Responde en español.
Explica brevemente (máximo 180 palabras) por qué la respuesta correcta es correcta y por qué cada opción incorrecta es incorrecta. Sé directo y educativo; no repitas el enunciado.

PREGUNTA: ${data.pregunta}

OPCIONES:\n`;
        data.opciones.forEach((op, i) => {
            const marca = op.isCorrect ? "✓ CORRECTA" : "✗ INCORRECTA";
            prompt += `${letras[i] ?? i + 1}. [${marca}] ${op.text}\n`;
        });
        prompt += `\nRespuesta correcta: ${correctas}`;
        return prompt;
    }

    async function requestExplanation() {
        const provider  = $("ai-drawer-provider")?.value ?? get(LS.PROVIDER, "gemini");
        const model     = $("ai-drawer-model")?.value ?? "";
        const data      = getQuestionData();
        const prompt    = buildPrompt(data);

        const loadingEl = $("ai-loading");
        const errorEl   = $("ai-error");
        const textEl    = $("ai-text");
        const retryBtn  = $("ai-retry-btn");

        // Reiniciar estado visual
        loadingEl?.classList.remove("hidden");
        errorEl?.classList.add("hidden");
        retryBtn?.classList.add("hidden");
        if (textEl) { textEl.innerHTML = ""; textEl.setAttribute("data-raw", ""); }

        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();

        try {
            if (provider === "gemini") {
                await callGemini(prompt, model, textEl);
            } else if (provider === "groq") {
                await callGroq(prompt, model, textEl);
            } else {
                await callDeepSeek(prompt, model, textEl);
            }
        } catch (err) {
            if (err.name === "AbortError") return;
            loadingEl?.classList.add("hidden");
            errorEl?.classList.remove("hidden");
            const msgEl = $("ai-error-msg");
            if (msgEl) msgEl.textContent = err.message ?? "Error desconocido.";
            retryBtn?.classList.remove("hidden");
            return;
        }

        loadingEl?.classList.add("hidden");
    }

    // Añade texto al output de forma segura (XSS-safe + markdown mínimo)
    function appendText(el, chunk) {
        if (!el) return;
        const raw = (el.getAttribute("data-raw") ?? "") + chunk;
        el.setAttribute("data-raw", raw);
        el.innerHTML = miniMarkdown(raw);
    }

    function miniMarkdown(text) {
        let h = esc(text);
        h = h.replace(/\*\*(.*?)\*\*/gs, "<strong>$1</strong>");
        h = h.replace(/\*(.*?)\*/gs, "<em>$1</em>");
        h = h.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
        h = h.replace(/\n\n+/g, '</p><p class="mt-3">');
        h = h.replace(/\n/g, "<br>");
        return `<p>${h}</p>`;
    }

    function esc(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // ── Gemini (SSE streaming) ──────────────────────────────────────────

    async function callGemini(prompt, modelOverride, outputEl) {
        const apiKey = get(LS.GEMINI_KEY);
        if (!apiKey) throw new Error("No has configurado tu API Key de Google Gemini.");

        const model = modelOverride || get(LS.GEMINI_MODEL, "gemini-2.0-flash");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: abortCtrl.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `Gemini error ${res.status}`);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";
        let firstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                    const json = JSON.parse(data);
                    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                    if (text) {
                        if (firstChunk) { $("ai-loading")?.classList.add("hidden"); firstChunk = false; }
                        appendText(outputEl, text);
                    }
                } catch { /* ignorar líneas mal formadas */ }
            }
        }
    }

    // ── Groq (OpenAI-compatible SSE streaming) ──────────────────────────

    async function callGroq(prompt, modelOverride, outputEl) {
        const apiKey = get(LS.GROQ_KEY);
        if (!apiKey) throw new Error("No has configurado tu API Key de Groq.");

        const model = modelOverride || get(LS.GROQ_MODEL, "llama-3.3-70b-versatile");

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                stream: true,
                max_tokens: 600,
            }),
            signal: abortCtrl.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";
        let firstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                    const json = JSON.parse(data);
                    const text = json?.choices?.[0]?.delta?.content ?? "";
                    if (text) {
                        if (firstChunk) { $("ai-loading")?.classList.add("hidden"); firstChunk = false; }
                        appendText(outputEl, text);
                    }
                } catch { /* ignorar */ }
            }
        }
    }

    // ── DeepSeek (OpenAI-compatible SSE streaming) ─────────────────────

    async function callDeepSeek(prompt, modelOverride, outputEl) {
        const apiKey = get(LS.DEEPSEEK_KEY);
        if (!apiKey) throw new Error("No has configurado tu API Key de DeepSeek.");

        const model = modelOverride || get(LS.DEEPSEEK_MODEL, "deepseek-chat");

        const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                stream: true,
                max_tokens: 600,
            }),
            signal: abortCtrl.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `DeepSeek error ${res.status}`);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";
        let firstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                    const json = JSON.parse(data);
                    const text = json?.choices?.[0]?.delta?.content ?? "";
                    if (text) {
                        if (firstChunk) { $("ai-loading")?.classList.add("hidden"); firstChunk = false; }
                        appendText(outputEl, text);
                    }
                } catch { /* ignorar líneas mal formadas */ }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 7. PUNTO DE ENTRADA PÚBLICO
    // ─────────────────────────────────────────────────────────────────────

    function showExplanation() {
        if (!$("ai-drawer")) return;

        const provider = get(LS.PROVIDER, "gemini");
        const hasCredential =
            provider === "gemini"   ? get(LS.GEMINI_KEY) :
            provider === "groq"     ? get(LS.GROQ_KEY) :
            get(LS.DEEPSEEK_KEY);

        if (!hasCredential) {
            openSettingsModal();
            const msg = $("ai-settings-no-key-msg");
            if (msg) {
                msg.classList.remove("hidden");
                setTimeout(() => msg.classList.add("hidden"), 5000);
            }
            return;
        }

        const data = getQuestionData();
        renderQuestionSummary(data);
        syncDrawerSelects();

        $("ai-text")?.setAttribute("data-raw", "");
        if ($("ai-text")) $("ai-text").innerHTML = "";
        $("ai-error")?.classList.add("hidden");
        $("ai-loading")?.classList.add("hidden");
        $("ai-retry-btn")?.classList.add("hidden");

        openDrawer();
        requestExplanation();
    }

    function init() {
        initSettingsModal();
        initDrawer();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.AIFeatures = {
        openSettings:    openSettingsModal,
        showExplanation: showExplanation,
    };
})();
