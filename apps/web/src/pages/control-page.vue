<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { formatCents, type Brand, type ProductType, type StockMovement } from "@pdv/shared";
import { RecycleScroller } from "vue-virtual-scroller";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import { useApi } from "@/composables/use-api.js";
import { useFormatting } from "@/composables/use-formatting.js";
import { useToast } from "@/composables/use-toast.js";

type TabKey = "stock" | "cash";
type SortDirection = "asc" | "desc";
type StockSortKey = "name" | "type" | "brand" | "stock" | "average_cost" | "stock_value";
type PeriodPreset = "today" | "week" | "month";

interface StockSummaryRow {
  id: string;
  name: string;
  is_bulk: boolean;
  stock_quantity: number;
  min_stock_alert: number;
  average_cost_cents: number;
  stock_value_cents: number;
  low_stock: boolean;
  product_type: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
}

interface StockSummaryResponse {
  data: StockSummaryRow[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  summary: {
    total_items_quantity: number;
    total_bulk_quantity: number;
    bulk_by_type: Array<{
      type_name: string;
      total_kg: number;
    }>;
    total_stock_value_cents: number;
    weighted_avg_cost_cents: number;
    weighted_average_cost_cents: number;
  };
}

interface CashSummary {
  cash_cents: number;
  credit_card_cents: number;
  debit_card_cents: number;
  pix_cents: number;
  fiado_cents: number;
  total_cents: number;
}

interface DiscountSummary {
  total_discount_cents: number;
  occurrences: number;
}

interface DiscountLimits {
  discount_limit_daily: number;
  discount_limit_weekly: number;
  discount_limit_monthly: number;
}

interface CancellationRow {
  id: string;
  created_at: string;
  total_cents: number;
  status: "cancelled" | "refunded";
  terminal_id: string;
  operator_id: string;
  operator: {
    name: string;
  };
}

interface OperatorAlert {
  operator_id: string;
  operator_name: string;
  count: number;
}

const { authenticatedFetch } = useApi();

const activeTab = ref<TabKey>("stock");
const showMonetaryValues = ref(true);

const productTypes = ref<ProductType[]>([]);
const brands = ref<Brand[]>([]);
const loadingFilters = ref(false);

const selectedProductTypeId = ref("");
const selectedBrandId = ref("");

const stockLoading = ref(false);
const stockError = ref<string | null>(null);
const stockRows = ref<StockSummaryRow[]>([]);
const stockPage = ref(1);
const stockPerPage = ref(10);
const stockTotal = ref(0);
const stockTotalPages = ref(0);
const stockSortKey = ref<StockSortKey>("name");
const stockSortDirection = ref<SortDirection>("asc");
const stockSummary = ref<StockSummaryResponse["summary"]>({
  total_items_quantity: 0,
  total_bulk_quantity: 0,
  bulk_by_type: [],
  total_stock_value_cents: 0,
  weighted_avg_cost_cents: 0,
  weighted_average_cost_cents: 0,
});

const showHistoryModal = ref(false);
const historyProduct = ref<StockSummaryRow | null>(null);
const movementLoading = ref(false);
const movementError = ref<string | null>(null);
const stockMovements = ref<StockMovement[]>([]);

const showAdjustmentModal = ref(false);
const adjustmentLoading = ref(false);
const adjustmentError = ref<string | null>(null);
const adjustmentQuantityInput = ref("");
const adjustmentUnitCostInput = ref("");
const adjustmentDescription = ref("");

const periodPreset = ref<PeriodPreset>("today");

const cashLoading = ref(false);
const cashError = ref<string | null>(null);
const cashSummary = ref<CashSummary>({
  cash_cents: 0,
  credit_card_cents: 0,
  debit_card_cents: 0,
  pix_cents: 0,
  fiado_cents: 0,
  total_cents: 0,
});

const discountSummary = ref<DiscountSummary>({
  total_discount_cents: 0,
  occurrences: 0,
});

const discountLimits = ref<DiscountLimits>({
  discount_limit_daily: 0,
  discount_limit_weekly: 0,
  discount_limit_monthly: 0,
});

const discountLimitDailyInput = ref("");
const discountLimitWeeklyInput = ref("");
const discountLimitMonthlyInput = ref("");
const discountLimitSaving = ref(false);

const cancellationsLoading = ref(false);
const cancellationsError = ref<string | null>(null);
const cancellationRows = ref<CancellationRow[]>([]);
const operatorAlertsToday = ref<OperatorAlert[]>([]);

const { showToast, toastMessage, toastType, toast } = useToast();
const { formatCurrencyInput, parseCurrencyInputToCents } = useFormatting();

const stockPagesArray = computed(() => {
  const pages: number[] = [];
  const maxPagesToShow = 5;
  const half = Math.floor(maxPagesToShow / 2);

  let start = Math.max(1, stockPage.value - half);
  let end = Math.min(stockTotalPages.value, start + maxPagesToShow - 1);

  if (end - start + 1 < maxPagesToShow) {
    start = Math.max(1, end - maxPagesToShow + 1);
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
});

const stockTotalUnitDisplay = computed(() => `${stockSummary.value.total_items_quantity} un`);

const stockTotalBulkByTypeDisplay = computed(() => {
  return stockSummary.value.bulk_by_type.map((item) => ({
    type_name: item.type_name,
    total_kg_display: item.total_kg.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }),
  }));
});

