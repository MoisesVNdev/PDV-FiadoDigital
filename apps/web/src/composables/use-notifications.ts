import { ref, watch, type Ref } from "vue";
import { useApi } from "./use-api.js";
import { useWebSocket } from "./use-websocket.js";
import type { Notification } from "@pdv/shared";

export interface NotificationFilters {
  severity?: "critical" | "high" | "medium" | "info";
  read?: boolean;
  search?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}

export interface NotificationToast {
  id: string;
  notification: Notification;
  persistent: boolean;
}

type WsMessage = { type: string; payload: unknown };

// Estado global singleton — compartilhado entre header, página e qualquer componente
interface GlobalNotifState {
  unreadCount: Ref<number>;
  recentNotifications: Ref<Notification[]>;
  toasts: Ref<NotificationToast[]>;
  pollingInterval: ReturnType<typeof setInterval> | null;
  wsWatcherActive: boolean;
}

function getGlobalState(): GlobalNotifState {
  const key = "__pdvNotifState";
  if (!(globalThis as Record<string, unknown>)[key]) {
    (globalThis as Record<string, unknown>)[key] = {
      unreadCount: ref(0),
      recentNotifications: ref<Notification[]>([]),
      toasts: ref<NotificationToast[]>([]),
      pollingInterval: null,
      wsWatcherActive: false,
    };
  }
  return (globalThis as Record<string, unknown>)[key] as GlobalNotifState;
}

