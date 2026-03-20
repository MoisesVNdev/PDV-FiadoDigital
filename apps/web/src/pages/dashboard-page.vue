<script setup lang="ts">
import { formatCents, type DashboardSummary } from "@pdv/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import { useApi } from "@/composables/use-api.js";
import { useNotifications } from "@/composables/use-notifications.js";
import { useWebSocket } from "@/composables/use-websocket.js";
import { useAuthStore } from "@/stores/auth.store.js";
import TrendBadge from "@/components/dashboard/TrendBadge.vue";
import PaymentDonutChart from "@/components/dashboard/PaymentDonutChart.vue";

interface OverdueCustomer {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  current_debt_cents: number;
  payment_due_day: number | null;
}

type PeriodPreset = "today" | "yesterday" | "week" | "month";

const router = useRouter();
const authStore = useAuthStore();
const { authenticatedFetch } = useApi();
const { fetchUnreadCount, initWsWatcher } = useNotifications();
const { isOnline, lastMessage } = useWebSocket();

const summary = ref<DashboardSummary | null>(null);
const isLoading = ref(true);
const hasError = ref(false);

const selectedCustomer = ref<OverdueCustomer | null>(null);
const showChargeModal = ref(false);

let pollingInterval: ReturnType<typeof setInterval> | null = null;

const storageScope = computed(() => authStore.user?.id ?? authStore.user?.username ?? "anonymous");
const showValuesKey = computed(() => `dashboard_show_values:${storageScope.value}`);
const viewModeKey = computed(() => `dashboard_view_mode:${storageScope.value}`);
const cacheKey = computed(() => `dashboard_cache:${storageScope.value}`);

const showMonetaryValues = ref(true);
const viewMode = ref<"manager" | "operator">("manager");

// Melhoria 5: filtro de período persistente
const periodPresets: Array<{ value: PeriodPreset; label: string }> = [
  { value: "today",     label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "week",      label: "Últimos 7 dias" },
  { value: "month",     label: "Este mês" },
];

const activePeriod = ref<PeriodPreset>(
  (localStorage.getItem("dashboard_period") as PeriodPreset | null) ?? "today",
);

const formattedDate = computed(() => {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
});

const fiadoTodayCents = computed(() => {
  return summary.value?.financial.by_payment_method.fiado ?? 0;
});

const periodLabel = computed<string>(() => {
  const map: Record<PeriodPreset, string> = {
    today:     "hoje",
    yesterday: "ontem",
    week:      "nos últimos 7 dias",
    month:     "neste mês",
  };
  return map[activePeriod.value];
});

const discountColor = computed(() => {
  const val = summary.value?.financial.discount_total_cents ?? 0;
  if (val === 0) return "text-success";
  if (val <= 500) return "text-warning";
  return "text-danger";
});

// Melhoria 6: opacidade reduzida quando KPI é zero
const discountCardClass = computed(() =>
  (summary.value?.financial.discount_total_cents ?? 0) === 0
    ? "opacity-60 ring-gray-100"
    : "ring-warning/40",
);

const cancellationsCardClass = computed(() =>
  (summary.value?.financial.cancellations_count ?? 0) === 0
    ? "opacity-60 ring-gray-100"
    : "ring-danger/40",
);

function onMessage(handler: (msg: { type: string; payload: unknown }) => void): void {
  watch(lastMessage, (message) => {
    if (!message) {
      return;
    }

    handler(message);
  });
}

