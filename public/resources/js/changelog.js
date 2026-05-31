(function () {
    "use strict";

    const REPO      = "informaticatestua/Informatica-Test-UA";
    const API_URL   = `https://api.github.com/repos/${REPO}/commits?per_page=20`;
    const LS_SEEN   = "changelog_seen_sha";
    const LS_CACHE  = "changelog_cache_data";
    const LS_TS     = "changelog_cache_ts";
    const TTL       = 60 * 60 * 1000; // 1 hora

    const $ = (id) => document.getElementById(id);

    // ── Fetch con caché ─────────────────────────────────────────────────

    async function fetchCommits() {
        const cached = localStorage.getItem(LS_CACHE);
        const ts     = parseInt(localStorage.getItem(LS_TS) || "0", 10);
        if (cached && Date.now() - ts < TTL) return JSON.parse(cached);

        const res = await fetch(API_URL, {
            headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
        const data = await res.json();
        localStorage.setItem(LS_CACHE, JSON.stringify(data));
        localStorage.setItem(LS_TS, String(Date.now()));
        return data;
    }

    // ── Badge ────────────────────────────────────────────────────────────

    function refreshBadge(commits) {
        if (!commits?.length) return;
        const latestSha = commits[0].sha;
        const seenSha   = localStorage.getItem(LS_SEEN);

        if (!seenSha) {
            // Primera visita: marcar como visto sin mostrar badge
            localStorage.setItem(LS_SEEN, latestSha);
            return;
        }
        const hasNew = latestSha !== seenSha;
        $("changelog-badge")?.classList.toggle("hidden", !hasNew);
    }

    // ── Renderizado de commits ───────────────────────────────────────────

    function formatDate(iso) {
        return new Date(iso).toLocaleDateString("es-ES", {
            day: "numeric", month: "short", year: "numeric",
        });
    }

    function parseMessage(raw) {
        const [firstLine, ...rest] = raw.trim().split("\n");
        const title = firstLine.trim();
        const body  = rest.join("\n").replace(/^\n+/, "").trim();
        return { title, body };
    }

    function esc(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function renderCommits(commits, oldSeenSha) {
        const container = $("changelog-list");
        if (!container) return;
        if (!commits?.length) {
            container.innerHTML = '<p class="text-text-muted text-sm text-center py-6">No hay actualizaciones disponibles.</p>';
            return;
        }

        let html        = "";
        let foundSeen   = (oldSeenSha === null);

        for (const c of commits) {
            if (c.sha === oldSeenSha) foundSeen = true;
            const isNew              = !foundSeen;
            const { title, body }    = parseMessage(c.commit.message);
            const date               = formatDate(c.commit.author.date);
            const sha                = c.sha.slice(0, 7);

            // Ignorar commits de merge o de CI que no aportan
            const lowerTitle = title.toLowerCase();
            const isTrivial  = lowerTitle.startsWith("merge ") || lowerTitle.startsWith("bump ");

            html += `
<div class="changelog-item${isNew ? " changelog-item--new" : ""}${isTrivial ? " changelog-item--trivial" : ""}">
  <div class="flex items-start justify-between gap-2 mb-1">
    <span class="font-semibold text-text-main text-sm leading-snug flex-1">${esc(title)}</span>
    ${isNew ? '<span class="changelog-new-badge">Nuevo</span>' : ""}
  </div>
  ${body ? `<p class="text-text-muted text-xs leading-relaxed mt-1 mb-0 whitespace-pre-line">${esc(body)}</p>` : ""}
  <div class="flex items-center gap-2 mt-2">
    <span class="text-text-muted text-[0.72rem]">${date}</span>
    <span class="text-border-subtle text-[0.72rem]">·</span>
    <a href="${c.html_url}" target="_blank" rel="noopener noreferrer"
       class="text-blue-500 hover:text-blue-600 text-[0.72rem] font-mono transition-colors">${sha}</a>
  </div>
</div>`;
        }

        container.innerHTML = html;
    }

    // ── Modal ────────────────────────────────────────────────────────────

    async function openModal() {
        $("changelog-modal")?.classList.remove("hidden");
        $("changelog-overlay")?.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");

        const loadingEl  = $("changelog-loading");
        const listEl     = $("changelog-list");
        const errorEl    = $("changelog-error");

        loadingEl?.classList.remove("hidden");
        if (listEl) listEl.innerHTML = "";
        errorEl?.classList.add("hidden");

        // Guardamos el SHA que tenía antes de abrir (para marcar "Nuevo")
        const oldSeenSha = localStorage.getItem(LS_SEEN);

        try {
            const commits = await fetchCommits();

            // Marcar como visto ahora
            if (commits?.length) {
                localStorage.setItem(LS_SEEN, commits[0].sha);
            }
            $("changelog-badge")?.classList.add("hidden");

            renderCommits(commits, oldSeenSha);
        } catch (e) {
            errorEl?.classList.remove("hidden");
            const msgEl = $("changelog-error-msg");
            if (msgEl) msgEl.textContent = e.message ?? "Error desconocido.";
        } finally {
            loadingEl?.classList.add("hidden");
        }
    }

    function closeModal() {
        $("changelog-modal")?.classList.add("hidden");
        $("changelog-overlay")?.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    // ── Init ─────────────────────────────────────────────────────────────

    function init() {
        $("changelog-btn")?.addEventListener("click", openModal);
        $("changelog-overlay")?.addEventListener("click", closeModal);
        $("changelog-close")?.addEventListener("click", closeModal);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !$("changelog-modal")?.classList.contains("hidden")) {
                closeModal();
            }
        });

        // Comprobación silenciosa del badge al cargar la página
        fetchCommits().then(refreshBadge).catch(() => {});
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
