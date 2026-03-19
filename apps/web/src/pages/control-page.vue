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
    weighted_avg_cost_unit_cents: number;
    weighted_average_cost_unit_cents: number;
    weighted_avg_cost_bulk_cents: number;
    weighted_average_cost_bulk_cents: number;
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
  weighted_avg_cost_unit_cents: 0,
  weighted_average_cost_unit_cents: 0,
  weighted_avg_cost_bulk_cents: 0,
  weighted_average_cost_bulk_cents: 0,
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

const weightedAverageUnitCostCents = computed(() => {
  if (stockSummary.value.weighted_avg_cost_unit_cents > 0) {
    return stockSummary.value.weighted_avg_cost_unit_cents;
  }

  return stockSummary.value.weighted_average_cost_unit_cents;
});

const weightedAverageBulkCostCents = computed(() => {
  if (stockSummary.value.weighted_avg_cost_bulk_cents > 0) {
    return stockSummary.value.weighted_avg_cost_bulk_cents;
  }

  return stockSummary.value.weighted_average_cost_bulk_cents;
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
  () => [selectedProductTypeId.value, selectedBrandId.value, stockPerPage.value],
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

  stockPage.value = 1;
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

      <main class="flex-1 p-3 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Controle</h1>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              :aria-label="showMonetaryValues ? 'Ocultar valores' : 'Mostrar valores'"
              class="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-surface"
              @click="showMonetaryValues = !showMonetaryValues"
            >
              {{ showMonetaryValues ? "👁" : "🙈" }}
            </button>
          </div>
        </div>

        <div class="mt-6 overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <div class="flex min-w-max gap-1 border-b border-gray-200 md:min-w-0">
            <button
              type="button"
              :class="[
                'min-h-11 whitespace-nowrap rounded-t-lg px-5 py-2 text-sm font-semibold transition',
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
                'min-h-11 whitespace-nowrap rounded-t-lg px-5 py-2 text-sm font-semibold transition',
                activeTab === 'cash'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
              @click="activeTab = 'cash'"
            >
              Caixa
            </button>
          </div>
        </div>

        <section v-if="activeTab === 'stock'" class="mt-6 space-y-6">
          <div class="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Tipo de Produto</label>
              <select
                v-model="selectedProductTypeId"
                :disabled="loadingFilters"
                class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todas</option>
                <option v-for="brand in brands" :key="brand.id" :value="brand.id">
                  {{ brand.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <article class="rounded-xl border border-gray-200 bg-white p-4">
              <p class="text-sm font-medium text-gray-500">Total em estoque</p>
              <p class="mt-1 wrap-break-word text-2xl font-bold text-gray-900 sm:text-3xl">{{ stockTotalUnitDisplay }}</p>
              <div class="mt-2 space-y-0.5" v-if="stockTotalBulkByTypeDisplay.length > 0">
                <p
                  v-for="bulkRow in stockTotalBulkByTypeDisplay"
                  :key="bulkRow.type_name"
                  class="text-sm text-gray-600"
                >
                  <span class="font-medium">{{ bulkRow.type_name }}:</span>
                  {{ bulkRow.total_kg_display }} kg
                </p>
              </div>
              <p v-else class="mt-2 text-xs text-gray-400">Sem produtos a granel</p>
            </article>

            <article class="rounded-xl border border-gray-200 bg-white p-4">
              <p class="text-sm font-medium text-gray-500">Valor total do estoque</p>
              <p class="mt-1 wrap-break-word text-2xl font-bold text-gray-900 sm:text-3xl">{{ displayCents(stockSummary.total_stock_value_cents) }}</p>
            </article>

            <article class="rounded-xl border border-gray-200 bg-white p-4">
              <p class="text-sm font-medium text-gray-500">Custo médio ponderado</p>
              <div class="mt-3 space-y-3">
                <div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <span class="text-sm text-gray-500">Unidade</span>
                  <p class="wrap-break-word text-right text-lg font-bold text-gray-900 sm:text-2xl">
                    <template v-if="stockSummary.total_items_quantity > 0">
                      {{ displayCents(weightedAverageUnitCostCents) }}
                      <span class="ml-1 text-xs font-medium text-gray-500">/un</span>
                    </template>
                    <span v-else class="text-sm font-medium text-gray-400">Sem produtos</span>
                  </p>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <span class="text-sm text-gray-500">Granel</span>
                  <p class="wrap-break-word text-right text-lg font-bold text-gray-900 sm:text-2xl">
                    <template v-if="stockSummary.total_bulk_quantity > 0">
                      {{ displayCents(weightedAverageBulkCostCents) }}
                      <span class="ml-1 text-xs font-medium text-gray-500">/kg</span>
                    </template>
                    <span v-else class="text-sm font-medium text-gray-400">Sem produtos</span>
                  </p>
                </div>
              </div>
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

          <div v-else>
            <div class="mb-4 flex items-center justify-end">
              <label for="stockPerPage" class="mr-2 text-sm font-medium text-gray-700">Itens por página:</label>
              <select
                id="stockPerPage"
                v-model="stockPerPage"
                class="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>

            <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
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

            <ul class="space-y-2 md:hidden">
              <li
                v-for="row in stockRows"
                :key="row.id"
                class="rounded-xl border bg-white p-4 shadow-sm"
                :class="row.low_stock ? 'border-danger/30' : 'border-gray-200'"
              >
                <div class="mb-3 flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-base font-semibold text-gray-900">{{ row.name }}</p>
                    <p class="mt-0.5 text-xs text-gray-400">
                      {{ row.product_type?.name ?? '—' }}
                      {{ row.brand ? `· ${row.brand.name}` : '' }}
                    </p>
                  </div>
                  <span
                    v-if="row.low_stock"
                    class="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger"
                  >
                    ⚠️ Baixo
                  </span>
                </div>

                <div class="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Estoque</p>
                    <p class="text-sm font-bold" :class="row.low_stock ? 'text-danger' : 'text-gray-800'">
                      {{ formatStockQuantity(row.stock_quantity, row.is_bulk) }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Custo médio</p>
                    <p class="text-sm font-bold text-gray-700">
                      {{ displayCents(row.average_cost_cents) }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Valor total</p>
                    <p class="text-sm font-bold text-primary">
                      {{ displayCents(row.stock_value_cents) }}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  class="min-h-11 w-full rounded-lg border border-gray-200 text-sm font-medium text-primary transition hover:bg-primary/5"
                  :aria-label="`Ver histórico de movimentação de ${row.name}`"
                  @click="openHistoryModal(row)"
                >
                  📋 Ver histórico
                </button>
              </li>
            </ul>
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
                class="min-h-11 inline-flex items-center rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                    'min-h-11 min-w-11 inline-flex items-center justify-center rounded px-2 py-1 text-sm font-medium transition',
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
                class="min-h-11 inline-flex items-center rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="goToStockPage(stockPage + 1)"
              >
                Próxima →
              </button>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'cash'" class="mt-6 space-y-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <span class="mb-2 block text-sm font-medium text-gray-700">Período:</span>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in ['today', 'week', 'month']"
                  :key="preset"
                  type="button"
                  :class="[
                    'h-9 rounded-lg px-4 text-sm font-medium transition',
                    periodPreset === preset
                      ? 'bg-primary text-white'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-surface',
                  ]"
                  :aria-pressed="periodPreset === preset"
                  @click="periodPreset = preset as PeriodPreset"
                >
                  {{ preset === 'today' ? 'Hoje' : preset === 'week' ? 'Esta Semana' : 'Este Mês' }}
                </button>
              </div>
            </div>

            <div class="flex flex-col sm:items-end rounded bg-gray-50 px-4 py-2">
              <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Descontos Concedidos</span>
              <p class="mt-0.5 flex items-baseline gap-2">
                <span class="text-lg font-bold text-gray-900">{{ displayCents(discountSummary.total_discount_cents) }}</span>
                <span class="text-xs text-gray-500">({{ discountSummary.occurrences }}x)</span>
              </p>
            </div>
          </div>

          <div
            v-if="cashError"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
            role="alert"
          >
            {{ cashError }}
          </div>

          <article class="flex flex-col rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="text-lg font-semibold text-gray-900">Resumo de Meios de Pagamento</h2>

            <div v-if="cashLoading" class="mt-4 space-y-3">
              <div v-for="index in 5" :key="index" class="h-12 animate-pulse rounded bg-gray-100"></div>
            </div>

            <div v-else class="mt-4 flex-1 space-y-4">
              <div
                v-for="row in paymentDistribution"
                :key="row.key"
                class="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-800">{{ row.icon }} {{ row.label }}</p>
                  <div class="mt-1.5 h-1.5 rounded-full bg-gray-200">
                    <div class="h-1.5 rounded-full bg-primary transition-all" :style="{ width: `${row.percentage}%` }"></div>
                  </div>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-bold text-gray-900">{{ displayCents(row.value) }}</p>
                  <p class="text-xs text-gray-400">{{ row.percentage }}%</p>
                </div>
              </div>

              <div class="mt-auto rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-semibold text-gray-700">Total Geral</p>
                  <p class="text-xl font-bold text-gray-900">{{ displayCents(cashSummary.total_cents) }}</p>
                </div>
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

            <div v-else class="mt-4">
              <div class="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
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

              <ul class="space-y-2 md:hidden">
                <li
                  v-for="row in cancellationRows"
                  :key="row.id"
                  class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div class="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p class="text-sm font-semibold text-gray-800">
                        {{ formatDateTime(row.created_at) }}
                      </p>
                      <p class="mt-0.5 text-xs text-gray-400">
                        {{ row.operator.name }} · {{ row.terminal_id }}
                      </p>
                    </div>
                    <span
                      class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                      :class="cancellationStatusClass(row.status)"
                    >
                      {{ cancellationStatusLabel(row.status) }}
                    </span>
                  </div>

                  <p class="text-lg font-bold text-gray-900">
                    {{ displayCents(row.total_cents) }}
                  </p>
                </li>
              </ul>
            </div>
          </article>
        </section>
      </main>
    </div>

    <div
      v-if="showHistoryModal && historyProduct"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-history-modal-title"
      @click.self="closeHistoryModal"
    >
      <div class="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-5xl sm:rounded-2xl">
        <div class="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-gray-200 sm:hidden" aria-hidden="true" />

        <header class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6">
          <h3 id="stock-history-modal-title" class="truncate text-base font-semibold text-gray-900 sm:text-lg">
            Movimentação - {{ historyProduct.name }}
          </h3>
          <button
            type="button"
            aria-label="Fechar"
            class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
            @click="closeHistoryModal"
          >
            ✕
          </button>
        </header>

        <div v-if="movementLoading" class="flex-1 space-y-3 overflow-auto p-4 sm:p-6">
          <div v-for="index in 6" :key="index" class="h-10 animate-pulse rounded bg-gray-100"></div>
        </div>

        <div
          v-else-if="movementError"
          class="m-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-danger sm:m-6"
        >
          {{ movementError }}
        </div>

        <div
          v-else-if="stockMovements.length === 0"
          class="m-4 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 sm:m-6"
        >
          Nenhuma movimentação encontrada para este produto.
        </div>

        <template v-else>
          <div class="hidden flex-1 overflow-auto p-6 md:block">
            <div class="rounded-lg border border-gray-200">
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

          <ul class="flex-1 divide-y divide-gray-100 overflow-y-auto px-4 md:hidden">
            <li v-for="movement in stockMovements" :key="movement.id" class="py-3">
              <div class="mb-1 flex items-start justify-between gap-2">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="movementTypeClass(toStockMovement(movement).type)"
                >
                  {{ movementTypeLabel(toStockMovement(movement).type) }}
                </span>
                <span class="text-xs text-gray-400">
                  {{ formatDateTime(toStockMovement(movement).created_at) }}
                </span>
              </div>
              <div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                <p class="text-xs text-gray-500">
                  Quantidade:
                  <span class="font-semibold text-gray-800">
                    {{ formatMovementQuantity(toStockMovement(movement).quantity) }}
                  </span>
                </p>
                <p class="text-xs text-gray-500">
                  Custo unit.:
                  <span class="font-semibold text-gray-800">
                    {{ displayCents(toStockMovement(movement).unit_cost_cents) }}
                  </span>
                </p>
              </div>
              <p
                v-if="toStockMovement(movement).description"
                class="mt-1 truncate text-xs text-gray-500"
              >
                {{ toStockMovement(movement).description }}
              </p>
            </li>
          </ul>
        </template>

        <footer class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-4 py-4 sm:px-6">
          <button
            type="button"
            class="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-dark sm:w-auto"
            @click="openAdjustmentModal"
          >
            + Registrar Ajuste
          </button>
        </footer>
      </div>
    </div>

    <div
      v-if="showAdjustmentModal"
      class="fixed inset-0 z-60 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-adjustment-modal-title"
      @click.self="closeAdjustmentModal"
    >
      <div class="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div class="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-gray-200 sm:hidden" aria-hidden="true" />

        <header class="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6">
          <h3 id="stock-adjustment-modal-title" class="text-base font-semibold text-gray-900 sm:text-lg">Registrar Ajuste Manual</h3>
          <button
            type="button"
            aria-label="Fechar modal de ajuste de estoque"
            class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
            @click="closeAdjustmentModal"
          >
            ✕
          </button>
        </header>

        <form class="flex flex-1 flex-col overflow-y-auto" @submit.prevent="submitAdjustment">
          <div class="space-y-4 px-4 py-4 sm:px-6">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Quantidade (positivo/negativo)</label>
            <input
              v-model="adjustmentQuantityInput"
              type="text"
              inputmode="decimal"
              placeholder="Ex.: 5 ou -2"
              class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Custo unitário (R$)</label>
            <input
              :value="adjustmentUnitCostInput"
              type="text"
              inputmode="numeric"
              class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              @input="handleAdjustmentUnitCostInput"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
            <textarea
              v-model="adjustmentDescription"
              rows="3"
              placeholder="Ex.: Ajuste - Avaria"
              class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            ></textarea>
          </div>

          <p v-if="adjustmentError" class="text-sm text-danger">{{ adjustmentError }}</p>
          </div>

          <div class="flex flex-col-reverse gap-2 border-t border-gray-200 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              class="min-h-11 w-full rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
              @click="closeAdjustmentModal"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="adjustmentLoading"
              class="min-h-11 w-full rounded-lg bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {{ adjustmentLoading ? 'Salvando...' : 'Confirmar Ajuste' }}
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
