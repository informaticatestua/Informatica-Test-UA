/**
 * online-users.js — Contador en tiempo real de usuarios conectados.
 *
 * Usa Supabase Realtime Presence para rastrear sesiones activas.
 * Funciona para usuarios anónimos y autenticados por igual.
 * Cada pestaña del navegador cuenta como una sesión independiente.
 *
 * API (window.OnlineUsers):
 *   (ninguna — el módulo se auto-inicializa)
 */
(function () {
    "use strict";

    function getSessionKey() {
        let key = sessionStorage.getItem("_ou_session");
        if (!key) {
            key = Date.now().toString(36) + Math.random().toString(36).slice(2);
            sessionStorage.setItem("_ou_session", key);
        }
        return key;
    }

    function updateUI(count) {
        const wrapper  = document.getElementById("online-counter");
        const countEl  = document.getElementById("online-count");
        if (!wrapper || !countEl) return;

        const label = count === 1 ? "1 conectado" : `${count} conectados`;
        const prev  = countEl.textContent;

        if (prev !== label) {
            countEl.textContent = label;

            // Animación de "bump" al cambiar el número
            wrapper.classList.add("online-counter--bump");
            setTimeout(() => wrapper.classList.remove("online-counter--bump"), 300);
        }

        wrapper.classList.remove("hidden");
    }

    function init() {
        const db = window.SupabaseClient;
        if (!db) return;

        const sessionKey = getSessionKey();

        const channel = db.channel("online-users", {
            config: {
                presence: { key: sessionKey },
            },
        });

        channel.on("presence", { event: "sync" }, () => {
            const count = Object.keys(channel.presenceState()).length;
            updateUI(count);
        });

        channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                await channel.track({ at: Date.now() });
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                const wrapper = document.getElementById("online-counter");
                if (wrapper) wrapper.classList.add("hidden");
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.OnlineUsers = {};
})();
