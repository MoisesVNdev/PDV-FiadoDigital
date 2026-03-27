<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import ConfirmDialog from "@/components/layout/confirm-dialog.vue";
import NotificationToastContainer from "@/components/layout/notification-toast-container.vue";
import { useNotifications, type NotificationFilters } from "@/composables/use-notifications.js";
import { useConfirm } from "@/composables/use-confirm.js";
import { useAuthStore } from "@/stores/auth.store.js";
import type { Notification } from "@pdv/shared";

type TabKey = "all" | "unread" | "critical" | "high" | "medium" | "info";

const notificationTabs: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "unread", label: "Não lidos" },
  { key: "critical", label: "🔴 Críticos" },
  { key: "high", label: "🟠 Avisos" },
  { key: "medium", label: "🔵 Médios" },
  { key: "info", label: "⚪ Informativos" },
];

const auth = useAuthStore();
const {
  notifications,
  isLoading,
  pagination,
  fetchNotifications,
  markAsRead,
  markAllRead,
  acknowledge,
  exportCsv,
  deleteRead,
} = useNotifications();

const {
  showConfirm,
  confirmTitle,
  confirmMessage,
  confirmLabel,
  confirm,
  onConfirm,
  onCancel,
} = useConfirm();

const activeTab = ref<TabKey>("all");
const searchQuery = ref("");
const currentPage = ref(1);
const fromDate = ref("");
const toDate = ref("");

const tabFilters: Record<TabKey, Partial<NotificationFilters>> = {
  all: {},
  unread: { read: false },
  critical: { severity: "critical" },
  high: { severity: "high" },
  medium: { severity: "medium" },
  info: { severity: "info" },
};

const canAcknowledge = computed(() => {
  const role = auth.user?.role;
  return role === "admin" || role === "manager";
});

async function loadNotifications(): Promise<void> {
  const filter = tabFilters[activeTab.value];
  await fetchNotifications({
    ...filter,
    search: searchQuery.value || undefined,
    from_date: fromDate.value || undefined,
    to_date: toDate.value || undefined,
    page: currentPage.value,
    per_page: 20,
  });
}

watch([activeTab, currentPage], () => {
  loadNotifications();
});

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentPage.value = 1;
    loadNotifications();
  }, 350);
});

watch([fromDate, toDate], () => {
  currentPage.value = 1;
  loadNotifications();
});

async function handleMarkAsRead(notification: Notification): Promise<void> {
  await markAsRead(notification.id);
}

async function handleAcknowledge(notification: Notification): Promise<void> {
  await acknowledge(notification.id);
}

async function handleMarkAllRead(): Promise<void> {
  await markAllRead();
  await loadNotifications();
}

async function handleDeleteRead(): Promise<void> {
  const isConfirmed = await confirm({
    title: "Apagar Lidas",
    message: "Tem certeza que deseja apagar todas as notificações lidas? Esta ação não pode ser desfeita.",
    confirmLabel: "Apagar tudo",
  });

  if (!isConfirmed) return;

  await deleteRead();
  await loadNotifications();
}

async function handleExport(): Promise<void> {
  await exportCsv({
    severity: (tabFilters[activeTab.value].severity as NotificationFilters["severity"]) ?? undefined,
    from_date: fromDate.value || undefined,
    to_date: toDate.value || undefined,
  });
}

function navigateMeta(notification: Notification): string | null {
  try {
    const meta = notification.meta ? (JSON.parse(notification.meta) as { redirectPath?: string }) : null;
    return meta?.redirectPath ?? null;
  } catch {
    return null;
  }
}

function severityBgClass(severity: Notification["severity"]): string {
  if (severity === "critical") return "bg-danger/10 border-danger/30";
  if (severity === "high") return "bg-warning/10 border-warning/30";
  if (severity === "medium") return "bg-primary/10 border-primary/30";
  return "bg-surface border-gray-200";
}

function severityTextClass(severity: Notification["severity"]): string {
  if (severity === "critical") return "text-danger";
  if (severity === "high") return "text-warning";
  if (severity === "medium") return "text-primary";
  return "text-gray-500";
}

function severityIcon(severity: Notification["severity"]): string {
  if (severity === "critical") return "🔴";
  if (severity === "high") return "🟠";
  if (severity === "medium") return "🔵";
  return "⚪";
}