const weightedAverageCostCents = computed(() => {
  if (stockSummary.value.weighted_avg_cost_cents > 0) {
    return stockSummary.value.weighted_avg_cost_cents;
  }

  return stockSummary.value.weighted_average_cost_cents;
});

const selectedDiscountLimitCents = computed(() => {
  if (periodPreset.value === "today") {
    return discountLimits.value.discount_limit_daily;
  }

  if (periodPreset.value === "week") {
    return discountLimits.value.discount_limit_weekly;
  }

  return discountLimits.value.discount_limit_monthly;
});

const discountLimitUsagePercent = computed(() => {
  const limit = selectedDiscountLimitCents.value;

  if (limit <= 0) {
    return 0;
  }

  return Math.round((discountSummary.value.total_discount_cents / limit) * 100);
});

const discountLimitStatus = computed(() => {
  const usage = discountLimitUsagePercent.value;

  if (selectedDiscountLimitCents.value <= 0) {
    return { label: "Sem limite configurado", className: "bg-gray-100 text-gray-700" };
  }

  if (usage > 100) {
    return { label: "Limite ultrapassado", className: "bg-red-100 text-red-700" };
  }

  if (usage >= 80) {
    return { label: "Próximo do limite", className: "bg-amber-100 text-amber-700" };
  }

  return { label: "Dentro do limite", className: "bg-green-100 text-green-700" };
});

const topOperatorAlert = computed(() => operatorAlertsToday.value[0] ?? null);

const periodDateRange = computed(() => {
  const now = new Date();

  if (periodPreset.value === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (periodPreset.value === "week") {
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { startDate: start.toISOString(), endDate: end.toISOString() };
});

const paymentDistribution = computed(() => {
  const total = cashSummary.value.total_cents;

  const rows = [
    { key: "cash", label: "Dinheiro", icon: "💵", value: cashSummary.value.cash_cents },
    { key: "credit_card", label: "Cartão de Crédito", icon: "💳", value: cashSummary.value.credit_card_cents },
    { key: "debit_card", label: "Cartão de Débito", icon: "💳", value: cashSummary.value.debit_card_cents },
    { key: "pix", label: "Pix", icon: "📱", value: cashSummary.value.pix_cents },
    { key: "fiado", label: "Fiado", icon: "📒", value: cashSummary.value.fiado_cents },
  ];

  return rows.map((row) => ({
    ...row,
    percentage: total > 0 ? Math.round((row.value / total) * 100) : 0,
  }));
});

onMounted(async () => {
  await loadFilters();
  await loadStockSummary();
});

watch(
  () => [selectedProductTypeId.value, selectedBrandId.value],
  async () => {
    stockPage.value = 1;
    await loadStockSummary();
  },
);

watch(
  () => activeTab.value,
  async (tab) => {
    if (tab === "stock") {
      await loadStockSummary();
      return;
    }

    await loadCashTabData();
  },
);

watch(
  () => periodPreset.value,
  async () => {
    if (activeTab.value !== "cash") {
      return;
    }

    await loadCashTabData();
  },
);

function showSuccessToast(message: string): void {
  toast(message);
}

function formatDateTime(dateTime: string): string {
  const date = new Date(dateTime);
  const datePart = date.toLocaleDateString("pt-BR");
  const timePart = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

function getSortIndicator(key: StockSortKey): string {
  if (stockSortKey.value !== key) {
    return "↕";
  }

  return stockSortDirection.value === "asc" ? "↑" : "↓";
}

function toggleStockSort(key: StockSortKey): void {
  if (stockSortKey.value !== key) {
    stockSortKey.value = key;
    stockSortDirection.value = "asc";
  } else {
    stockSortDirection.value = stockSortDirection.value === "asc" ? "desc" : "asc";
  }

  loadStockSummary();
}

function goToStockPage(page: number): void {
  if (page < 1 || page > stockTotalPages.value || page === stockPage.value) {
    return;
  }

  stockPage.value = page;
  loadStockSummary();
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

function formatMovementQuantity(quantity: number): string {
  const formatted = Math.abs(quantity).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

  if (quantity > 0) {
    return `+${formatted}`;
  }

  return `-${formatted}`;
}

function toStockMovement(item: unknown): StockMovement {
  return item as StockMovement;
}

function movementTypeLabel(type: string): string {
  if (type === "entry") {
    return "Entrada";
  }

  if (type === "sale") {
    return "Venda";
  }

  return "Ajuste";
}

function movementTypeClass(type: string): string {
  if (type === "entry") {
    return "bg-green-100 text-green-700";
  }

  if (type === "sale") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-amber-100 text-amber-700";
}

function cancellationStatusLabel(status: string): string {
  return status === "cancelled" ? "Cancelado" : "Estornado";
}

function cancellationStatusClass(status: string): string {
  return status === "cancelled"
    ? "bg-red-100 text-red-700"
    : "bg-orange-100 text-orange-700";
}

function handleDailyLimitInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  discountLimitDailyInput.value = formatCurrencyInput(target.value);
}

function handleWeeklyLimitInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  discountLimitWeeklyInput.value = formatCurrencyInput(target.value);
}

function handleMonthlyLimitInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  discountLimitMonthlyInput.value = formatCurrencyInput(target.value);
}

function handleAdjustmentUnitCostInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  adjustmentUnitCostInput.value = formatCurrencyInput(target.value);
}

