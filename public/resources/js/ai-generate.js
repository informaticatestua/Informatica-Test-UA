/**
 * ai-generate.js — Generador de quiz con IA.
 * Usa el proveedor y credenciales guardados por ai-features.js.
 * Depende de window.QuizAPI (expuesto por main.js).
 */
(function () {
    "use strict";

    // ─────────────────────────────────────────────────────────────────────
    // 1. CONSTANTES
    // ─────────────────────────────────────────────────────────────────────

    const LS = Object.freeze({
        PROVIDER:       "ai_provider",
        GEMINI_KEY:     "ai_gemini_key",
        GEMINI_MODEL:   "ai_gemini_model",
        GROQ_KEY:       "ai_groq_key",
        GROQ_MODEL:     "ai_groq_model",
        DEEPSEEK_KEY:   "ai_deepseek_key",
        DEEPSEEK_MODEL: "ai_deepseek_model",
    });

    const PROVIDER_LABELS = { gemini: "Gemini", groq: "Groq", deepseek: "DeepSeek" };

    const get = (key, def = "") => localStorage.getItem(key) ?? def;
    const $   = (id) => document.getElementById(id);

    let currentAbort = null;

    // ─────────────────────────────────────────────────────────────────────
    // 2. MODAL
    // ─────────────────────────────────────────────────────────────────────

    function openModal() {
        $("aigen-modal")?.classList.remove("hidden");
        $("aigen-overlay")?.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
        resetToConfig();
        syncProviderBadge();
        updateSliderDisplay(parseInt($("aigen-slider")?.value ?? "20", 10));
    }

    function closeModal() {
        if (currentAbort) { currentAbort.abort(); currentAbort = null; }
        $("aigen-modal")?.classList.add("hidden");
        $("aigen-overlay")?.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    function show(id) { $(id)?.classList.remove("hidden"); }
    function hide(id) { $(id)?.classList.add("hidden"); }

    function resetToConfig() {
        show("aigen-config");
        hide("aigen-generating");
        hide("aigen-success");
        hide("aigen-error-box");
    }

    function syncProviderBadge() {
        const provider = get(LS.PROVIDER, "gemini");
        const el = $("aigen-provider-label");
        if (el) el.textContent = PROVIDER_LABELS[provider] ?? provider;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. SLIDER
    // ─────────────────────────────────────────────────────────────────────

    function updateSliderDisplay(n) {
        const countEl = $("aigen-count");
        if (countEl) countEl.textContent = n;

        const labelEl = $("aigen-range-label");
        if (labelEl) {
            if (n <= 25)       { labelEl.textContent = "Rápido"; labelEl.className = "aigen-range-badge aigen-range-badge--fast"; }
            else if (n <= 80)  { labelEl.textContent = "Estándar"; labelEl.className = "aigen-range-badge aigen-range-badge--std"; }
            else               { labelEl.textContent = "Extenso"; labelEl.className = "aigen-range-badge aigen-range-badge--large"; }
        }

        const warningEl = $("aigen-token-warning");
        if (warningEl) warningEl.classList.toggle("hidden", n <= 80);

        // Relleno visual de la pista del slider
        const slider = $("aigen-slider");
        if (slider) {
            const pct = ((n - 5) / (200 - 5)) * 100;
            slider.style.setProperty("--aigen-fill", `${pct.toFixed(1)}%`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. CONSTRUCCIÓN DEL PROMPT
    // ─────────────────────────────────────────────────────────────────────

    function buildPrompt(numQuestions) {
        const preguntas = window.QuizAPI?.getPreguntas() ?? [];

        // Muestra aleatoria: menos ejemplos cuanto más preguntas pedimos (ahorro de tokens)
        const sampleSize = numQuestions <= 30 ? 30 : numQuestions <= 80 ? 20 : 15;
        const sample = shuffleCopy(preguntas).slice(0, sampleSize);

        const examples = sample.map((p, i) => {
            const opts = p.opciones.map((o, j) => `  ${j + 1}. ${o}`).join("\n");
            const correct = p.respuestas.map((r) => p.opciones[r - 1]).join(", ");
            return `Pregunta ${i + 1}: ${p.pregunta}\n${opts}\n  Respuesta correcta: ${correct}`;
        }).join("\n\n");

        return `Eres un generador experto de preguntas de examen universitario de ingeniería informática. Tu tarea es crear preguntas de test nuevas con el mismo nivel académico, estilo y temario que los ejemplos que se muestran a continuación.

REGLAS ESTRICTAS:
1. Genera EXACTAMENTE ${numQuestions} preguntas nuevas y distintas a los ejemplos.
2. Cada pregunta tiene EXACTAMENTE 4 opciones de respuesta.
3. Exactamente UNA opción es la correcta.
4. Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, sin bloques markdown.
5. Formato obligatorio:
[{"pregunta":"enunciado completo","opciones":["opción A","opción B","opción C","opción D"],"respuesta":2}]
   donde "respuesta" es el índice 1-based de la opción correcta.

EJEMPLOS DE PREGUNTAS EXISTENTES (para entender el estilo y el temario):

${examples}

Genera ahora exactamente ${numQuestions} preguntas nuevas en el formato JSON indicado:`;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. GENERACIÓN
    // ─────────────────────────────────────────────────────────────────────

    async function generate() {
        const slider = $("aigen-slider");
        const numQuestions = parseInt(slider?.value ?? "20", 10);

        const provider = get(LS.PROVIDER, "gemini");
        const keyByProvider = {
            gemini:   get(LS.GEMINI_KEY),
            groq:     get(LS.GROQ_KEY),
            deepseek: get(LS.DEEPSEEK_KEY),
        };

        if (!keyByProvider[provider]) {
            showError(
                'No tienes configurada una API Key. Abre la configuración de IA (icono ✨ en la barra superior) y añade tu clave.',
            );
            return;
        }

        if (!window.QuizAPI) {
            showError("El motor del quiz no está disponible. Recarga la página.");
            return;
        }

        const preguntas = window.QuizAPI.getPreguntas();
        if (!preguntas.length) {
            showError("No hay preguntas cargadas en esta asignatura.");
            return;
        }

        hide("aigen-config");
        hide("aigen-error-box");
        show("aigen-generating");

        const progressEl = $("aigen-progress-text");
        if (progressEl) progressEl.textContent = "Conectando con la IA…";

        if (currentAbort) currentAbort.abort();
        currentAbort = new AbortController();

        let fullText = "";

        try {
            const prompt = buildPrompt(numQuestions);

            if (provider === "gemini") {
                fullText = await callGemini(prompt, get(LS.GEMINI_MODEL, "gemini-2.0-flash"), progressEl);
            } else if (provider === "groq") {
                fullText = await callGroq(prompt, get(LS.GROQ_MODEL, "llama-3.3-70b-versatile"), progressEl);
            } else {
                fullText = await callDeepSeek(prompt, get(LS.DEEPSEEK_MODEL, "deepseek-chat"), progressEl);
            }

            if (progressEl) progressEl.textContent = "Procesando respuesta…";

            const parsed     = parseAIResponse(fullText);
            const converted  = convertToQuizFormat(parsed);

            if (!converted.length) throw new Error("La IA no devolvió preguntas válidas. Inténtalo de nuevo.");

            hide("aigen-generating");
            show("aigen-success");

            const successCountEl = $("aigen-success-count");
            if (successCountEl) successCountEl.textContent = converted.length;

            window._aigenPendingQuestions = converted;

        } catch (err) {
            if (err.name === "AbortError") {
                resetToConfig();
                return;
            }
            hide("aigen-generating");
            show("aigen-config");
            showError(err.message ?? "Error desconocido.");
        }
    }

    function showError(msg) {
        show("aigen-error-box");
        const el = $("aigen-error-msg");
        if (el) el.textContent = msg;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. PARSEO DE LA RESPUESTA
    // ─────────────────────────────────────────────────────────────────────

    function parseAIResponse(raw) {
        let text = raw.trim();

        // Quitar bloques de código markdown (```json ... ```)
        const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (mdMatch) text = mdMatch[1].trim();

        // Extraer el primer array JSON bien formado
        const start = text.indexOf("[");
        const end   = text.lastIndexOf("]");
        if (start === -1 || end === -1 || end < start) {
            throw new Error("La IA no devolvió un array JSON válido. Prueba con menos preguntas o cambia el modelo.");
        }

        try {
            return JSON.parse(text.slice(start, end + 1));
        } catch {
            throw new Error("Error al parsear el JSON devuelto por la IA. Intenta de nuevo o usa un modelo más capaz.");
        }
    }

    function convertToQuizFormat(aiQuestions) {
        const valid = [];

        for (const q of aiQuestions) {
            if (
                typeof q.pregunta !== "string" ||
                !Array.isArray(q.opciones) ||
                q.opciones.length < 2 ||
                typeof q.respuesta !== "number"
            ) continue;

            const correctIdx = q.respuesta - 1;
            if (correctIdx < 0 || correctIdx >= q.opciones.length) continue;

            // Barajamos las opciones (igual que parsePreguntasTxt)
            const correctText = q.opciones[correctIdx];
            const shuffled    = shuffleCopy(q.opciones);
            const newIdx      = shuffled.indexOf(correctText) + 1;

            valid.push({
                pregunta:  q.pregunta,
                opciones:  shuffled,
                respuestas: [newIdx],
                multiple:  false,
                esGenerada: true,
            });
        }

        return valid;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 7. LLAMADAS A LA IA (streaming acumulado)
    // ─────────────────────────────────────────────────────────────────────

    async function callGemini(prompt, model, progressEl) {
        const apiKey = get(LS.GEMINI_KEY);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 8192 },
            }),
            signal: currentAbort.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `Gemini error ${res.status}`);
        }

        return consumeSSE(res, (json) => json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "", progressEl);
    }

    async function callGroq(prompt, model, progressEl) {
        const apiKey = get(LS.GROQ_KEY);
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                stream: true,
                max_tokens: 8192,
            }),
            signal: currentAbort.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
        }

        return consumeSSE(res, (json) => json?.choices?.[0]?.delta?.content ?? "", progressEl);
    }

    async function callDeepSeek(prompt, model, progressEl) {
        const apiKey = get(LS.DEEPSEEK_KEY);
        const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                stream: true,
                max_tokens: 8192,
            }),
            signal: currentAbort.signal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message ?? `DeepSeek error ${res.status}`);
        }

        return consumeSSE(res, (json) => json?.choices?.[0]?.delta?.content ?? "", progressEl);
    }

    async function consumeSSE(res, extractor, progressEl) {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = "";
        let full      = "";
        let charCount = 0;

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
                    if (text) {
                        full += text;
                        charCount += text.length;
                        if (progressEl) {
                            progressEl.textContent = `Generando… ${charCount.toLocaleString("es-ES")} caracteres recibidos`;
                        }
                    }
                } catch { /* ignorar líneas mal formadas */ }
            }
        }

        return full;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 8. UTILIDADES
    // ─────────────────────────────────────────────────────────────────────

    function shuffleCopy(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 9. INICIALIZACIÓN
    // ─────────────────────────────────────────────────────────────────────

    function init() {
        const openBtn = $("aigen-open-btn");
        if (!openBtn) return; // no estamos en una página de asignatura

        openBtn.addEventListener("click", openModal);
        $("aigen-overlay")?.addEventListener("click", closeModal);
        $("aigen-close")?.addEventListener("click", closeModal);

        const slider = $("aigen-slider");
        if (slider) {
            slider.addEventListener("input", function () {
                updateSliderDisplay(parseInt(this.value, 10));
            });
        }

        $("aigen-generate-btn")?.addEventListener("click", generate);

        $("aigen-cancel-btn")?.addEventListener("click", () => {
            if (currentAbort) { currentAbort.abort(); currentAbort = null; }
            resetToConfig();
        });

        $("aigen-start-btn")?.addEventListener("click", () => {
            const questions = window._aigenPendingQuestions;
            if (!questions?.length) return;
            if (window.QuizAPI?.injectGeneratedQuestions) {
                window.QuizAPI.injectGeneratedQuestions(questions);
            }
            closeModal();
            window._aigenPendingQuestions = null;
        });

        $("aigen-regenerate-btn")?.addEventListener("click", () => {
            window._aigenPendingQuestions = null;
            hide("aigen-success");
            hide("aigen-error-box");
            show("aigen-config");
        });

        $("aigen-config-link")?.addEventListener("click", (e) => {
            e.preventDefault();
            closeModal();
            window.AIFeatures?.openSettings();
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !$("aigen-modal")?.classList.contains("hidden")) {
                closeModal();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
