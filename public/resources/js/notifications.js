/**
 * notifications.js — Campana de notificaciones en tiempo real.
 *
 * Expone window.Notifications.
 * Se inicializa automáticamente cuando Auth está listo y hay sesión activa.
 */
(function () {
    "use strict";

    let _channel = null;

    // ─── Badge ────────────────────────────────────────────────────────────────

    function setBadge(count) {
        const badge = document.getElementById("notif-badge");
        const countEl = document.getElementById("notif-count");
        if (!badge) return;
        if (count > 0) {
            badge.classList.remove("hidden");
            if (countEl) countEl.textContent = count > 99 ? "99+" : String(count);
        } else {
            badge.classList.add("hidden");
        }
    }

    async function loadUnreadCount(userId) {
        const db = window.Utils?.getDb();
        if (!db) return;
        const { count, error } = await db
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("is_read", false);
        if (error) {
            console.error("[notifications] loadUnreadCount error:", error);
            return;
        }
        setBadge(count || 0);
    }

    // ─── Dropdown ─────────────────────────────────────────────────────────────

    async function loadNotifications(userId) {
        const db = window.Utils?.getDb();
        if (!db) return [];
        const { data, error } = await db
            .from("notifications")
            .select("id, type, message, is_read, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20);
        if (error) {
            console.error("[notifications] loadNotifications error:", error);
            return [];
        }
        return data || [];
    }

    function formatTimeAgo(iso) {
        const diff = (Date.now() - new Date(iso).getTime()) / 1000;
        if (diff < 60)  return "Ahora";
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
        return `Hace ${Math.floor(diff / 86400)} d`;
    }

    function typeIcon(type) {
        const icons = {
            report_accepted:        "check_circle",
            report_rejected:        "do_not_disturb_on",
            contribution_accepted:  "star",
            contribution_rejected:  "block",
            announcement:           "campaign",
        };
        return icons[type] || "notifications";
    }

    function renderDropdown(notifications) {
        const list = document.getElementById("notif-list");
        if (!list) return;

        if (notifications.length === 0) {
            list.innerHTML = `<p class="text-center text-text-muted text-sm py-6">Sin notificaciones</p>`;
            return;
        }

        list.innerHTML = notifications.map(n => `
            <div class="notif-item flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer ${n.is_read ? "opacity-70" : ""}" data-id="${n.id}">
                <span class="material-icons text-blue-500 flex-shrink-0 mt-0.5 mi-md">${typeIcon(n.type)}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-text-main m-0 leading-snug">${window.Utils?.esc(n.message) || ''}</p>
                    <p class="text-xs text-text-muted mt-1 m-0">${formatTimeAgo(n.created_at)}</p>
                </div>
                ${!n.is_read ? '<div class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"></div>' : ""}
            </div>
        `).join("");

        // Mark as read on click
        list.querySelectorAll(".notif-item").forEach(item => {
            item.addEventListener("click", () => markAsRead(item.dataset.id));
        });
    }

    async function openDropdown() {
        const dropdown = document.getElementById("notif-dropdown");
        if (!dropdown) return;

        const userId = window.Utils?.userId();
        if (!userId) return;

        dropdown.classList.remove("hidden");

        const notifications = await loadNotifications(userId);
        renderDropdown(notifications);
    }

    function closeDropdown() {
        document.getElementById("notif-dropdown")?.classList.add("hidden");
    }

    async function markAsRead(notifId) {
        const db = window.Utils?.getDb();
        if (!db) return;
        const { error } = await db.from("notifications").update({ is_read: true }).eq("id", notifId);
        if (error) {
            console.error("[notifications] markAsRead error:", error);
            return;
        }
        // Update visual
        const item = document.querySelector(`.notif-item[data-id="${notifId}"]`);
        if (item) {
            item.classList.add("opacity-70");
            item.querySelector(".bg-blue-500.rounded-full")?.remove();
        }
    }

    async function markAllAsRead(userId) {
        const db = window.Utils?.getDb();
        if (!db) return;
        const { error } = await db.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
        if (error) {
            console.error("[notifications] markAllAsRead error:", error);
            return;
        }
    }

    // ─── Realtime ─────────────────────────────────────────────────────────────

    function subscribeRealtime(userId) {
        const db = window.Utils?.getDb();
        if (!db) return;

        _channel = db
            .channel("notifications:" + userId)
            .on("postgres_changes", {
                event:  "INSERT",
                schema: "public",
                table:  "notifications",
                filter: `user_id=eq.${userId}`,
            }, (payload) => {
                // Increment badge using setBadge instead of direct DOM manipulation
                const countEl = document.getElementById("notif-count");
                if (countEl) {
                    const cur = parseInt(countEl.textContent, 10) || 0;
                    setBadge(cur + 1);
                }
            })
            .subscribe();
    }

    function unsubscribe() {
        if (_channel) {
            window.SupabaseClient?.removeChannel(_channel);
            _channel = null;
        }
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    function init() {
        const bellBtn  = document.getElementById("notif-btn");
        const dropdown = document.getElementById("notif-dropdown");

        if (!bellBtn || !dropdown) return;

        bellBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (dropdown.classList.contains("hidden")) {
                openDropdown();
            } else {
                closeDropdown();
            }
        });

        document.addEventListener("click", (e) => {
            if (!dropdown.classList.contains("hidden") && !dropdown.contains(e.target) && e.target !== bellBtn) {
                closeDropdown();
            }
        });

        document.getElementById("notif-mark-all-btn")?.addEventListener("click", async (e) => {
            e.stopPropagation();
            const userId = window.Utils?.userId();
            if (!userId) return;
            await markAllAsRead(userId);
            setBadge(0);
            // Refrescar lista para que se vean todos como leídos
            const notifications = await loadNotifications(userId);
            renderDropdown(notifications);
        });

        // Arrange auth listener
        window.Auth?.onReady((user) => {
            if (user) {
                loadUnreadCount(user.id);
                subscribeRealtime(user.id);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.Notifications = { markAsRead, markAllAsRead, unsubscribe };
})();