function severityLabel(severity: Notification["severity"]): string {
  if (severity === "critical") return "CRÍTICO";
  if (severity === "high") return "ALTO";
  if (severity === "medium") return "MÉDIO";
  return "INFO";
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD}d`;
}

onMounted(() => {
  loadNotifications();
});
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface">
    <AppHeader />
    <NotificationToastContainer />
    <ConfirmDialog
      :open="showConfirm"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-label="confirmLabel"
      @confirm="onConfirm"
      @cancel="onCancel"
    />

    <div class="flex flex-1">
      <AppSidebar />

      <main class="flex-1 overflow-auto p-4 md:p-6">
        <!-- Cabeçalho da página -->
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-xl font-bold text-gray-900">Notificações</h1>
          <div class="flex items-center gap-2">
            <button
              v-if="canAcknowledge"
              type="button"
              class="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              @click="handleExport"
            >
              Exportar CSV
            </button>
            <button
              v-if="canAcknowledge"
              type="button"
              class="rounded bg-danger/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-danger-dark focus:outline-none focus:ring-2 focus:ring-danger"
              @click="handleDeleteRead"
            >
              Apagar lidas
            </button>
          </div>
        </div>

        <!-- Abas de filtro -->
        <div class="mb-4 flex flex-wrap gap-1 border-b">
          <button
            v-for="tab in notificationTabs"
            :key="tab.key"
            type="button"
            class="rounded-t px-4 py-2 text-sm font-medium transition focus:outline-none"
            :class="
              activeTab === tab.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            "
            @click="activeTab = tab.key; currentPage = 1"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Barra de busca e filtros de data -->
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Buscar por texto..."
            class="min-w-[200px] flex-1 rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Buscar notificações por texto"
          />
          <input
            v-model="fromDate"
            type="date"
            class="rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Data inicial"
          />
          <input
            v-model="toDate"
            type="date"
            class="rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Data final"
          />
          <button
            type="button"
            class="min-h-11 inline-flex items-center rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none"
            @click="handleMarkAllRead"
          >
            Marcar tudo como lido
          </button>
        </div>

        <!-- Lista de notificações -->
        <div v-if="isLoading" class="py-12 text-center text-sm text-gray-500">
          Carregando notificações...
        </div>

        <div
          v-else-if="notifications.length === 0"
          class="py-12 text-center text-sm text-gray-500"
        >
          Nenhuma notificação encontrada.
        </div>

        <ul v-else class="flex flex-col gap-2" role="list">
          <li
            v-for="notification in notifications"
            :key="notification.id"
            :class="[
              'rounded-lg border p-4 transition-colors',
              severityBgClass(notification.severity),
              { 'opacity-70': !!notification.read_at },
            ]"
            role="listitem"
          >
            <div class="flex flex-wrap items-start gap-3">
              <!-- Ícone e severidade -->
              <div class="flex items-center gap-2">
                <span class="text-xl leading-none select-none" aria-hidden="true">{{ severityIcon(notification.severity) }}</span>
                <span :class="['text-xs font-bold', severityTextClass(notification.severity)]">
                  {{ severityLabel(notification.severity) }}
                </span>
              </div>

              <!-- Conteúdo -->
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p
                    class="text-sm font-semibold text-gray-900"
                    :class="{ 'line-through': !!notification.read_at }"
                  >
                    {{ notification.title }}
                  </p>
                  <span
                    v-if="notification.severity === 'critical' && !notification.acknowledged_by"
                    class="rounded-full bg-danger/20 px-2 py-0.5 text-xs font-medium text-danger"
                  >
                    Aguardando confirmação
                  </span>
                </div>
                <p class="mt-1 text-sm text-gray-600">{{ notification.message }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ formatRelativeTime(notification.created_at) }}</p>
              </div>

              <!-- Ações -->
              <div class="flex flex-wrap items-center gap-2">
                <RouterLink
                  v-if="navigateMeta(notification)"
                  :to="navigateMeta(notification)!"
                  class="min-h-11 inline-flex items-center rounded border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary hover:text-white focus:outline-none"
                  @click="handleMarkAsRead(notification)"
                >
                  Ver
                </RouterLink>
                <button
                  v-if="!notification.read_at"
                  type="button"
                  class="min-h-11 inline-flex items-center rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-100 focus:outline-none"
                  @click="handleMarkAsRead(notification)"
                >
                  Marcar lido
                </button>
                <button
                  v-if="canAcknowledge && notification.severity === 'critical' && !notification.acknowledged_by"
                  type="button"
                  class="min-h-11 inline-flex items-center rounded border border-success px-3 py-1 text-xs font-medium text-success transition hover:bg-success hover:text-white focus:outline-none"
                  @click="handleAcknowledge(notification)"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </li>
        </ul>

        <!-- Paginação -->
        <nav
          v-if="pagination && pagination.total_pages > 1"
          class="mt-6 flex items-center justify-center gap-2"
          aria-label="Paginação de notificações"
        >
          <button
            type="button"
            :disabled="currentPage <= 1"
            class="min-h-11 inline-flex items-center rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none"
            @click="currentPage--"
          >
            ← Anterior
          </button>

          <span class="text-sm text-gray-700">
            {{ currentPage }} / {{ pagination.total_pages }}
          </span>

          <button
            type="button"
            :disabled="currentPage >= pagination.total_pages"
            class="min-h-11 inline-flex items-center rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none"
            @click="currentPage++"
          >
            Próxima →
          </button>
        </nav>
      </main>
    </div>
  </div>
</template>
