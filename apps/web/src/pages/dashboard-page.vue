<script setup lang="ts">
import { formatCents } from "@pdv/shared";
import { computed, onMounted, ref } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import { useApi } from "@/composables/use-api.js";
import { useFormatting } from "@/composables/use-formatting.js";
import { useAuthStore } from "@/stores/auth.store.js";

interface CashSummary {
  cash_cents: number;
  credit_card_cents: number;
  debit_card_cents: number;
  pix_cents: number;
  fiado_cents: number;
  total_cents: number;
}

interface CustomerRow {
  id: string;
  name: string;
  current_debt_cents: number;
  payment_due_day: number | null;
  is_active: boolean;
}

interface StockRow {
  id: string;
  name: string;
  is_bulk: boolean;
  stock_quantity: number;
  min_stock_alert: number;
  low_stock: boolean;
}

interface CancellationRow {
  id: string;
  created_at: string;
  total_cents: number;
  status: "cancelled" | "refunded";
  terminal_id: string;
  operator: {
    name: string;
  };
}

const { authenticatedFetch } = useApi();
const authStore = useAuthStore();
const { formatStockQuantity } = useFormatting();

const showMonetaryValues = ref(true);
const loading = ref(false);
const loadError = ref<string | null>(null);

const cashSummary = ref<CashSummary>({
  cash_cents: 0,
  credit_card_cents: 0,
  debit_card_cents: 0,
  pix_cents: 0,
  fiado_cents: 0,
  total_cents: 0,
});

const overdueCustomers = ref<CustomerRow[]>([]);
const lowStockRows = ref<StockRow[]>([]);
const latestCancellations = ref<CancellationRow[]>([]);

const canViewDashboard = computed(() => {
  const role = authStore.user?.role;
  return role === "admin" || role === "manager";
});

const paymentDistribution = computed(() => {
  const total = cashSummary.value.total_cents;
  const rows = [
    { key: "cash", label: "Dinheiro", value: cashSummary.value.cash_cents },
    { key: "credit", label: "Cartão Crédito", value: cashSummary.value.credit_card_cents },
    { key: "debit", label: "Cartão Débito", value: cashSummary.value.debit_card_cents },
    { key: "pix", label: "Pix", value: cashSummary.value.pix_cents },
    { key: "fiado", label: "Fiado", value: cashSummary.value.fiado_cents },
  ];

  return rows.map((row) => ({
    ...row,
    percentage: total > 0 ? Math.round((row.value / total) * 100) : 0,
  }));
});

function displayMoney(valueCents: number): string {
  if (!showMonetaryValues.value) {
    return "R$ ••••";
  }

  return formatCents(valueCents);
}

