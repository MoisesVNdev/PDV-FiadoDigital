<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth.store.js";
import { useWebSocket } from "@/composables/use-websocket.js";
import { useLayoutState } from "@/composables/use-layout-state.js";
import { useAuth } from "@/composables/use-auth.js";
import { useNotifications } from "@/composables/use-notifications.js";
import type { Notification } from "@pdv/shared";

const auth = useAuthStore();
const { logout } = useAuth();
const router = useRouter();
const route = useRoute();
const pageTitle = computed(() => route.meta.title as string || "");
const loggingOut = ref(false);
const { isOnline } = useWebSocket();
const { openMobileMenu } = useLayoutState();
const {
  unreadCount,
  recentNotifications,
  fetchUnreadCount,
  fetchRecentNotifications,
  markAsRead,
  markAllRead,
  initWsWatcher,
  startPolling,
  stopPolling,
} = useNotifications();

const showPanel = ref(false);

async function handleLogout(): Promise<void> {
  loggingOut.value = true;
  try {
    await logout();
  } finally {
    loggingOut.value = false;
  }
}

function toggleNotificationPanel(): void {
  showPanel.value = !showPanel.value;
  if (showPanel.value) {
    fetchRecentNotifications();
  }
}

function closePanel(): void {
  showPanel.value = false;
}

async function handleMarkAllRead(): Promise<void> {
  await markAllRead();
}

async function navigateTo(notification: Notification): Promise<void> {
  closePanel();
  await markAsRead(notification.id);
  try {
    const meta = notification.meta
      ? (JSON.parse(notification.meta) as { redirectPath?: string })
      : null;
    if (meta?.redirectPath) {
      await router.push(meta.redirectPath);
    }
  } catch {
    // meta inválida — ignora redirect
  }
}

function severityIconClass(severity: Notification["severity"]): string {
  if (severity === "critical") return "text-danger";
  if (severity === "high") return "text-warning";
  if (severity === "medium") return "text-primary";
  return "text-gray-400";
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  return `há ${Math.floor(diffH / 24)}d`;
}

function handleClickOutside(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target.closest("[data-notification-panel]")) {
    closePanel();
  }
}

onMounted(async () => {
  initWsWatcher();
  await fetchUnreadCount();

  if (!isOnline.value) {
    startPolling();
  }

  document.addEventListener("click", handleClickOutside);
});

watch(isOnline, async (online) => {
  if (!online) {
    startPolling();
    return;
  }

  stopPolling();
  await fetchUnreadCount();
});

onUnmounted(() => {
  stopPolling();
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <header class="relative flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 shadow-sm md:px-6">
    <div class="flex items-center gap-2 lg:w-1/3">
      <button
        type="button"
        class="2xl:hidden min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition hover:bg-gray-50 active:bg-gray-200"
        aria-label="Abrir menu de navegação"
        @click="openMobileMenu"
      >
        <span class="text-xl leading-none select-none" aria-hidden="true">☰</span>
      </button>
      <span class="text-lg font-semibold text-primary">PDV FiadoDigital</span>
    </div>

    <div v-if="pageTitle" class="hidden flex-1 justify-center text-center lg:flex flex-row lg:w-1/3">
      <h1 class="text-xl font-bold text-gray-800">{{ pageTitle }}</h1>
    </div>

    <div class="flex flex-1 justify-end items-center gap-3 md:gap-4 lg:w-1/3 lg:flex-none">
      <div
        v-if="!isOnline"
        role="status"
        aria-live="polite"
        class="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-warning md:text-sm"
      >
        <span class="text-xl leading-none select-none" aria-hidden="true">⚠️</span>
        <span>Servidor indisponível</span>
      </div>

      <!-- Badge de notificações -->
      <div class="relative" data-notification-panel>
        <button
          type="button"
          :aria-label="`Ver notificações — ${unreadCount} notificação${unreadCount !== 1 ? 'ões' : ''} não lida${unreadCount !== 1 ? 's' : ''}`"
          class="relative flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors hover:bg-surface"
          @click.stop="toggleNotificationPanel"
        >
          <span class="text-xl leading-none select-none" aria-hidden="true">🔔</span>
          <span
            v-if="unreadCount > 0"
            aria-hidden="true"
            class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
          >
            {{ unreadCount > 99 ? "99+" : unreadCount }}
          </span>
        </button>

        <button
          v-if="showPanel"
          type="button"
          aria-label="Fechar painel de notificações"
          class="fixed inset-0 z-40 bg-black/20 sm:hidden"
          @click="closePanel"
        />

        <!-- Dropdown de prévia -->
        <div
          v-if="showPanel"
          role="region"
          aria-label="Notificações recentes"
          class="fixed inset-x-3 top-24 z-50 max-h-[calc(100dvh-7rem)] overflow-hidden rounded-lg border bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-80"
        >
          <div class="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2">
            <span class="text-sm font-semibold">Notificações</span>
            <button
              type="button"
              class="self-start text-xs text-primary hover:underline focus:outline-none sm:self-auto"
              @click="handleMarkAllRead"
            >
              Marcar tudo como lido
            </button>
          </div>

          <ul
            v-if="recentNotifications.length > 0"
            class="max-h-[calc(100dvh-12rem)] divide-y overflow-y-auto sm:max-h-72"
            role="list"
          >
            <li
              v-for="notification in recentNotifications"
              :key="notification.id"
              role="listitem"
              class="cursor-pointer px-4 py-3 transition-colors hover:bg-surface"
              :class="{ 'font-semibold': !notification.read_at }"
              @click="navigateTo(notification)"
            >
              <div class="flex items-start gap-2">
                <span :class="['text-sm', severityIconClass(notification.severity)]">●</span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm wrap-break-word sm:truncate">{{ notification.title }}</p>
                  <p class="line-clamp-3 wrap-break-word text-xs text-gray-500 sm:line-clamp-2">{{ notification.message }}</p>
                  <p class="mt-1 text-xs text-gray-400">{{ formatRelativeTime(notification.created_at) }}</p>
                </div>
              </div>
            </li>
          </ul>

          <p v-else class="px-4 py-6 text-center text-sm text-gray-500">
            Nenhuma notificação recente.
          </p>

          <div class="border-t px-4 py-2 text-center">
            <RouterLink
              to="/notifications"
              class="text-xs text-primary hover:underline"
              @click="closePanel"
            >
              Ver todas as notificações
            </RouterLink>
          </div>
        </div>
      </div>

      <span class="text-sm text-gray-600">
        {{ auth.user?.name }} ({{ auth.user?.role }})
      </span>
      <button
        type="button"
        :disabled="loggingOut"
        class="rounded bg-gray-200 px-3 py-1 text-sm transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
        @click="handleLogout"
      >
        {{ loggingOut ? "Saindo..." : "Sair" }}
      </button>
    </div>
  </header>
</template>
