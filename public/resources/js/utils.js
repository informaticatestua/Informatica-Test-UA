/**
 * utils.js — Utilidades compartidas entre módulos.
 *
 * Expone window.Utils: getDb, userId, esc, lockBody, unlockBody, redirectToLogin, shorthand $.
 * Además activa, de forma transversal, la accesibilidad de diálogos (foco, trampa de Tab,
 * restauración de foco) para [role="dialog"], .ai-drawer y .tools-sheet.
 * Cargado PRIMERO en BaseLayout.astro antes de todos los demás módulos JS.
 */
(function () {
    "use strict";

    const getDb = () => window.SupabaseClient;
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

    // ─── Accesibilidad de diálogos (foco + trampa de Tab + restaurar foco) ─────
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusables = (root) =>
        [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Cada tipo de panel declara cuándo está "abierto"
    const DIALOG_SELECTOR = '[role="dialog"], .ai-drawer, .tools-sheet';
    const isOpen = (el) => {
        if (el.classList.contains('ai-drawer')) return el.classList.contains('ai-drawer--open');
        if (el.classList.contains('tools-sheet')) return el.classList.contains('tools-sheet--open');
        return !el.classList.contains('hidden');
    };

    function initDialogA11y() {
        const lastFocus = new WeakMap();
        const wasOpen = new WeakMap();

        const sync = (el) => {
            const open = isOpen(el);
            if (open === !!wasOpen.get(el)) return;
            wasOpen.set(el, open);
            if (open) {
                lastFocus.set(el, document.activeElement);
                if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
                if (!el.hasAttribute('aria-modal')) el.setAttribute('aria-modal', 'true');
                // Espera a que el módulo propietario haya colocado su propio foco
                setTimeout(() => {
                    if (el.contains(document.activeElement) && document.activeElement !== el) return;
                    const target = el.querySelector('[autofocus]') || focusables(el)[0];
                    if (target) target.focus({ preventScroll: true });
                }, 40);
            } else {
                const back = lastFocus.get(el);
                if (back && document.contains(back) && typeof back.focus === 'function') {
                    back.focus({ preventScroll: true });
                }
            }
        };

        const observer = new MutationObserver((records) => {
            for (const r of records) {
                const el = r.target.closest ? r.target.closest(DIALOG_SELECTOR) : null;
                if (el) sync(el);
            }
        });
        const watch = () => {
            document.querySelectorAll(DIALOG_SELECTOR).forEach((el) => {
                observer.observe(el, { attributes: true, attributeFilter: ['class'] });
                sync(el);
            });
        };
        watch();

        // Paneles creados dinámicamente (p. ej. el drawer de IA se inyecta desde JS)
        new MutationObserver((records) => {
            for (const r of records) {
                r.addedNodes.forEach((n) => {
                    if (n.nodeType !== 1) return;
                    const found = n.matches?.(DIALOG_SELECTOR) ? [n] : [...n.querySelectorAll?.(DIALOG_SELECTOR) ?? []];
                    found.forEach((el) => {
                        observer.observe(el, { attributes: true, attributeFilter: ['class'] });
                        sync(el);
                    });
                });
            }
        }).observe(document.body, { childList: true, subtree: true });

        // Trampa de Tab dentro del diálogo abierto más reciente
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const open = [...document.querySelectorAll(DIALOG_SELECTOR)].filter(isOpen).pop();
            if (!open) return;
            const items = focusables(open);
            if (!items.length) { e.preventDefault(); return; }
            const first = items[0];
            const last = items[items.length - 1];
            if (!open.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDialogA11y);
    } else {
        initDialogA11y();
    }

    window.Utils = { getDb, userId, esc, lockBody, unlockBody, redirectToLogin, $ };
})();