function getTodayRange(): { startDate: string; endDate: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

function isOverdue(customer: CustomerRow): boolean {
  if (!customer.is_active || customer.current_debt_cents <= 0 || !customer.payment_due_day) {
    return false;
  }

  const todayDay = new Date().getDate();
  return todayDay > customer.payment_due_day;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadDashboardData(): Promise<void> {
  if (!canViewDashboard.value) {
    return;
  }

  loading.value = true;
  loadError.value = null;

  try {
    const dateRange = getTodayRange();
    const cashParams = new URLSearchParams({
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    });
    const cancellationParams = new URLSearchParams({
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    });

    const [cashResponse, customersResponse, stockResponse, cancellationsResponse] = await Promise.all([
      authenticatedFetch(`/api/control/cash-summary?${cashParams.toString()}`),
      authenticatedFetch("/api/customers?only_active=false&page=1&per_page=200"),
      authenticatedFetch("/api/control/stock-summary?page=1&per_page=200"),
      authenticatedFetch(`/api/control/cancellations?${cancellationParams.toString()}`),
    ]);

    const [cashJson, customersJson, stockJson, cancellationsJson] = await Promise.all([
      cashResponse.json(),
      customersResponse.json(),
      stockResponse.json(),
      cancellationsResponse.json(),
    ]);

    if (!cashResponse.ok || !customersResponse.ok || !stockResponse.ok || !cancellationsResponse.ok) {
      loadError.value = "Não foi possível carregar todos os indicadores do dashboard.";
      return;
    }

    cashSummary.value = cashJson.data as CashSummary;

    const customers = customersJson.data as CustomerRow[];
    overdueCustomers.value = customers
      .filter((customer) => isOverdue(customer))
      .sort((a, b) => b.current_debt_cents - a.current_debt_cents)
      .slice(0, 8);

    const stockRows = stockJson.data.data as StockRow[];
    lowStockRows.value = stockRows.filter((row) => row.low_stock).slice(0, 8);

    latestCancellations.value = (cancellationsJson.data.data as CancellationRow[]).slice(0, 8);
  } catch {
    loadError.value = "Erro de conexão ao carregar dados do dashboard.";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadDashboardData();
});
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold text-gray-800">Dashboard Gerencial</h1>
          <button
            type="button"
            :aria-label="showMonetaryValues ? 'Ocultar valores monetários' : 'Mostrar valores monetários'"
            class="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            @click="showMonetaryValues = !showMonetaryValues"
          >
            {{ showMonetaryValues ? "👁 Ocultar valores" : "👁 Mostrar valores" }}
          </button>
        </div>

        <div
          v-if="!canViewDashboard"
          class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          Seu perfil não possui acesso ao painel gerencial.
        </div>

        <div
          v-else-if="loadError"
          class="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
          role="alert"
        >
          {{ loadError }}
        </div>

        <div v-else class="mt-6 space-y-6">
          <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article class="rounded-lg border border-gray-200 bg-white p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Vendas do Dia</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ displayMoney(cashSummary.total_cents) }}</p>
            </article>

            <article class="rounded-lg border border-gray-200 bg-white p-4 md:col-span-1 xl:col-span-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Distribuição por Meio de Pagamento</p>
              <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div v-for="row in paymentDistribution" :key="row.key" class="rounded border border-gray-100 p-3">
                  <p class="text-sm text-gray-700">{{ row.label }}</p>
                  <p class="mt-1 text-sm font-semibold text-gray-900">{{ displayMoney(row.value) }}</p>
                  <div class="mt-2 h-2 rounded-full bg-gray-200">
                    <div class="h-2 rounded-full bg-primary" :style="{ width: `${row.percentage}%` }"></div>
                  </div>
                  <p class="mt-1 text-xs text-gray-500">{{ row.percentage }}%</p>
                </div>
              </div>
            </article>
          </section>

          <section class="grid gap-4 xl:grid-cols-3">
            <article class="rounded-lg border border-gray-200 bg-white p-4">
              <h2 class="text-sm font-semibold text-gray-900">Clientes com Fiado em Atraso</h2>
              <ul v-if="!loading" class="mt-3 space-y-2">
                <li v-for="customer in overdueCustomers" :key="customer.id" class="rounded border border-gray-100 p-2">
                  <p class="text-sm font-medium text-gray-900">{{ customer.name }}</p>
                  <p class="text-xs text-gray-600">Dívida: {{ displayMoney(customer.current_debt_cents) }}</p>
                  <p class="text-xs text-amber-700">Vencimento: dia {{ customer.payment_due_day }}</p>
                </li>
                <li v-if="overdueCustomers.length === 0" class="text-sm text-gray-500">Nenhum cliente em atraso hoje.</li>
              </ul>
            </article>

            <article class="rounded-lg border border-gray-200 bg-white p-4">
              <h2 class="text-sm font-semibold text-gray-900">Alertas de Estoque Mínimo</h2>
              <ul v-if="!loading" class="mt-3 space-y-2">
                <li v-for="row in lowStockRows" :key="row.id" class="rounded border border-red-100 bg-red-50/40 p-2">
                  <p class="text-sm font-medium text-gray-900">{{ row.name }}</p>
                  <p class="text-xs text-gray-600">
                    Atual: {{ formatStockQuantity(row.stock_quantity, row.is_bulk) }} | Mínimo: {{ formatStockQuantity(row.min_stock_alert, row.is_bulk) }}
                  </p>
                </li>
                <li v-if="lowStockRows.length === 0" class="text-sm text-gray-500">Nenhum alerta de estoque mínimo.</li>
              </ul>
            </article>

            <article class="rounded-lg border border-gray-200 bg-white p-4">
              <h2 class="text-sm font-semibold text-gray-900">Últimos Cancelamentos/Estornos</h2>
              <ul v-if="!loading" class="mt-3 space-y-2">
                <li v-for="row in latestCancellations" :key="row.id" class="rounded border border-gray-100 p-2">
                  <p class="text-xs text-gray-600">{{ formatDateTime(row.created_at) }} • {{ row.operator.name }}</p>
                  <p class="text-sm font-medium text-gray-900">{{ displayMoney(row.total_cents) }}</p>
                  <p class="text-xs" :class="row.status === 'refunded' ? 'text-amber-700' : 'text-red-700'">
                    {{ row.status === "refunded" ? "Estornado" : "Cancelado" }} • {{ row.terminal_id }}
                  </p>
                </li>
                <li v-if="latestCancellations.length === 0" class="text-sm text-gray-500">Sem registros hoje.</li>
              </ul>
            </article>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>