function displayCents(cents: number): string {
  if (!showMonetaryValues.value) {
    return "R$ ••••";
  }

  return formatCents(cents);
}

async function loadFilters(): Promise<void> {
  loadingFilters.value = true;

  try {
    const [productTypesResponse, brandsResponse] = await Promise.all([
      authenticatedFetch("/api/product-types"),
      authenticatedFetch("/api/brands"),
    ]);

    const [productTypesData, brandsData] = await Promise.all([
      productTypesResponse.json(),
      brandsResponse.json(),
    ]);

    if (productTypesResponse.ok) {
      productTypes.value = productTypesData.data as ProductType[];
    }

    if (brandsResponse.ok) {
      brands.value = brandsData.data as Brand[];
    }
  } catch (error) {
    console.error("Erro ao carregar filtros da aba de estoque:", error);
  } finally {
    loadingFilters.value = false;
  }
}

async function loadStockSummary(): Promise<void> {
  stockLoading.value = true;
  stockError.value = null;

  try {
    const params = new URLSearchParams({
      page: String(stockPage.value),
      per_page: String(stockPerPage.value),
      sort_by: stockSortKey.value,
      sort_order: stockSortDirection.value,
    });

    if (selectedProductTypeId.value) {
      params.set("product_type_id", selectedProductTypeId.value);
    }

    if (selectedBrandId.value) {
      params.set("brand_id", selectedBrandId.value);
    }

    const response = await authenticatedFetch(`/api/control/stock-summary?${params.toString()}`);
    const json = await response.json();

    if (!response.ok) {
      stockError.value = json.message || "Não foi possível carregar o resumo de estoque.";
      return;
    }

    const payload = json.data as StockSummaryResponse;
    stockRows.value = payload.data;
    stockSummary.value = payload.summary;
    stockTotal.value = payload.pagination.total;
    stockTotalPages.value = payload.pagination.total_pages;
    stockPage.value = payload.pagination.page;
  } catch (error) {
    console.error("Erro ao carregar resumo de estoque:", error);
    stockError.value = "Erro de conexão ao carregar o estoque.";
  } finally {
    stockLoading.value = false;
  }
}

async function openHistoryModal(product: StockSummaryRow): Promise<void> {
  showHistoryModal.value = true;
  historyProduct.value = product;
  movementError.value = null;
  stockMovements.value = [];

  await loadStockMovements(product.id);
}

function closeHistoryModal(): void {
  showHistoryModal.value = false;
  showAdjustmentModal.value = false;
  historyProduct.value = null;
  adjustmentError.value = null;
  stockMovements.value = [];
}

async function loadStockMovements(productId: string): Promise<void> {
  movementLoading.value = true;
  movementError.value = null;

  try {
    const response = await authenticatedFetch(`/api/stock-movements/${productId}`);
    const json = await response.json();

    if (!response.ok) {
      movementError.value = json.message || "Não foi possível carregar o histórico.";
      return;
    }

    stockMovements.value = (json.data as StockMovement[]).slice(0, 20);
  } catch (error) {
    console.error("Erro ao carregar movimentações de estoque:", error);
    movementError.value = "Erro de conexão ao carregar histórico.";
  } finally {
    movementLoading.value = false;
  }
}

