/**
 * utils.js — Utilidades compartidas entre módulos.
 *
 * Expone window.Utils: getDb, userId, esc, lockBody, unlockBody, redirectToLogin, shorthand $.
 * Cargado PRIMERO en BaseLayout.astro antes de todos los demás módulos JS.
 */
(function () {
    "use strict";

    const getDb = () => window.SupabaseClient?.getClient();
    const userId = () => window.Auth?.getUser()?.id ?? null;

    // Escape HTML entities para evitar XSS
    const esc = (str) => {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // Body scroll lock para modales
    const lockBody = () => document.body.classList.add('overflow-hidden');
    const unlockBody = () => document.body.classList.remove('overflow-hidden');

    // Redirect a login con redirect param
    const redirectToLogin = () => {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    };

    // Shorthand DOM query
    const $ = (id) => document.getElementById(id);

    window.Utils = { getDb, userId, esc, lockBody, unlockBody, redirectToLogin, $ };
})();
