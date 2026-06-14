/**
 * auth.js — Estado de sesión global (Singleton + Observer).
 *
 * Patrón de uso:
 *   window.Auth.getUser()      → objeto auth.users o null
 *   window.Auth.getProfile()   → fila de profiles o null
 *   window.Auth.isLoggedIn()   → boolean
 *   window.Auth.isAdmin()      → boolean
 *   window.Auth.loginWithGoogle()
 *   window.Auth.logout()
 *   window.Auth.onReady(cb)    → llama cb cuando el estado inicial ya está listo
 */
(function () {
    "use strict";

    let _user    = null;
    let _profile = null;
    let _ready   = false;
    const _readyCbs = [];

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function getDb() {
        return window.SupabaseClient;
    }

    async function fetchProfile(userId) {
        const db = getDb();
        if (!db) return null;
        const { data, error } = await db
            .from("profiles")
            .select("id, username, avatar_url, role, banned, ai_custom_instructions, theme, ai_provider, ai_gemini_model, ai_groq_model")
            .eq("id", userId)
            .single();
        if (error) {
            console.error("[Auth] fetchProfile error:", error.message);
            return null;
        }
        return data;
    }

    function syncPrefsToLocalStorage(profile) {
        if (!profile) return;
        // Theme: null means "system" (remove entry so the inline script falls back to prefers-color-scheme)
        if (profile.theme) localStorage.setItem("theme", profile.theme);
        else               localStorage.removeItem("theme");
        // AI preferences
        if (profile.ai_provider)     localStorage.setItem("ai_provider",     profile.ai_provider);
        if (profile.ai_gemini_model) localStorage.setItem("ai_gemini_model", profile.ai_gemini_model);
        if (profile.ai_groq_model)   localStorage.setItem("ai_groq_model",   profile.ai_groq_model);
    }

    function updateNavbar() {
        const loginBtn    = document.getElementById("auth-login-btn");
        const userBtn     = document.getElementById("auth-user-btn");
        const userAvatar  = document.getElementById("auth-user-avatar");
        const userInitial = document.getElementById("auth-user-initial");
        const notifWrapper = document.getElementById("notif-wrapper");
        const adminLink   = document.getElementById("auth-admin-link");

        if (_user && _profile) {
            loginBtn?.classList.add("hidden");
            userBtn?.classList.remove("hidden");
            notifWrapper?.classList.remove("hidden");

            if (_profile.avatar_url) {
                if (userAvatar) {
                    userAvatar.src = _profile.avatar_url;
                    userAvatar.classList.remove("hidden");
                }
                if (userInitial) userInitial.classList.add("hidden");
            } else {
                if (userAvatar) userAvatar.classList.add("hidden");
                if (userInitial) {
                    userInitial.textContent = (_profile.username || "U")[0].toUpperCase();
                    userInitial.classList.remove("hidden");
                }
            }

            if (adminLink) {
                adminLink.style.display = _profile.role === "admin" ? "flex" : "none";
            }
        } else {
            loginBtn?.classList.remove("hidden");
            userBtn?.classList.add("hidden");
            notifWrapper?.classList.add("hidden");
            if (adminLink) adminLink.style.display = "none";
        }
    }

    function fireReady() {
        if (_ready) return;
        _ready = true;
        _readyCbs.forEach(cb => {
            try { cb(_user, _profile); } catch (e) { console.error("[Auth] onReady cb error:", e); }
        });
    }

    // Consolidate banned-user and profile handling logic
    async function handleSession(user) {
        if (!user) {
            _user = null;
            _profile = null;
            return;
        }

        _user = user;
        _profile = await fetchProfile(user.id);

        if (_profile?.banned) {
            const db = getDb();
            if (db) await db.auth.signOut();
            _user = null;
            _profile = null;
        } else {
            syncPrefsToLocalStorage(_profile);
        }
    }

    // ─── Init: escuchar cambios de sesión ─────────────────────────────────────

    async function init() {
        const db = getDb();
        if (!db) {
            console.warn("[Auth] Supabase no disponible.");
            fireReady();
            return;
        }

        // Estado inicial
        const { data: { session }, error } = await db.auth.getSession();
        if (error) {
            console.error("[Auth] getSession error:", error.message);
            fireReady();
            return;
        }

        if (session?.user) {
            await handleSession(session.user);
        }

        updateNavbar();
        fireReady();

        // Escuchar cambios futuros (login/logout/token refresh)
        db.auth.onAuthStateChange(async (event, session) => {
            if (event === "SIGNED_IN" && session?.user) {
                await handleSession(session.user);
            } else if (event === "SIGNED_OUT") {
                _user = null;
                _profile = null;
            }
            updateNavbar();
        });
    }

    // ─── API pública ──────────────────────────────────────────────────────────

    window.Auth = {
        getUser:    () => _user,
        getProfile: () => _profile,
        isLoggedIn: () => _user !== null,
        isAdmin:    () => _profile?.role === "admin",

        loginWithGoogle: async function (redirectTo) {
            const db = getDb();
            if (!db) return;
            const origin = window.location.origin;
            await db.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: redirectTo || `${origin}/auth/callback`,
                    queryParams: { prompt: "select_account" },
                },
            });
        },

        logout: async function () {
            const db = getDb();
            if (!db) return;
            await db.auth.signOut();
            window.location.href = "/";
        },

        onReady: function (cb) {
            if (_ready) {
                try { cb(_user, _profile); } catch (e) {}
            } else {
                _readyCbs.push(cb);
            }
        },
    };

    // Arrancar en cuanto el DOM esté listo
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
