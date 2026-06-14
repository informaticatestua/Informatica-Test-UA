/**
 * ai-features.js — Panel de configuración de IA y explicación de respuestas.
 *
 * Proveedores soportados: Google Gemini, Groq.
 * Las API keys se leen desde Supabase (encriptadas) al iniciar sesión.
 * Las preferencias de proveedor/modelo persisten en localStorage.
 */
(function () {
    "use strict";

    // ─────────────────────────────────────────────────────────────────────
    // 1. CONSTANTES
    // ─────────────────────────────────────────────────────────────────────

    const LS = Object.freeze({
        PROVIDER:     "ai_provider",
        GEMINI_MODEL: "ai_gemini_model",
        GROQ_MODEL:   "ai_groq_model",
    });

    const DEFAULT_INSTRUCTIONS =
        "Eres un tutor de informática universitaria. Responde en español.\n" +
        "Explica brevemente (máximo 180 palabras) por qué la respuesta correcta es correcta " +
        "y por qué cada opción incorrecta es incorrecta. Sé directo y educativo; no repitas el enunciado.";

    const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-pro"];
    const GROQ_MODELS   = [
        "llama-3.3-70b-versatile",
        "deepseek-r1-distill-llama-70b",
        "llama-3.1-8b-instant",
    ];

    const LETTERS    = ["A", "B", "C", "D", "E", "F"];
    const MAX_TOKENS = 600;

    // ─────────────────────────────────────────────────────────────────────
    // 2. ESTADO EN MEMORIA
    // ─────────────────────────────────────────────────────────────────────

    // API keys cargadas desde Supabase al iniciar sesión. Nunca van a localStorage.
    const _keys = { gemini: "", groq: "" };

    async function loadApiKeys() {
        const db = window.Utils?.getDb();
        if (!db) return;
        try {
            const [{ data: gemini }, { data: groq }] = await Promise.all([
                db.rpc("get_api_key", { p_provider: "gemini" }),
                db.rpc("get_api_key", { p_provider: "groq" }),
            ]);
            _keys.gemini = gemini ?? "";
            _keys.groq   = groq   ?? "";
        } catch (e) {
            console.error("[AIFeatures] loadApiKeys:", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. HELPERS DE STORAGE Y DOM
    // ─────────────────────────────────────────────────────────────────────

    const getPref  = (key, def = "") => localStorage.getItem(key) ?? def;
    const savePref = (key, val)     => localStorage.setItem(key, val);

    function persistProviderModel(provider, model) {
        const userId = window.Auth?.getUser()?.id;
        const db     = window.Utils?.getDb();
        if (!userId || !db) return;
        const update = { ai_provider: provider };
        if (model) update[provider === "gemini" ? "ai_gemini_model" : "ai_groq_model"] = model;
        db.from("profiles").update(update).eq("id", userId);
    }

    const $    = (id) => document.getElementById(id);
    const val  = (id) => ($( id)?.value?.trim() ?? "");
    const setV = (id, v) => { const el = $(id); if (el) el.value = v; };

    // ─────────────────────────────────────────────────────────────────────
    // 4. MODAL DE AJUSTES
    // ─────────────────────────────────────────────────────────────────────

    function openSettingsModal() {
        loadFormFromPrefs();
        $("ai-settings-modal")?.classList.remove("hidden");
        $("ai-settings-overlay")?.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    }

    function closeSettingsModal() {
        $("ai-settings-modal")?.classList.add("hidden");
        $("ai-settings-overlay")?.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    function loadFormFromPrefs() {
        const provider = getPref(LS.PROVIDER, "gemini");
        const radio = document.querySelector(`input[name="ai-provider"][value="${provider}"]`);
        if (radio) radio.checked = true;

        setV("ai-gemini-model", getPref(LS.GEMINI_MODEL, "gemini-2.0-flash"));
        setV("ai-groq-model",   getPref(LS.GROQ_MODEL,   "llama-3.3-70b-versatile"));

        updateProviderSections();
    }

    function saveSettings() {
        const provider    = document.querySelector('input[name="ai-provider"]:checked')?.value ?? "gemini";
        const geminiModel = val("ai-gemini-model") || "gemini-2.0-flash";
        const groqModel   = val("ai-groq-model")   || "llama-3.3-70b-versatile";

        savePref(LS.PROVIDER,     provider);
        savePref(LS.GEMINI_MODEL, geminiModel);
        savePref(LS.GROQ_MODEL,   groqModel);

        // Persistir preferencias en Supabase
        const userId = window.Auth?.getUser()?.id;
        const db     = window.Utils?.getDb();
        if (userId && db) {
            db.from("profiles").update({
                ai_provider:     provider,
                ai_gemini_model: geminiModel,
                ai_groq_model:   groqModel,
            }).eq("id", userId);
        }

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
        ["gemini", "groq"].forEach((p) => {
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

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !$("ai-settings-modal")?.classList.contains("hidden")) {
                closeSettingsModal();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. DRAWER DE EXPLICACIÓN
    // ─────────────────────────────────────────────────────────────────────

    let abortCtrl     = null;
    let chatAbortCtrl = null;
    let chatHistory   = [];

    function openDrawer() {
        const drawer = $("ai-drawer");
        if (!drawer) return;
        drawer.classList.add("ai-drawer--open");
        drawer.setAttribute("aria-hidden", "false");
        if (window.innerWidth < 640) document.body.classList.add("ai-drawer-body-lock");
    }

    function closeDrawer() {
        if (abortCtrl)     { abortCtrl.abort();     abortCtrl     = null; }
        if (chatAbortCtrl) { chatAbortCtrl.abort();  chatAbortCtrl = null; }
        const drawer = $("ai-drawer");
        if (!drawer) return;
        drawer.classList.remove("ai-drawer--open");
        drawer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("ai-drawer-body-lock");
    }

    function syncDrawerSelects() {
        const provider = getPref(LS.PROVIDER, "gemini");
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

        const models      = provider === "gemini" ? GEMINI_MODELS : GROQ_MODELS;
        const currentModel = provider === "gemini"
            ? getPref(LS.GEMINI_MODEL, "gemini-2.0-flash")
            : getPref(LS.GROQ_MODEL,   "llama-3.3-70b-versatile");

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
            const provider = this.value;
            savePref(LS.PROVIDER, provider);
            persistProviderModel(provider, null);
            populateModelSelect(provider);
            if (!$("ai-drawer")?.classList.contains("ai-drawer--open")) return;
            requestExplanation();
        });

        $("ai-drawer-model")?.addEventListener("change", function () {
            const provider = $("ai-drawer-provider")?.value ?? getPref(LS.PROVIDER, "gemini");
            const model    = this.value;
            savePref(provider === "gemini" ? LS.GEMINI_MODEL : LS.GROQ_MODEL, model);
            persistProviderModel(provider, model);
            if (!$("ai-drawer")?.classList.contains("ai-drawer--open")) return;
            requestExplanation();
        });

        $("ai-retry-btn")?.addEventListener("click", requestExplanation);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && $("ai-drawer")?.classList.contains("ai-drawer--open")) {
                closeDrawer();
            }
        });

        $("ai-chat-send")?.addEventListener("click", sendFollowUp);
        $("ai-chat-input")?.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendFollowUp();
            }
        });
        $("ai-chat-input")?.addEventListener("input", function () {
            this.style.height = "auto";
            this.style.height = Math.min(this.scrollHeight, 120) + "px";
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
    // 6. DATOS DE LA PREGUNTA ACTIVA (leídos del DOM)
    // ─────────────────────────────────────────────────────────────────────

    function getQuestionData() {
        const pregunta = $("pregunta")?.innerText?.trim() ?? "";
        const labels = document.querySelectorAll("form#opciones label");
        const opciones = Array.from(labels).map((lbl) => ({
            text:       lbl.querySelector(".opcion-label")?.innerText?.trim() ?? "",
            isCorrect:  lbl.classList.contains("correct"),
            isSelected: lbl.classList.contains("incorrect"),
        }));
        return { pregunta, opciones };
    }

    function renderQuestionSummary(data) {
        const container = $("ai-question-summary");
        if (!container) return;
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
            html += `<li class="flex items-start gap-1 ${cls}"><span class="font-bold shrink-0">${LETTERS[i] ?? i + 1}.</span><span>${esc(op.text)}${badge}</span></li>`;
        });

        container.innerHTML = html + "</ul>";
    }

    // ─────────────────────────────────────────────────────────────────────
    // 7. LLAMADAS A LA IA
    // ─────────────────────────────────────────────────────────────────────

    function buildPrompt(data) {
        const correctas = data.opciones.filter((o) => o.isCorrect).map((o) => o.text).join(", ");
        const customInstructions = (window.Auth?.getProfile()?.ai_custom_instructions ?? "").trim();
        const instructions = customInstructions || DEFAULT_INSTRUCTIONS;

        let prompt = `${instructions}\n\nPREGUNTA: ${data.pregunta}\n\nOPCIONES:\n`;
        data.opciones.forEach((op, i) => {
            const marca = op.isCorrect ? "✓ CORRECTA" : "✗ INCORRECTA";
            prompt += `${LETTERS[i] ?? i + 1}. [${marca}] ${op.text}\n`;
        });
        prompt += `\nRespuesta correcta: ${correctas}`;
        return prompt;
    }

    async function requestExplanation() {
        const provider  = $("ai-drawer-provider")?.value ?? getPref(LS.PROVIDER, "gemini");
        const model     = $("ai-drawer-model")?.value ?? "";
        const data      = getQuestionData();
        const prompt    = buildPrompt(data);

        const loadingEl = $("ai-loading");
        const errorEl   = $("ai-error");
        const textEl    = $("ai-text");
        const retryBtn  = $("ai-retry-btn");

        resetChat();

        loadingEl?.classList.remove("hidden");
        errorEl?.classList.add("hidden");
        retryBtn?.classList.add("hidden");
        if (textEl) { textEl.innerHTML = ""; textEl.setAttribute("data-raw", ""); }

        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();

        try {
            if (provider === "gemini") {
                await callGemini(prompt, model, textEl);
            } else {
                await callGroq(prompt, model, textEl);
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
        showChatSection();
    }

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

    // ── SSE Streaming utility ───────────────────────────────────────────

    async function consumeSSE(res, extractTextFn, outputEl) {
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
                    const text = extractTextFn(json);
                    if (text) {
                        if (firstChunk) { $("ai-loading")?.classList.add("hidden"); firstChunk = false; }
                        appendText(outputEl, text);
                    }
                } catch { /* ignorar líneas mal formadas */ }
            }
        }
    }

    // ── Gemini (SSE streaming) ──────────────────────────────────────────

    async function callGemini(prompt, modelOverride, outputEl) {
        const apiKey = _keys.gemini;
        if (!apiKey) throw new Error("No has configurado tu API Key de Google Gemini en Ajustes de perfil.");

        const model = modelOverride || getPref(LS.GEMINI_MODEL, "gemini-2.0-flash");
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

        await consumeSSE(res, (json) => json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "", outputEl);
    }

    // ── Groq (OpenAI-compatible SSE streaming) ──────────────────────────

    async function callGroq(prompt, modelOverride, outputEl) {
        const apiKey = _keys.groq;
        if (!apiKey) throw new Error("No has configurado tu API Key de Groq en Ajustes de perfil.");

        const model = modelOverride || getPref(LS.GROQ_MODEL, "llama-3.3-70b-versatile");

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
                max_tokens: MAX_TOKENS,
            }),
            signal: abortCtrl.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
        }

        await consumeSSE(res, (json) => json?.choices?.[0]?.delta?.content ?? "", outputEl);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 8. CHAT DE SEGUIMIENTO
    // ─────────────────────────────────────────────────────────────────────

    function resetChat() {
        chatHistory = [];
        const historyEl = $("ai-chat-history");
        if (historyEl) historyEl.innerHTML = "";
        $("ai-chat-section")?.classList.add("hidden");
        const input = $("ai-chat-input");
        if (input) { input.value = ""; input.style.height = ""; }
    }

    function showChatSection() {
        $("ai-chat-section")?.classList.remove("hidden");
    }

    function appendChatBubble(role, isLoading) {
        const historyEl = $("ai-chat-history");
        if (!historyEl) return null;

        const wrap  = document.createElement("div");
        wrap.className = role === "user" ? "flex justify-end" : "flex justify-start";

        const inner = document.createElement("div");
        inner.className = role === "user" ? "ai-chat-bubble-user" : "ai-chat-bubble-ai";
        inner.setAttribute("data-raw", "");

        if (isLoading) {
            inner.innerHTML = '<div class="ai-spinner" style="width:14px;height:14px;border-width:2px;margin:2px 0;"></div>';
        }

        wrap.appendChild(inner);
        historyEl.appendChild(wrap);
        wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return inner;
    }

    function buildChatMessages(userMessage, questionData, provider) {
        const ctxOpts = questionData.opciones.map((o, i) => {
            const marca = o.isCorrect ? "✓ CORRECTA" : "✗ INCORRECTA";
            return `${LETTERS[i] ?? i + 1}. [${marca}] ${o.text}`;
        }).join("\n");

        const systemContent =
            `Eres un tutor de informática universitaria. El estudiante ha respondido una pregunta y recibido una explicación. Continúa ayudándole con sus dudas. Responde en español, de forma concisa (máximo 200 palabras).\n\n` +
            `PREGUNTA: ${questionData.pregunta}\nOPCIONES:\n${ctxOpts}\n\n` +
            `EXPLICACIÓN INICIAL:\n${$("ai-text")?.getAttribute("data-raw") ?? ""}`;

        if (provider === "gemini") {
            return [
                { role: "user",  content: systemContent },
                { role: "model", content: "Entendido, estoy listo para resolver tus dudas sobre esta pregunta." },
                ...chatHistory.map((m) => ({ role: m.role === "assistant" ? "model" : "user", content: m.content })),
                { role: "user",  content: userMessage },
            ];
        }

        return [
            { role: "system", content: systemContent },
            ...chatHistory,
            { role: "user",   content: userMessage },
        ];
    }

    async function sendFollowUp() {
        const input   = $("ai-chat-input");
        const sendBtn = $("ai-chat-send");
        const userMsg = input?.value.trim();
        if (!userMsg) return;

        appendChatBubble("user", false).innerHTML = esc(userMsg);
        input.value = "";
        input.style.height = "";
        sendBtn.disabled = true;

        const aiBubble = appendChatBubble("assistant", true);

        const provider = $("ai-drawer-provider")?.value ?? getPref(LS.PROVIDER, "gemini");
        const model    = $("ai-drawer-model")?.value ?? "";
        const qData    = getQuestionData();
        const messages = buildChatMessages(userMsg, qData, provider);

        if (chatAbortCtrl) chatAbortCtrl.abort();
        chatAbortCtrl = new AbortController();

        let fullText   = "";
        let firstChunk = true;

        const onChunk = (chunk) => {
            if (firstChunk) { aiBubble.innerHTML = ""; firstChunk = false; }
            fullText += chunk;
            aiBubble.setAttribute("data-raw", fullText);
            aiBubble.innerHTML = miniMarkdown(fullText);
            aiBubble.scrollIntoView({ behavior: "smooth", block: "nearest" });
        };

        try {
            if (provider === "gemini") await callGeminiChat(messages, model, onChunk);
            else                       await callGroqChat(messages, model, onChunk);

            chatHistory.push({ role: "user",      content: userMsg  });
            chatHistory.push({ role: "assistant", content: fullText });
        } catch (err) {
            if (err.name === "AbortError") return;
            if (aiBubble) aiBubble.innerHTML = `<span style="color:#f87171;">Error: ${esc(err.message ?? "Error desconocido.")}</span>`;
        } finally {
            sendBtn.disabled = false;
            input.focus();
        }
    }

    async function consumeSSEChat(res, extractor, onChunk) {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";

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
                    const text = extractor(json);
                    if (text) onChunk(text);
                } catch { /* ignorar */ }
            }
        }
    }

    async function callGeminiChat(messages, modelOverride, onChunk) {
        const apiKey = _keys.gemini;
        if (!apiKey) throw new Error("No has configurado tu API Key de Google Gemini en Ajustes de perfil.");
        const model = modelOverride || getPref(LS.GEMINI_MODEL, "gemini-2.0-flash");
        const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: messages }),
            signal: chatAbortCtrl.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `Gemini error ${res.status}`);
        }

        await consumeSSEChat(res, (json) => json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "", onChunk);
    }

    async function callGroqChat(messages, modelOverride, onChunk) {
        const apiKey = _keys.groq;
        if (!apiKey) throw new Error("No has configurado tu API Key de Groq en Ajustes de perfil.");
        const model  = modelOverride || getPref(LS.GROQ_MODEL, "llama-3.3-70b-versatile");

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages, stream: true, max_tokens: MAX_TOKENS }),
            signal: chatAbortCtrl.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
        }

        await consumeSSEChat(res, (json) => json?.choices?.[0]?.delta?.content ?? "", onChunk);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 9. PUNTO DE ENTRADA PÚBLICO
    // ─────────────────────────────────────────────────────────────────────

    function showExplanation() {
        if (!$("ai-drawer")) return;

        const provider = getPref(LS.PROVIDER, "gemini");
        const hasCredential = provider === "gemini" ? _keys.gemini : _keys.groq;

        if (!hasCredential) {
            openSettingsModal();
            const msg = $("ai-settings-no-key-msg");
            if (msg) {
                msg.classList.remove("hidden");
                setTimeout(() => msg.classList.add("hidden"), 6000);
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
        // Limpiar claves antiguas del localStorage (ya no se usan)
        ["ai_gemini_key", "ai_groq_key", "ai_deepseek_key", "ai_deepseek_model"].forEach(
            (k) => localStorage.removeItem(k)
        );

        initSettingsModal();
        initDrawer();
        $("explicar-ia-btn")?.addEventListener("click", showExplanation);

        // Cargar las API keys desde Supabase cuando el usuario esté autenticado
        window.Auth?.onReady((user) => {
            if (user) loadApiKeys();
        });
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