function formatStockQuantity(quantity: number, isBulk: boolean): string {
  if (isBulk) {
    return `${quantity.toLocaleString("pt-BR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} kg`;
  }

  return `${Math.trunc(quantity)} un`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toggleViewMode(): void {
  viewMode.value = viewMode.value === "manager" ? "operator" : "manager";
}

function openChargeModal(customer: OverdueCustomer): void {
  selectedCustomer.value = customer;
  showChargeModal.value = true;
}

function goToPayment(): void {
  if (!selectedCustomer.value) {
    return;
  }

  showChargeModal.value = false;
  router.push({
    name: "customers",
    query: {
      customerId: selectedCustomer.value.customer_id,
      tab: "payments",
    },
  });
}

function printShoppingList(): void {
  const items = summary.value?.stock_alerts ?? [];

  if (!items.length) {
    return;
  }

  const listHtml = items
    .map((item) => {
      const currentStock = item.is_bulk
        ? `${item.stock_quantity.toFixed(3)} kg`
        : `${Math.trunc(item.stock_quantity)} un`;
      const minimumStock = item.is_bulk
        ? `${item.min_stock_alert} kg`
        : `${item.min_stock_alert} un`;

      return `<li><strong>${item.product_name}</strong> — Estoque atual: ${currentStock} (mínimo: ${minimumStock})</li>`;
    })
    .join("");

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Lista de Compras</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          h1 { font-size: 18px; }
          li { margin: 8px 0; }
        </style>
      </head>
      <body>
        <h1>Lista de Compras — ${new Date().toLocaleDateString("pt-BR")}</h1>
        <ul>${listHtml}</ul>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function clearPollingInterval(): void {
  if (!pollingInterval) {
    return;
  }

  clearInterval(pollingInterval);
  pollingInterval = null;
}

// Melhoria 7: redirecionar para controle ao clicar em fatia do gráfico
function handleDrillDown(method: string): void {
  router.push({ name: "control", query: { tab: "cash", payment_method: method } });
}

async function loadDashboard(): Promise<void> {
  isLoading.value = true;
  hasError.value = false;

  try {
    const response = await authenticatedFetch(`/api/dashboard-summary?preset=${activePeriod.value}`);
    const json = (await response.json()) as { success: boolean; data: DashboardSummary };

    if (!response.ok || !json.success) {
      hasError.value = true;
      return;
    }

    summary.value = json.data;
    sessionStorage.setItem(cacheKey.value, JSON.stringify(json.data));
    await fetchUnreadCount();
  } catch {
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
}

function restoreSessionCache(): void {
  const cached = sessionStorage.getItem(cacheKey.value);

  if (!cached) {
    return;
  }

  try {
    summary.value = JSON.parse(cached) as DashboardSummary;
  } catch {
    sessionStorage.removeItem(cacheKey.value);
  }
}

function applyStoredPreferences(): void {
  showMonetaryValues.value = localStorage.getItem(showValuesKey.value) !== "false";
  viewMode.value = (localStorage.getItem(viewModeKey.value) as "manager" | "operator") ?? "manager";
}

watch(showMonetaryValues, (value) => {
  localStorage.setItem(showValuesKey.value, String(value));
});

watch(viewMode, (value) => {
  localStorage.setItem(viewModeKey.value, value);
});

watch(storageScope, () => {
  applyStoredPreferences();
  restoreSessionCache();
});

watch(activePeriod, (val) => {
  localStorage.setItem("dashboard_period", val);
  void loadDashboard();
});

watch(
  isOnline,
  (online) => {
    if (!online) {
      if (!pollingInterval) {
        pollingInterval = setInterval(() => {
          loadDashboard();
        }, 30_000);
      }

      return;
    }

    clearPollingInterval();
  },
  { immediate: true },
);

onMessage((msg) => {
  if (msg.type === "notification.new" || msg.type === "stock.low_alert") {
    loadDashboard();
  }
});

onMounted(async () => {
  applyStoredPreferences();
  restoreSessionCache();
  initWsWatcher();
  await loadDashboard();
});

onBeforeRouteLeave(() => {
  sessionStorage.removeItem(cacheKey.value);
  showChargeModal.value = false;
  selectedCustomer.value = null;
});

onUnmounted(() => {
  clearPollingInterval();
});
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader />
      <main class="min-w-0 flex-1 px-3 py-4 sm:px-4 md:px-6 md:py-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm text-gray-500">{{ formattedDate }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="toggleViewMode"
              class="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-gray-50"
              :aria-label="`Modo atual: ${viewMode === 'manager' ? 'Gerente' : 'Operador'}. Clique para alternar.`"
            >
              <span>{{ viewMode === "manager" ? "📊 Gerente" : "🖥️ Operador" }}</span>
            </button>
            <button
              @click="showMonetaryValues = !showMonetaryValues"
              class="rounded-full p-2 transition-colors hover:bg-gray-100"
              :aria-label="showMonetaryValues ? 'Ocultar valores' : 'Mostrar valores'"
            >
              {{ showMonetaryValues ? "👁" : "🙈" }}
            </button>
            <button
              @click="loadDashboard"
              :disabled="isLoading"
              class="rounded-full p-2 transition-colors hover:bg-gray-100"
              aria-label="Atualizar dados"
            >
              <span :class="{ 'animate-spin': isLoading }">🔄</span>
            </button>
          </div>
        </div>

        <!-- Melhoria 5: barra de filtro de período -->
        <div class="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Filtro de período">
          <button
            v-for="preset in periodPresets"
            :key="preset.value"
            type="button"
            class="min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:w-auto"
            :class="activePeriod === preset.value ? 'bg-primary text-white' : 'border bg-white text-gray-600 hover:bg-surface'"
            :aria-pressed="activePeriod === preset.value"
            @click="activePeriod = preset.value"
          >
            {{ preset.label }}
          </button>
        </div>

        <div
          v-if="hasError"
          role="alert"
          class="mb-4 flex items-center justify-between rounded-lg bg-danger/10 px-4 py-3 text-danger"
        >
          <span>⚠️ Falha ao carregar os dados. Toque para tentar novamente.</span>
          <button @click="loadDashboard" class="font-semibold underline">Tentar</button>
        </div>

        <div
          v-if="!isOnline"
          role="status"
          aria-live="polite"
          class="mb-4 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          ⚠️ Conexão offline — dados podem estar desatualizados.
        </div>

        <div v-if="summary || isLoading">
          <div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="rounded-xl bg-white p-4 shadow-sm ring-2 ring-success col-span-2 lg:col-span-1">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-2xl">💰</span>
                <TrendBadge
                  v-if="viewMode === 'manager'"
                  :today="summary?.financial.total_sales_cents"
                  :yesterday="summary?.financial_yesterday.total_sales_cents"
                />
              </div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Total vendido {{ periodLabel }}</p>
              <p class="mt-1 text-4xl leading-none font-bold text-success">
                <template v-if="isLoading"><span class="skeleton inline-block h-8 w-28 rounded" /></template>
                <template v-else-if="showMonetaryValues">{{ formatCents(summary?.financial.total_sales_cents ?? 0) }}</template>
                <template v-else>R$ ••••</template>
              </p>
              <p class="mt-2 text-xs text-gray-500">
                <template v-if="isLoading"><span class="skeleton inline-block h-3 w-16 rounded" /></template>
                <template v-else>{{ summary?.financial.total_sales_count ?? 0 }} venda(s)</template>
              </p>
            </div>

            <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-2xl">📒</span>
                <TrendBadge
                  v-if="viewMode === 'manager'"
                  :today="summary?.financial.by_payment_method.fiado"
                  :yesterday="0"
                />
              </div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">No fiado {{ periodLabel }}</p>
              <p class="mt-1 text-3xl leading-none font-bold text-warning">
                <template v-if="isLoading"><span class="skeleton inline-block h-8 w-28 rounded" /></template>
                <template v-else-if="showMonetaryValues">{{ formatCents(fiadoTodayCents) }}</template>
                <template v-else>R$ ••••</template>
              </p>
              <p class="mt-2 text-xs text-gray-500">
                <template v-if="isLoading"><span class="skeleton inline-block h-3 w-16 rounded" /></template>
                <template v-else>Valor acumulado {{ periodLabel }}</template>
              </p>
            </div>

            <div
              v-if="viewMode === 'manager'"
              class="rounded-xl bg-white p-4 shadow-sm ring-1 transition-all"
              :class="cancellationsCardClass"
            >
              <span class="mb-1 block text-2xl">🗑️</span>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Cancelamentos {{ periodLabel }}</p>
              <p
                class="mt-1 text-3xl leading-none font-bold"
                :class="(summary?.financial.cancellations_count ?? 0) > 0 ? 'text-danger' : 'text-gray-400'"
              >
                <template v-if="isLoading"><span class="skeleton inline-block h-8 w-16 rounded" /></template>
                <template v-else>{{ summary?.financial.cancellations_count ?? 0 }}</template>
              </p>
              <p class="mt-2 text-xs text-gray-500">
                <template v-if="isLoading"><span class="skeleton inline-block h-3 w-16 rounded" /></template>
                <template v-else-if="showMonetaryValues && (summary?.financial.cancellations_total_cents ?? 0) > 0">
                  {{ formatCents(summary?.financial.cancellations_total_cents ?? 0) }}
                </template>
              </p>
            </div>

            <div
              v-if="viewMode === 'manager'"
              class="rounded-xl bg-white p-4 shadow-sm ring-1 transition-all"
              :class="discountCardClass"
            >
              <span class="mb-1 block text-2xl">🪙</span>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Perda no Troco</p>
              <p class="mt-1 text-3xl leading-none font-bold" :class="discountColor">
                <template v-if="isLoading"><span class="skeleton inline-block h-8 w-24 rounded" /></template>
                <template v-else-if="showMonetaryValues">{{ formatCents(summary?.financial.discount_total_cents ?? 0) }}</template>
                <template v-else>R$ ••••</template>
              </p>
              <p class="mt-2 text-xs text-gray-500">
                <template v-if="isLoading"><span class="skeleton inline-block h-3 w-16 rounded" /></template>
                <template v-else>{{ summary?.financial.discount_occurrences ?? 0 }} arredondamento(s)</template>
              </p>
            </div>

            <div
              v-if="viewMode === 'operator'"
              class="col-span-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 lg:col-span-2"
            >
              <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">🏧 Status do caixa</h2>
              <div v-if="isLoading" class="skeleton h-24 w-full rounded-lg" />
              <div v-else-if="summary?.open_cash_register" class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="h-2 w-2 animate-pulse rounded-full bg-success" />
                  <span class="text-sm font-semibold text-success">Caixa aberto</span>
                </div>
                <p class="text-xs text-gray-500">
                  Aberto às {{ formatTime(summary.open_cash_register.opened_at) }}
                  por {{ summary.open_cash_register.operator_name }}
                </p>
                <p class="text-xs text-gray-500">
                  Fundo inicial:
                  <span class="font-semibold">
                    {{ showMonetaryValues ? formatCents(summary.open_cash_register.initial_amount_cents) : "R$ ••••" }}
                  </span>
                </p>
              </div>
              <div v-else class="space-y-2">
                <p class="text-sm font-semibold text-danger">Caixa fechado</p>
                <p class="text-xs text-gray-500">Abra o caixa para iniciar as operações de venda.</p>
              </div>
            </div>

            <div
              v-if="viewMode === 'operator'"
              class="col-span-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 lg:col-span-2"
            >
              <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">⚡ Acesso rápido</h2>
              <router-link
                to="/sales"
                class="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
              >
                Ir para vendas
              </router-link>
              <p class="mt-2 text-xs text-gray-500">Atalho para iniciar o atendimento no caixa.</p>
            </div>

            <div
              v-if="viewMode === 'operator'"
              class="col-span-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 lg:col-span-4"
            >
              <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">🔔 Notificações críticas</h2>
              <div v-if="isLoading">
                <div v-for="i in 3" :key="`critical-skeleton-${i}`" class="skeleton mb-2 h-12 w-full rounded-lg" />
              </div>
              <ul v-else-if="summary?.critical_notifications?.length" class="space-y-2">
                <li
                  v-for="notification in summary.critical_notifications"
                  :key="notification.id"
                  class="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2"
                >
                  <p class="text-sm font-semibold text-gray-800">{{ notification.title }}</p>
                  <p class="text-xs text-gray-500">{{ notification.message }}</p>
                </li>
              </ul>
              <p v-else class="text-sm text-gray-500">Sem notificações críticas não lidas.</p>
            </div>
          </div>

          <div v-if="viewMode === 'manager'" class="mb-6 grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
            <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 lg:col-span-2">
              <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Como entrou o dinheiro {{ periodLabel }}
              </h2>
              <div v-if="isLoading" class="flex gap-4">
                <span class="skeleton h-32 w-32 rounded-full" />
                <div class="flex flex-col justify-center gap-2">
                  <span v-for="i in 4" :key="i" class="skeleton h-3 w-24 rounded" />
                </div>
              </div>
              <PaymentDonutChart
                v-else
                :data="summary?.financial.by_payment_method ?? {}"
                :show-values="showMonetaryValues"
                @drill-down="handleDrillDown"
              />
            </div>

            <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">⚠️ Faltando na Prateleira</h2>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    @click="printShoppingList"
                  >
                    🛒 Gerar Lista de Compras
                  </button>
                  <router-link to="/products" class="text-xs text-primary hover:underline">
                    Ver todos →
                  </router-link>
                </div>
              </div>
              <div v-if="isLoading">
                <div v-for="i in 3" :key="i" class="skeleton mb-2 h-12 w-full rounded-lg" />
              </div>
              <p
                v-else-if="!summary?.stock_alerts.length"
                class="text-sm text-gray-500"
              >✅ Tudo em estoque.</p>
              <ul v-else class="space-y-2">
                <li
                  v-for="item in summary.stock_alerts"
                  :key="item.product_id"
                  class="flex items-center justify-between rounded-lg bg-danger/5 px-3 py-2"
                >
                  <div>
                    <p class="text-sm font-medium text-gray-800">{{ item.product_name }}</p>
                    <p class="text-xs font-bold text-danger">
                      {{ formatStockQuantity(item.stock_quantity, item.is_bulk) }}
                      <span class="font-normal text-gray-500">
                        / mín. {{ item.is_bulk ? `${item.min_stock_alert} kg` : `${item.min_stock_alert} un` }}
                      </span>
                    </p>
                  </div>
                  <router-link
                    to="/products"
                    class="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Repor
                  </router-link>
                </li>
              </ul>
            </div>

          </div>

          <div v-if="viewMode === 'manager'" class="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
            <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">📒 Fiado vencido</h2>
                <router-link to="/customers" class="text-xs text-primary hover:underline">
                  Ver todos →
                </router-link>
              </div>
              <div v-if="isLoading">
                <div v-for="i in 3" :key="i" class="skeleton mb-2 h-12 w-full rounded-lg" />
              </div>
              <p
                v-else-if="!summary?.overdue_customers.length"
                class="text-sm text-gray-500"
              >✅ Nenhum cliente com fiado vencido.</p>
              <ul v-else class="space-y-2">
                <li
                  v-for="customer in summary.overdue_customers"
                  :key="customer.customer_id"
                  class="flex items-center justify-between rounded-lg bg-warning/5 px-3 py-2"
                >
                  <div>
                    <p class="text-sm font-medium text-gray-800">{{ customer.customer_name }}</p>
                    <p class="text-xs font-bold text-warning">
                      {{ showMonetaryValues ? formatCents(customer.current_debt_cents) : "R$ ••••" }}
                    </p>
                  </div>
                  <button
                    @click="openChargeModal(customer)"
                    class="min-h-11 min-w-11 rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Cobrar
                  </button>
                </li>
              </ul>
            </div>

            <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">🏧 Caixa</h2>
              <div v-if="isLoading" class="skeleton h-24 w-full rounded-lg" />
              <div v-else-if="summary?.open_cash_register" class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="h-2 w-2 animate-pulse rounded-full bg-success" />
                  <span class="text-sm font-semibold text-success">Caixa aberto</span>
                </div>
                <p class="text-xs text-gray-500">
                  Aberto às {{ formatTime(summary.open_cash_register.opened_at) }}
                  por {{ summary.open_cash_register.operator_name }}
                </p>
                <p class="text-xs text-gray-500">
                  Fundo inicial:
                  <span class="font-semibold">
                    {{ showMonetaryValues ? formatCents(summary.open_cash_register.initial_amount_cents) : "R$ ••••" }}
                  </span>
                </p>
              </div>
              <div v-else class="flex flex-col items-center justify-center gap-2 py-4">
                <span class="h-2 w-2 rounded-full bg-danger" />
                <p class="text-sm font-semibold text-danger">Caixa fechado</p>
                <router-link
                  to="/sales"
                  class="flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
                >
                  Abrir caixa
                </router-link>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="rounded-lg bg-white p-4 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
          Sem dados disponíveis.
        </div>

        <Teleport to="body">
          <div
            v-if="showChargeModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            @click.self="showChargeModal = false"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="'charge-modal-title'"
          >
            <div class="mx-auto max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              <h2 id="charge-modal-title" class="mb-4 text-lg font-bold text-gray-900">
                📒 Cobrar fiado
              </h2>
              <p class="mb-1 text-2xl font-bold text-warning">
                {{ showMonetaryValues ? formatCents(selectedCustomer?.current_debt_cents ?? 0) : "R$ ••••" }}
              </p>
              <p class="mb-4 text-sm text-gray-500">{{ selectedCustomer?.customer_name }}</p>
              <a
                v-if="selectedCustomer?.phone"
                :href="`tel:${selectedCustomer.phone}`"
                class="mb-4 flex items-center gap-2 text-sm text-primary hover:underline"
              >
                📞 {{ selectedCustomer.phone }}
              </a>
              <div class="flex flex-col gap-2">
                <button
                  @click="goToPayment"
                  class="min-h-11 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white"
                >
                  Registrar pagamento
                </button>
                <button
                  @click="showChargeModal = false"
                  class="min-h-11 w-full rounded-xl border py-3 text-sm font-medium text-gray-600"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </Teleport>
      </main>
    </div>

  </div>
</template>