export function useNotifications() {
  const { authenticatedFetch } = useApi();
  const { lastMessage, isConnected } = useWebSocket();
  const globalState = getGlobalState();

  const notifications = ref<Notification[]>([]);
  const isLoading = ref(false);
  const pagination = ref<{ page: number; per_page: number; total: number; total_pages: number } | null>(null);

  // ── Contagem de não lidas ────────────────────────────────────────────────
  async function fetchUnreadCount(): Promise<void> {
    try {
      const res = await authenticatedFetch("/api/notifications/unread-count");
      const json = (await res.json()) as { success: boolean; data: { count: number } };
      if (json.success) {
        globalState.unreadCount.value = json.data.count;
      }
    } catch {
      // Falha silenciosa — o badge simplesmente não atualiza
    }
  }

  // ── Buscar notificações paginadas ────────────────────────────────────────
  async function fetchNotifications(filters: NotificationFilters = {}): Promise<void> {
    isLoading.value = true;
    try {
      const params = new URLSearchParams();
      if (filters.severity) params.set("severity", filters.severity);
      if (filters.read !== undefined) params.set("read", String(filters.read));
      if (filters.search) params.set("search", filters.search);
      if (filters.from_date) params.set("from_date", filters.from_date);
      if (filters.to_date) params.set("to_date", filters.to_date);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.per_page) params.set("per_page", String(filters.per_page));

      const res = await authenticatedFetch(`/api/notifications?${params.toString()}`);
      const json = (await res.json()) as {
        success: boolean;
        data: Notification[];
        pagination: typeof pagination.value;
      };

      if (json.success) {
        notifications.value = json.data;
        pagination.value = json.pagination;
      }
    } catch {
      // Erro tratado pelo caller
    } finally {
      isLoading.value = false;
    }
  }

  // ── Buscar prévia compacta para o dropdown do header ────────────────────
  async function fetchRecentNotifications(): Promise<void> {
    try {
      const res = await authenticatedFetch("/api/notifications?per_page=5&page=1");
      const json = (await res.json()) as { success: boolean; data: Notification[] };
      if (json.success) {
        globalState.recentNotifications.value = json.data;
      }
    } catch {
      // Falha silenciosa
    }
  }

  // ── Marcar como lida ────────────────────────────────────────────────────
  async function markAsRead(id: string): Promise<void> {
    try {
      const res = await authenticatedFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      const json = (await res.json()) as { success: boolean; data: Notification };

      if (!json.success) return;

      // Atualizar estado local
      const localIdx = notifications.value.findIndex((n) => n.id === id);
      if (localIdx !== -1) {
        notifications.value[localIdx] = json.data;
      }

      const recentIdx = globalState.recentNotifications.value.findIndex((n) => n.id === id);
      if (recentIdx !== -1) {
        globalState.recentNotifications.value[recentIdx] = json.data;
      }

      globalState.unreadCount.value = Math.max(0, globalState.unreadCount.value - 1);
    } catch {
      // Erro silencioso
    }
  }

  // ── Marcar todas como lidas ──────────────────────────────────────────────
  async function markAllRead(): Promise<void> {
    try {
      const res = await authenticatedFetch("/api/notifications/read-all", { method: "PATCH" });
      const json = (await res.json()) as { success: boolean };

      if (!json.success) return;

      const now = new Date().toISOString();
      notifications.value = notifications.value.map((n) => ({
        ...n,
        read_at: n.read_at ?? now,
      }));
      globalState.recentNotifications.value = globalState.recentNotifications.value.map((n) => ({
        ...n,
        read_at: n.read_at ?? now,
      }));
      globalState.unreadCount.value = 0;
    } catch {
      // Erro silencioso
    }
  }

  // ── Confirmar/reconhecer notificação crítica ─────────────────────────────
  async function acknowledge(id: string): Promise<void> {
    try {
      const res = await authenticatedFetch(`/api/notifications/${id}/acknowledge`, {
        method: "PATCH",
      });
      const json = (await res.json()) as { success: boolean; data: Notification };

      if (!json.success) return;

      const localIdx = notifications.value.findIndex((n) => n.id === id);
      if (localIdx !== -1) {
        notifications.value[localIdx] = json.data;
      }

      const recentIdx = globalState.recentNotifications.value.findIndex((n) => n.id === id);
      if (recentIdx !== -1) {
        globalState.recentNotifications.value[recentIdx] = json.data;
      }

      dismissToast(id);
    } catch {
      // Erro silencioso
    }
  }

  // ── Exportar CSV ─────────────────────────────────────────────────────────
  async function exportCsv(filters: Pick<NotificationFilters, "severity" | "from_date" | "to_date"> = {}): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (filters.severity) params.set("severity", filters.severity);
      if (filters.from_date) params.set("from_date", filters.from_date);
      if (filters.to_date) params.set("to_date", filters.to_date);

      const res = await authenticatedFetch(`/api/notifications/export?${params.toString()}`);

      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `notificacoes-${new Date().toISOString().split("T")[0]}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // Erro silencioso
    }
  }

  // ── Apagar notificações lidas ───────────────────────────────────────────
  async function deleteRead(): Promise<{ count: number } | void> {
    try {
      const res = await authenticatedFetch(`/api/notifications/read`, { method: "DELETE" });
      if (!res.ok) return;
      const json = (await res.json()) as { success: boolean; data?: { deleted_count?: number } };
      if (!json.success) return;

      // Atualizar estado local: remover notificações lidas
      notifications.value = notifications.value.filter((n) => !n.read_at);
      globalState.recentNotifications.value = globalState.recentNotifications.value.filter((n) => !n.read_at);

      return { count: json.data?.deleted_count ?? 0 };
    } catch {
      // Falha silenciosa
    }
  }

  // ── Toasts ───────────────────────────────────────────────────────────────
  function dismissToast(id: string): void {
    globalState.toasts.value = globalState.toasts.value.filter((t) => t.id !== id);
  }

  function addToast(notification: Notification): void {
    const persistent = notification.severity === "critical";
    globalState.toasts.value.push({ id: notification.id, notification, persistent });

    if (!persistent) {
      const duration = notification.severity === "high" ? 8000 : 4000;
      setTimeout(() => dismissToast(notification.id), duration);
    }
  }

  // ── Handler de mensagem WebSocket ────────────────────────────────────────
  function handleWebSocketMessage(msg: WsMessage): void {
    if (msg.type !== "notification.new") return;

    const notification = msg.payload as Notification;
    globalState.unreadCount.value++;
    globalState.recentNotifications.value.unshift(notification);

    if (globalState.recentNotifications.value.length > 5) {
      globalState.recentNotifications.value.pop();
    }

    addToast(notification);
  }

  // ── Polling de fallback quando WS desconectado ───────────────────────────
  function startPolling(): void {
    if (globalState.pollingInterval !== null) return;
    globalState.pollingInterval = setInterval(() => {
      if (!isConnected.value) {
        fetchUnreadCount();
      }
    }, 60_000);
  }

  function stopPolling(): void {
    if (globalState.pollingInterval === null) return;
    clearInterval(globalState.pollingInterval);
    globalState.pollingInterval = null;
  }

  // ── Registrar watcher WS global (apenas uma vez) ─────────────────────────
  function initWsWatcher(): void {
    if (globalState.wsWatcherActive) return;
    globalState.wsWatcherActive = true;

    watch(lastMessage, (msg) => {
      if (msg) handleWebSocketMessage(msg);
    });
  }

  return {
    // Estado global
    unreadCount: globalState.unreadCount,
    recentNotifications: globalState.recentNotifications,
    toasts: globalState.toasts,

    // Estado local (página /notifications)
    notifications,
    isLoading,
    pagination,

    // Ações
    fetchUnreadCount,
    fetchNotifications,
    fetchRecentNotifications,
    markAsRead,
    markAllRead,
    acknowledge,
    exportCsv,
    deleteRead,
    dismissToast,
    handleWebSocketMessage,
    startPolling,
    stopPolling,
    initWsWatcher,
  };
}
