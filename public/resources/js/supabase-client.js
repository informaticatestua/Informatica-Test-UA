/**
 * supabase-client.js — Singleton del cliente Supabase.
 *
 * Las credenciales se inyectan desde BaseLayout.astro como variables
 * globales (window.SUPABASE_URL / window.SUPABASE_ANON_KEY) antes de
 * que este script se ejecute.
 *
 * Expone window.SupabaseClient para que quiz-data.js y futuros módulos
 * puedan importarlo sin instanciar múltiples clientes.
 */
(function () {
    "use strict";

    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.warn("[SupabaseClient] Credenciales no configuradas. El quiz cargará desde archivos .txt.");
        window.SupabaseClient = null;
        return;
    }

    if (typeof window.supabase === "undefined" || typeof window.supabase.createClient !== "function") {
        console.warn("[SupabaseClient] SDK de Supabase no disponible. El quiz cargará desde archivos .txt.");
        window.SupabaseClient = null;
        return;
    }

    window.SupabaseClient = window.supabase.createClient(url, key);
})();