function openAdjustmentModal(): void {
  if (!historyProduct.value) {
    return;
  }

  adjustmentQuantityInput.value = "";
  adjustmentUnitCostInput.value = formatCents(historyProduct.value.average_cost_cents);
  adjustmentDescription.value = "";
  adjustmentError.value = null;
  showAdjustmentModal.value = true;
}

function closeAdjustmentModal(): void {
  showAdjustmentModal.value = false;
  adjustmentError.value = null;
}

async function submitAdjustment(): Promise<void> {
  if (!historyProduct.value) {
    return;
  }

  const quantity = Number.parseFloat(adjustmentQuantityInput.value.replace(",", "."));

  if (!Number.isFinite(quantity) || quantity === 0) {
    adjustmentError.value = "Informe uma quantidade válida diferente de zero.";
    return;
  }

  const unitCostCents = parseCurrencyInputToCents(adjustmentUnitCostInput.value);

  if (unitCostCents < 0) {
    adjustmentError.value = "Informe um custo unitário válido.";
    return;
  }

  if (!adjustmentDescription.value.trim()) {
    adjustmentError.value = "Descrição é obrigatória.";
    return;
  }

  adjustmentLoading.value = true;
  adjustmentError.value = null;

  try {
    const response = await authenticatedFetch("/api/stock-movements/adjustment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: historyProduct.value.id,
        quantity,
        unit_cost_cents: unitCostCents,
        description: adjustmentDescription.value.trim(),
      }),
    });
    const json = await response.json();

    if (!response.ok) {
      adjustmentError.value = json.message || "Não foi possível registrar o ajuste.";
      return;
    }

    closeAdjustmentModal();
    await Promise.all([
      loadStockSummary(),
      loadStockMovements(historyProduct.value.id),
    ]);
    showSuccessToast("Ajuste de estoque registrado com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar ajuste de estoque:", error);
    adjustmentError.value = "Erro de conexão ao registrar ajuste.";
  } finally {
    adjustmentLoading.value = false;
  }
}

async function loadCashTabData(): Promise<void> {
  await Promise.all([
    loadCashSummary(),
    loadDiscountSummary(),
    loadDiscountLimits(),
    loadCancellations(),
  ]);
}

async function loadCashSummary(): Promise<void> {
  cashLoading.value = true;
  cashError.value = null;

  try {
    const params = new URLSearchParams({
      start_date: periodDateRange.value.startDate,
      end_date: periodDateRange.value.endDate,
    });

    const response = await authenticatedFetch(`/api/control/cash-summary?${params.toString()}`);
    const json = await response.json();

    if (!response.ok) {
      cashError.value = json.message || "Não foi possível carregar o resumo de caixa.";
      return;
    }

    cashSummary.value = json.data as CashSummary;
  } catch (error) {
    console.error("Erro ao carregar resumo de caixa:", error);
    cashError.value = "Erro de conexão ao carregar resumo de caixa.";
  } finally {
    cashLoading.value = false;
  }
}

async function loadDiscountSummary(): Promise<void> {
  try {
    const params = new URLSearchParams({
      start_date: periodDateRange.value.startDate,
      end_date: periodDateRange.value.endDate,
    });

    const response = await authenticatedFetch(`/api/control/discount-summary?${params.toString()}`);
    const json = await response.json();

    if (!response.ok) {
      return;
    }

    discountSummary.value = json.data as DiscountSummary;
  } catch (error) {
    console.error("Erro ao carregar resumo de descontos:", error);
  }
}

async function loadDiscountLimits(): Promise<void> {
  try {
    const response = await authenticatedFetch("/api/settings");
    const json = await response.json();

    if (!response.ok) {
      return;
    }

    discountLimits.value = json.data as DiscountLimits;
    discountLimitDailyInput.value = formatCents(discountLimits.value.discount_limit_daily);
    discountLimitWeeklyInput.value = formatCents(discountLimits.value.discount_limit_weekly);
    discountLimitMonthlyInput.value = formatCents(discountLimits.value.discount_limit_monthly);
  } catch (error) {
    console.error("Erro ao carregar limites de desconto:", error);
  }
}

async function saveDiscountLimits(): Promise<void> {
  discountLimitSaving.value = true;

  try {
    const response = await authenticatedFetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        discount_limit_daily: parseCurrencyInputToCents(discountLimitDailyInput.value),
        discount_limit_weekly: parseCurrencyInputToCents(discountLimitWeeklyInput.value),
        discount_limit_monthly: parseCurrencyInputToCents(discountLimitMonthlyInput.value),
      }),
    });
    const json = await response.json();

    if (!response.ok) {
      return;
    }

    discountLimits.value = json.data as DiscountLimits;
    showSuccessToast("Limites de desconto de troco atualizados.");
  } catch (error) {
    console.error("Erro ao salvar limites de desconto:", error);
  } finally {
    discountLimitSaving.value = false;
  }
}

async function loadCancellations(): Promise<void> {
  cancellationsLoading.value = true;
  cancellationsError.value = null;

  try {
    const params = new URLSearchParams({
      start_date: periodDateRange.value.startDate,
      end_date: periodDateRange.value.endDate,
    });

    const response = await authenticatedFetch(`/api/control/cancellations?${params.toString()}`);
    const json = await response.json();

    if (!response.ok) {
      cancellationsError.value = json.message || "Não foi possível carregar cancelamentos e estornos.";
      return;
    }

    cancellationRows.value = json.data.data as CancellationRow[];
    operatorAlertsToday.value = json.data.operator_alerts_today as OperatorAlert[];
  } catch (error) {
    console.error("Erro ao carregar cancelamentos e estornos:", error);
    cancellationsError.value = "Erro de conexão ao carregar cancelamentos.";
  } finally {
    cancellationsLoading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />

    <div class="flex flex-1 flex-col">
      <AppHeader />

      <main class="flex-1 p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-3xl font-bold text-gray-900">Controle</h1>

          <button
            type="button"
            :aria-label="showMonetaryValues ? 'Ocultar valores monetários' : 'Mostrar valores monetários'"
            class="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            @click="showMonetaryValues = !showMonetaryValues"
          >
            {{ showMonetaryValues ? "👁 Ocultar valores" : "👁 Mostrar valores" }}
          </button>
        </div>

        <div class="mt-6 flex items-center gap-2 border-b border-gray-200">
          <button
            type="button"
            :class="[
              'rounded-t-lg px-4 py-2 text-sm font-semibold transition',
              activeTab === 'stock'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ]"
            @click="activeTab = 'stock'"
          >
            Estoque
          </button>

          <button
            type="button"
            :class="[
              'rounded-t-lg px-4 py-2 text-sm font-semibold transition',
              activeTab === 'cash'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ]"
            @click="activeTab = 'cash'"
          >
            Caixa
          </button>
        </div>

        <section v-if="activeTab === 'stock'" class="mt-6 space-y-6">
          <div class="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Tipo de Produto</label>
              <select
                v-model="selectedProductTypeId"
                :disabled="loadingFilters"
                class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos</option>
                <option v-for="type in productTypes" :key="type.id" :value="type.id">
                  {{ type.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Marca</label>
              <select
                v-model="selectedBrandId"
                :disabled="loadingFilters"
                class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todas</option>
                <option v-for="brand in brands" :key="brand.id" :value="brand.id">
                  {{ brand.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <article class="rounded-lg border border-gray-200 bg-white p-4">
              <p class="text-sm font-medium text-gray-600">Total de Itens em Estoque</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ stockTotalUnitDisplay }}</p>
              <div class="mt-3 space-y-1" v-if="stockTotalBulkByTypeDisplay.length > 0">
                <p
                  v-for="bulkRow in stockTotalBulkByTypeDisplay"
                  :key="bulkRow.type_name"
                  class="text-sm text-gray-700"
                >
                  <span class="font-medium">{{ bulkRow.type_name }}:</span>
                  {{ bulkRow.total_kg_display }} kg
                </p>
              </div>
              <p v-else class="mt-3 text-sm text-gray-500">Sem produtos a granel</p>
            </article>

            <article class="rounded-lg border border-gray-200 bg-white p-4">
              <p class="text-sm font-medium text-gray-600">Valor Total do Estoque</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ displayCents(stockSummary.total_stock_value_cents) }}</p>
            </article>

            <article class="rounded-lg border border-gray-200 bg-white p-4">
              <p class="text-sm font-medium text-gray-600">Custo Médio Ponderado Geral</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ displayCents(weightedAverageCostCents) }}</p>
            </article>
          </div>

          <div v-if="stockLoading" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div v-for="index in 8" :key="index" class="h-12 animate-pulse rounded bg-gray-100"></div>
          </div>

          <div
            v-else-if="stockError"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
            role="alert"
          >
            <p>{{ stockError }}</p>
            <button
              type="button"
              class="mt-3 rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
              @click="loadStockSummary"
            >
              Tentar novamente
            </button>
          </div>

          <div
            v-else-if="stockRows.length === 0"
            class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600"
          >
            Nenhum produto encontrado com os filtros selecionados.
          </div>

          <div v-else class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table class="w-full min-w-[1200px]">
              <caption class="sr-only">Resumo e analise de estoque por produto</caption>
              <thead class="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                    @click="toggleStockSort('name')"
                  >
                    <span class="flex items-center gap-2">Nome <span class="text-xs">{{ getSortIndicator('name') }}</span></span>
                  </th>
                  <th
                    scope="col"
                    @click="toggleStockSort('type')"
                    class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  >
                    <span class="flex items-center gap-2">Tipo <span class="text-xs">{{ getSortIndicator('type') }}</span></span>
                  </th>
                  <th
                    scope="col"
                    class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                    @click="toggleStockSort('brand')"
                  >
                    <span class="flex items-center gap-2">Marca <span class="text-xs">{{ getSortIndicator('brand') }}</span></span>
                  </th>
                  <th
                    scope="col"
                    class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                    @click="toggleStockSort('stock')"
                  >
                    <span class="flex items-center gap-2">Estoque <span class="text-xs">{{ getSortIndicator('stock') }}</span></span>
                  </th>
                  <th
                    scope="col"
                    class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                    @click="toggleStockSort('average_cost')"
                  >
                    <span class="flex items-center gap-2">Custo Médio <span class="text-xs">{{ getSortIndicator('average_cost') }}</span></span>
                  </th>
                  <th
                    scope="col"
                    class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                    @click="toggleStockSort('stock_value')"
                  >
                    <span class="flex items-center gap-2">Valor em Estoque <span class="text-xs">{{ getSortIndicator('stock_value') }}</span></span>
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Alerta</th>
                  <th scope="col" class="px-6 py-3 text-center text-sm font-semibold text-gray-700">Histórico</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-gray-200">
                <tr v-for="row in stockRows" :key="row.id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-900">{{ row.name }}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">{{ row.product_type?.name ?? '—' }}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">{{ row.brand?.name ?? '—' }}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">{{ formatStockQuantity(row.stock_quantity, row.is_bulk) }}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">{{ displayCents(row.average_cost_cents) }}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">{{ displayCents(row.stock_value_cents) }}</td>
                  <td class="px-6 py-4 text-sm">
                    <span
                      v-if="row.low_stock"
                      class="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                    >
                      Estoque Baixo
                    </span>
                    <span v-else class="text-gray-400">—</span>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <button
                      type="button"
                      class="rounded p-2 text-primary transition hover:bg-gray-100"
                      :aria-label="`Abrir histórico de ${row.name}`"
                      @click="openHistoryModal(row)"
                    >
                      📋
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="stockRows.length > 0 && stockTotalPages > 1"
            class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
          >
            <div class="text-sm text-gray-600">
              Mostrando
              <span class="font-semibold">{{ (stockPage - 1) * stockPerPage + 1 }}</span>
              –
              <span class="font-semibold">{{ Math.min(stockPage * stockPerPage, stockTotal) }}</span>
              de <span class="font-semibold">{{ stockTotal }}</span> produtos
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="stockPage === 1"
                class="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="goToStockPage(stockPage - 1)"
              >
                ← Anterior
              </button>

              <div class="flex gap-1">
                <button
                  v-for="page in stockPagesArray"
                  :key="page"
                  type="button"
                  :class="[
                    'rounded px-2 py-1 text-sm font-medium transition',
                    page === stockPage
                      ? 'bg-primary text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
                  ]"
                  @click="goToStockPage(page)"
                >
                  {{ page }}
                </button>
              </div>

              <button
                type="button"
                :disabled="stockPage === stockTotalPages"
                class="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="goToStockPage(stockPage + 1)"
              >
                Próxima →
              </button>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'cash'" class="mt-6 space-y-6">
          <div class="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-4">
            <span class="text-sm font-medium text-gray-700">Período:</span>
            <button
              type="button"
              :class="[
                'rounded px-3 py-1.5 text-sm font-medium transition',
                periodPreset === 'today'
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
              ]"
              @click="periodPreset = 'today'"
            >
              Hoje
            </button>
            <button
              type="button"
              :class="[
                'rounded px-3 py-1.5 text-sm font-medium transition',
                periodPreset === 'week'
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
              ]"
              @click="periodPreset = 'week'"
            >
              Esta Semana
            </button>
            <button
              type="button"
              :class="[
                'rounded px-3 py-1.5 text-sm font-medium transition',
                periodPreset === 'month'
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
              ]"
              @click="periodPreset = 'month'"
            >
              Este Mês
            </button>
          </div>

          <div
            v-if="cashError"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
            role="alert"
          >
            {{ cashError }}
          </div>

          <article class="rounded-lg border border-gray-200 bg-white p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-semibold text-gray-900">Descontos de Troco</h2>
              <span
                class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                :class="discountLimitStatus.className"
              >
                {{ discountLimitStatus.label }}
              </span>
            </div>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p class="text-sm text-gray-600">Total de Descontos</p>
                <p class="mt-1 text-2xl font-bold text-gray-900">{{ displayCents(discountSummary.total_discount_cents) }}</p>
              </div>

              <div>
                <p class="text-sm text-gray-600">Número de Ocorrências</p>
                <p class="mt-1 text-2xl font-bold text-gray-900">{{ discountSummary.occurrences }}</p>
              </div>
            </div>

            <div class="mt-4">
              <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Uso do limite selecionado</p>
              <div class="h-2 rounded-full bg-gray-200">
                <div
                  class="h-2 rounded-full bg-primary"
                  :style="{ width: `${Math.min(discountLimitUsagePercent, 100)}%` }"
                ></div>
              </div>
              <p class="mt-1 text-xs text-gray-600">{{ discountLimitUsagePercent }}%</p>
            </div>

            <form class="mt-6 grid gap-3 md:grid-cols-3" @submit.prevent="saveDiscountLimits">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Limite diário (R$)</label>
                <input
                  :value="discountLimitDailyInput"
                  type="text"
                  inputmode="numeric"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleDailyLimitInput"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Limite semanal (R$)</label>
                <input
                  :value="discountLimitWeeklyInput"
                  type="text"
                  inputmode="numeric"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleWeeklyLimitInput"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Limite mensal (R$)</label>
                <input
                  :value="discountLimitMonthlyInput"
                  type="text"
                  inputmode="numeric"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleMonthlyLimitInput"
                />
              </div>

              <div class="md:col-span-3">
                <button
                  type="submit"
                  :disabled="discountLimitSaving"
                  class="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{ discountLimitSaving ? "Salvando..." : "Salvar limites" }}
                </button>
              </div>
            </form>
          </article>

          <article class="rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="text-lg font-semibold text-gray-900">Resumo de Meios de Pagamento</h2>

            <div v-if="cashLoading" class="mt-4 space-y-3">
              <div v-for="index in 5" :key="index" class="h-12 animate-pulse rounded bg-gray-100"></div>
            </div>

            <div v-else class="mt-4 space-y-4">
              <div
                v-for="row in paymentDistribution"
                :key="row.key"
                class="grid gap-2 rounded border border-gray-100 p-3 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p class="text-sm font-medium text-gray-800">{{ row.icon }} {{ row.label }}</p>
                  <div class="mt-2 h-2 rounded-full bg-gray-200">
                    <div class="h-2 rounded-full bg-primary" :style="{ width: `${row.percentage}%` }"></div>
                  </div>
                </div>
                <p class="text-sm font-semibold text-gray-900">{{ displayCents(row.value) }}</p>
              </div>

              <div class="rounded border border-primary/30 bg-primary/5 p-3">
                <p class="text-sm font-medium text-gray-800">Total Geral</p>
                <p class="text-xl font-bold text-gray-900">{{ displayCents(cashSummary.total_cents) }}</p>
              </div>
            </div>
          </article>

          <article class="rounded-lg border border-gray-200 bg-white p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-semibold text-gray-900">Log de Cancelamentos e Estornos</h2>

              <span
                v-if="topOperatorAlert"
                class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
              >
                ⚠️ {{ topOperatorAlert.operator_name }} realizou {{ topOperatorAlert.count }} cancelamentos hoje.
              </span>
            </div>

            <div v-if="cancellationsLoading" class="mt-4 space-y-3">
              <div v-for="index in 4" :key="index" class="h-10 animate-pulse rounded bg-gray-100"></div>
            </div>

            <div
              v-else-if="cancellationsError"
              class="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-danger"
            >
              {{ cancellationsError }}
            </div>

            <div
              v-else-if="cancellationRows.length === 0"
              class="mt-4 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600"
            >
              Nenhum cancelamento ou estorno encontrado no período.
            </div>

            <div v-else class="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <table class="w-full min-w-[760px]">
                <caption class="sr-only">Lista de cancelamentos e estornos no periodo selecionado</caption>
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Data/Hora</th>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Operador</th>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Total</th>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Terminal</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-gray-200">
                  <tr v-for="row in cancellationRows" :key="row.id" class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-700">{{ formatDateTime(row.created_at) }}</td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ row.operator.name }}</td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ displayCents(row.total_cents) }}</td>
                    <td class="px-4 py-3 text-sm">
                      <span
                        class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                        :class="cancellationStatusClass(row.status)"
                      >
                        {{ cancellationStatusLabel(row.status) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ row.terminal_id }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>
    </div>

    <div
      v-if="showHistoryModal && historyProduct"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-history-modal-title"
    >
      <div class="w-full max-w-5xl rounded-lg bg-white shadow-xl">
        <header class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 id="stock-history-modal-title" class="text-lg font-semibold text-gray-900">
            Histórico de Movimentação - {{ historyProduct.name }}
          </h3>
          <button
            type="button"
            aria-label="Fechar modal de historico"
            class="rounded p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            @click="closeHistoryModal"
          >
            ✕
          </button>
        </header>

        <div class="max-h-[60vh] overflow-auto p-6">
          <div v-if="movementLoading" class="space-y-3">
            <div v-for="index in 6" :key="index" class="h-10 animate-pulse rounded bg-gray-100"></div>
          </div>

          <div
            v-else-if="movementError"
            class="rounded border border-red-200 bg-red-50 p-4 text-sm text-danger"
          >
            {{ movementError }}
          </div>

          <div
            v-else-if="stockMovements.length === 0"
            class="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600"
          >
            Nenhuma movimentação encontrada para este produto.
          </div>

          <div v-else class="rounded-lg border border-gray-200">
            <div class="grid grid-cols-[180px_120px_120px_140px_minmax(0,1fr)] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <span>Data/Hora</span>
              <span>Tipo</span>
              <span>Quantidade</span>
              <span>Custo Unit.</span>
              <span>Descrição</span>
            </div>

            <RecycleScroller
              :items="stockMovements"
              key-field="id"
              :item-size="56"
              class="max-h-[52vh] overflow-auto"
              list-tag="div"
              item-tag="div"
            >
              <template #default="{ item: movement }">
                <div class="grid grid-cols-[180px_120px_120px_140px_minmax(0,1fr)] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm hover:bg-gray-50">
                  <span class="text-gray-700">{{ formatDateTime(toStockMovement(movement).created_at) }}</span>
                  <span>
                    <span
                      class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                      :class="movementTypeClass(toStockMovement(movement).type)"
                    >
                      {{ movementTypeLabel(toStockMovement(movement).type) }}
                    </span>
                  </span>
                  <span class="text-gray-700">{{ formatMovementQuantity(toStockMovement(movement).quantity) }}</span>
                  <span class="text-gray-700">{{ displayCents(toStockMovement(movement).unit_cost_cents) }}</span>
                  <span class="truncate text-gray-700" :title="toStockMovement(movement).description || '—'">{{ toStockMovement(movement).description || '—' }}</span>
                </div>
              </template>
            </RecycleScroller>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            class="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
            @click="openAdjustmentModal"
          >
            + Registrar Ajuste
          </button>
        </footer>
      </div>
    </div>

    <div
      v-if="showAdjustmentModal"
      class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-adjustment-modal-title"
    >
      <div class="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <header class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 id="stock-adjustment-modal-title" class="text-lg font-semibold text-gray-900">Registrar Ajuste Manual</h3>
          <button
            type="button"
            aria-label="Fechar modal de ajuste de estoque"
            class="rounded p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            @click="closeAdjustmentModal"
          >
            ✕
          </button>
        </header>

        <form class="space-y-4 p-6" @submit.prevent="submitAdjustment">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Quantidade (positivo/negativo)</label>
            <input
              v-model="adjustmentQuantityInput"
              type="text"
              inputmode="decimal"
              placeholder="Ex.: 5 ou -2"
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Custo unitário (R$)</label>
            <input
              :value="adjustmentUnitCostInput"
              type="text"
              inputmode="numeric"
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              @input="handleAdjustmentUnitCostInput"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
            <textarea
              v-model="adjustmentDescription"
              rows="3"
              placeholder="Ex.: Ajuste - Avaria"
              class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            ></textarea>
          </div>

          <p v-if="adjustmentError" class="text-sm text-danger">{{ adjustmentError }}</p>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              @click="closeAdjustmentModal"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="adjustmentLoading"
              class="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ adjustmentLoading ? 'Salvando...' : 'Salvar Ajuste' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="showToast"
      :role="toastType === 'error' ? 'alert' : 'status'"
      :aria-live="toastType === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true"
      :class="[
        'fixed right-4 bottom-4 z-50 rounded px-4 py-2 text-sm text-white shadow-lg',
        toastType === 'error' ? 'bg-danger' : toastType === 'warning' ? 'bg-warning' : 'bg-success',
      ]"
    >
      {{ toastMessage }}
    </div>
  </div>
</template>
