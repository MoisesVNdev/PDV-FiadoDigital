<script setup lang="ts">
import { formatCents, PAYMENT_METHODS, type SaleWithPayments } from "@pdv/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import ConfirmDialog from "@/components/layout/confirm-dialog.vue";
import { useApi } from "@/composables/use-api.js";
import { useConfirm } from "@/composables/use-confirm.js";
import { useCustomerDomain } from "@/composables/use-customer-domain.js";
import { useFormatting } from "@/composables/use-formatting.js";
import { useModalStack } from "@/composables/use-modal-stack.js";
import { useToast } from "@/composables/use-toast.js";
import { useCustomerStore } from "@/stores/customer.store.js";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  credit_limit_cents: number;
  current_debt_cents: number;
  payment_due_day: number | null;
  is_active: boolean;
}

interface FormData {
  name: string;
  phone: string;
  credit_limit_input: string;
  payment_due_day: string;
  is_active: boolean;
}

interface FormErrors {
  name?: string[];
  phone?: string[];
  credit_limit_cents?: string[];
  payment_due_day?: string[];
  is_active?: string[];
  submit?: string;
}

interface PaymentFormData {
  amount_input: string;
  pin: string;
}

interface PaymentFormErrors {
  amount_cents?: string[];
  pin?: string[];
  submit?: string;
}

type WhatsAppChargeType = "full" | "partial";

interface WhatsAppFormData {
  charge_type: WhatsAppChargeType;
  amount_input: string;
}

interface WhatsAppFormErrors {
  amount_cents?: string[];
  submit?: string;
}

type SortBy = "name" | "credit_limit_cents" | "payment_due_day" | "current_debt_cents" | "is_active";
type SortOrder = "asc" | "desc";
type TabKey = "customers" | "purchase-history" | "payment-history";

interface FiadoHistorySummary {
  fiado_period_cents: number;
  fiado_open_cents: number;
  fiado_paid_cents: number;
}

interface FiadoPaymentHistorySummary {
  total_paid_period_cents: number;
  fiado_open_cents: number;
}

interface PaymentHistoryRow {
  id: string;
  amount_cents: number;
  debt_before_cents: number | null;
  description: string | null;
  created_at: string;
}

const { authenticatedFetch } = useApi();
const customerStore = useCustomerStore();

const activeTab = ref<TabKey>("customers");

const customers = ref<Customer[]>([]);
const loadingList = ref(false);
const listError = ref<string | null>(null);
const currentPage = ref(1);
const perPage = ref(10);
const totalCustomers = ref(0);
const totalPages = ref(0);

const searchInput = ref("");
const sortBy = ref<SortBy>("name");
const sortOrder = ref<SortOrder>("asc");

let searchTimeoutId: ReturnType<typeof setTimeout> | null = null;

const showModal = ref(false);
const isEditMode = ref(false);
const editingId = ref<string | null>(null);
const originalIsActive = ref(true);
const loadingSubmit = ref(false);

const showPaymentModal = ref(false);
const selectedPaymentCustomer = ref<Customer | null>(null);
const paymentFormData = ref<PaymentFormData>({
  amount_input: "",
  pin: "",
});
const paymentFormErrors = ref<PaymentFormErrors>({});
const paymentLoading = ref(false);

const showWhatsAppModal = ref(false);
const selectedWhatsAppCustomer = ref<Customer | null>(null);
const whatsAppFormData = ref<WhatsAppFormData>({
  charge_type: "full",
  amount_input: "",
});
const whatsAppFormErrors = ref<WhatsAppFormErrors>({});

const whatsappMessageVencido = ref(
  "Olá [NOME], notamos que o seu fiado de [TOTAL] venceu em [VENCIMENTO]. Como podemos te ajudar a regularizar?",
);
const whatsappMessageAVencer = ref(
  "Olá [NOME], passando para lembrar que o seu fiado de [TOTAL] vence em [VENCIMENTO]. Se precisar, estamos à disposição.",
);
const whatsappDuePartialMessage = ref(
  "Olá [NOME], passando para lembrar que o seu fiado de [TOTAL] vence em [VENCIMENTO]. Sua cobrança atual é de [COBRANCA]. Se precisar, estamos à disposição.",
);
const whatsappOverduePartialMessage = ref(
  "Olá [NOME], notamos que o seu fiado de [TOTAL] venceu em [VENCIMENTO]. Falta um pagamento de [COBRANCA]. Como podemos te ajudar a regularizar?",
);

const { showToast, toastMessage, toastType, toast } = useToast();
const { showConfirm, confirmTitle, confirmMessage, confirmLabel, confirm, onConfirm, onCancel } = useConfirm();
const { formatPhoneForDisplay, formatPhoneForInput, normalizePhoneDigits } = useFormatting();
const {
  getPaymentHistoryTypeLabel,
  getPaymentHistoryDebtBeforeCents,
  buildCustomerPayload,
  buildWhatsAppChargeMessage,
} = useCustomerDomain();

const allCustomersForHistory = ref<Customer[]>([]);
const loadingHistoryCustomers = ref(false);
const historyCustomersError = ref<string | null>(null);
const historyCustomerSearchInput = ref("");
const showHistoryCustomerDropdown = ref(false);
const selectedHistoryCustomer = ref<Customer | null>(null);

const fiadoHistoryRows = ref<SaleWithPayments[]>([]);
const loadingFiadoHistory = ref(false);
const fiadoHistoryError = ref<string | null>(null);
const fiadoHistoryPage = ref(1);
const fiadoHistoryPerPage = ref(10);
const fiadoHistoryTotal = ref(0);
const fiadoHistoryTotalPages = ref(0);
const fiadoHistorySummary = ref<FiadoHistorySummary>({
  fiado_period_cents: 0,
  fiado_open_cents: 0,
  fiado_paid_cents: 0,
});

const paymentHistoryRows = ref<PaymentHistoryRow[]>([]);
const loadingPaymentHistory = ref(false);
const paymentHistoryError = ref<string | null>(null);
const paymentHistoryPage = ref(1);
const paymentHistoryPerPage = ref(10);
const paymentHistoryTotal = ref(0);
const paymentHistoryTotalPages = ref(0);
const paymentHistorySummary = ref<FiadoPaymentHistorySummary>({
  total_paid_period_cents: 0,
  fiado_open_cents: 0,
});

const currentDate = new Date();
const selectedHistoryMonth = ref(currentDate.getMonth() + 1);
const selectedHistoryYear = ref(currentDate.getFullYear());

const showReceiptModal = ref(false);
const selectedReceiptSale = ref<SaleWithPayments | null>(null);

const debtVisibilityByCustomerId = ref<Record<string, boolean>>({});

const formData = ref<FormData>({
  name: "",
  phone: "",
  credit_limit_input: formatCents(0),
  payment_due_day: "",
  is_active: true,
});

const formErrors = ref<FormErrors>({});

const totalPagesArray = computed(() => {
  const pages = [];
  const maxPagesToShow = 5;
  const half = Math.floor(maxPagesToShow / 2);

  let start = Math.max(1, currentPage.value - half);
  let end = Math.min(totalPages.value, start + maxPagesToShow - 1);

  if (end - start + 1 < maxPagesToShow) {
    start = Math.max(1, end - maxPagesToShow + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
});

const fiadoHistoryPagesArray = computed(() => {
  const pages = [];
  const maxPagesToShow = 5;
  const half = Math.floor(maxPagesToShow / 2);

  let start = Math.max(1, fiadoHistoryPage.value - half);
  let end = Math.min(fiadoHistoryTotalPages.value, start + maxPagesToShow - 1);

  if (end - start + 1 < maxPagesToShow) {
    start = Math.max(1, end - maxPagesToShow + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
});

const paymentHistoryPagesArray = computed(() => {
  const pages = [];
  const maxPagesToShow = 5;
  const half = Math.floor(maxPagesToShow / 2);

  let start = Math.max(1, paymentHistoryPage.value - half);
  let end = Math.min(paymentHistoryTotalPages.value, start + maxPagesToShow - 1);

  if (end - start + 1 < maxPagesToShow) {
    start = Math.max(1, end - maxPagesToShow + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
});

const monthOptions = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => currentYear - index);
});

const filteredHistoryCustomers = computed(() => {
  const term = historyCustomerSearchInput.value.trim().toLowerCase();

  if (!term) {
    return allCustomersForHistory.value.slice(0, 12);
  }

  return allCustomersForHistory.value
    .filter((customer) => {
      return (
        customer.name.toLowerCase().includes(term) ||
        (customer.phone || "").includes(term)
      );
    })
    .slice(0, 12);
});

onMounted(async () => {
  await loadCustomers();
  loadWhatsAppSettings();
  window.addEventListener("keydown", handleEscapeKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleEscapeKey);
  if (searchTimeoutId) clearTimeout(searchTimeoutId);
});

watch(() => searchInput.value, () => {
  currentPage.value = 1;
  debouncedSearch();
});

watch(
  () => activeTab.value,
  async (tab) => {
    if (tab !== "purchase-history" && tab !== "payment-history") {
      return;
    }

    if (allCustomersForHistory.value.length === 0) {
      await loadHistoryCustomers();
    }

    if (!selectedHistoryCustomer.value) {
      return;
    }

    if (tab === "purchase-history") {
      await loadFiadoHistory();
      return;
    }

    await loadPaymentHistory();
  },
);

watch(
  () => [selectedHistoryMonth.value, selectedHistoryYear.value],
  async () => {
    if (!selectedHistoryCustomer.value) {
      return;
    }

    fiadoHistoryPage.value = 1;
    paymentHistoryPage.value = 1;

    if (activeTab.value === "purchase-history") {
      await loadFiadoHistory();
      return;
    }

    if (activeTab.value === "payment-history") {
      await loadPaymentHistory();
    }
  },
);

function handleEscapeKey(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  if (showHistoryCustomerDropdown.value) {
    showHistoryCustomerDropdown.value = false;
  }
}

function formatDateDay(dateTime: string): string {
  const date = new Date(dateTime);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatTime(dateTime: string): string {
  const date = new Date(dateTime);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTimeWithConnector(dateTime: string): string {
  const date = new Date(dateTime);
  const datePart = date.toLocaleDateString("pt-BR");
  const timePart = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} às ${timePart}`;
}

function getPaymentMethodLabel(method: string): string {
  if (method === PAYMENT_METHODS.CASH) {
    return "Dinheiro";
  }

  if (method === PAYMENT_METHODS.PIX) {
    return "Pix";
  }

  if (method === PAYMENT_METHODS.CREDIT_CARD) {
    return "Cartão de Crédito";
  }

  if (method === PAYMENT_METHODS.DEBIT_CARD) {
    return "Cartão de Débito";
  }

  if (method === PAYMENT_METHODS.FIADO) {
    return "Fiado";
  }

  return method;
}

function getFiadoAmountCents(sale: SaleWithPayments): number {
  const fiadoPayment = sale.payments?.find((payment) => payment.method === PAYMENT_METHODS.FIADO);

  if (fiadoPayment) {
    return fiadoPayment.amount_cents;
  }

  return sale.payment_method === PAYMENT_METHODS.FIADO ? sale.total_cents : 0;
}

function getPaymentTypeLabel(sale: SaleWithPayments): string {
  if (sale.payment_method === PAYMENT_METHODS.FIADO) {
    return "fiado";
  }

  const uniqueMethods = Array.from(new Set(sale.payments.map((payment) => payment.method)));

  if (uniqueMethods.length <= 1) {
    return "fiado + outro";
  }

  return uniqueMethods.map((method) => getPaymentMethodLabel(method).toLowerCase()).join(" + ");
}

function getReceiptItemName(productName: string): string {
  return productName.trim() || "Produto não identificado";
}

function getUnitPriceFromItem(item: SaleWithPayments["items"][number]): number {
  return item.unit_price_cents;
}

function openHistoryCustomerDropdown(): void {
  showHistoryCustomerDropdown.value = true;
}

function selectHistoryCustomer(customer: Customer): void {
  selectedHistoryCustomer.value = customer;
  historyCustomerSearchInput.value = customer.name;
  showHistoryCustomerDropdown.value = false;
  fiadoHistoryPage.value = 1;
  paymentHistoryPage.value = 1;

  if (activeTab.value === "payment-history") {
    loadPaymentHistory();
    return;
  }

  loadFiadoHistory();
}

function clearSelectedHistoryCustomer(): void {
  selectedHistoryCustomer.value = null;
  historyCustomerSearchInput.value = "";
  fiadoHistoryRows.value = [];
  fiadoHistoryError.value = null;
  fiadoHistoryTotal.value = 0;
  fiadoHistoryTotalPages.value = 0;
  fiadoHistorySummary.value = {
    fiado_period_cents: 0,
    fiado_open_cents: 0,
    fiado_paid_cents: 0,
  };
  paymentHistoryRows.value = [];
  paymentHistoryError.value = null;
  paymentHistoryTotal.value = 0;
  paymentHistoryTotalPages.value = 0;
  paymentHistorySummary.value = {
    total_paid_period_cents: 0,
    fiado_open_cents: 0,
  };
}

function openReceiptModal(sale: SaleWithPayments): void {
  selectedReceiptSale.value = sale;
  showReceiptModal.value = true;
}

function closeReceiptModal(): void {
  selectedReceiptSale.value = null;
  showReceiptModal.value = false;
}

function printReceipt(): void {
  window.print();
}

function handlePhoneInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  formData.value.phone = formatPhoneForInput(target.value);
}

function parseCurrencyToCents(rawValue: string): number | null {
  const digitsOnly = rawValue.replace(/\D/g, "");

  if (!digitsOnly) {
    return null;
  }

  return Number.parseInt(digitsOnly, 10);
}

function handleCreditLimitInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const digitsOnly = target.value.replace(/\D/g, "");

  if (!digitsOnly) {
    formData.value.credit_limit_input = "";
    return;
  }

  const cents = Number.parseInt(digitsOnly, 10);
  formData.value.credit_limit_input = formatCents(cents);
}

function handlePaymentAmountInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const digitsOnly = target.value.replace(/\D/g, "");

  if (!digitsOnly) {
    paymentFormData.value.amount_input = "";
    return;
  }

  const cents = Number.parseInt(digitsOnly, 10);
  paymentFormData.value.amount_input = formatCents(cents);
}

function handleWhatsAppAmountInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const digitsOnly = target.value.replace(/\D/g, "");

  if (!digitsOnly) {
    whatsAppFormData.value.amount_input = "";
    return;
  }

  const cents = Number.parseInt(digitsOnly, 10);
  whatsAppFormData.value.amount_input = formatCents(cents);
}

function handlePaymentPinInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  paymentFormData.value.pin = target.value.replace(/\D/g, "").slice(0, 6);
}

function handlePaymentDueDayInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  formData.value.payment_due_day = target.value.replace(/\D/g, "").slice(0, 2);
}

function formatPaymentDueDay(day: number | null): string {
  if (!day) {
    return "-";
  }

  return `Todo dia ${day}`;
}

function toggleDebtVisibility(customerId: string): void {
  const currentVisibility = debtVisibilityByCustomerId.value[customerId] ?? false;
  debtVisibilityByCustomerId.value[customerId] = !currentVisibility;
}

function isDebtVisible(customerId: string): boolean {
  return debtVisibilityByCustomerId.value[customerId] ?? false;
}

function debouncedSearch(): void {
  if (searchTimeoutId) clearTimeout(searchTimeoutId);

  searchTimeoutId = setTimeout(() => {
    loadCustomers();
  }, 400);
}

function toHistoryPeriodParam(rawValue: unknown, min: number, max: number): string | null {
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);

  if (!Number.isInteger(value) || value < min || value > max) {
    return null;
  }

  return String(value);
}

function createHistorySearchParams(page: number, perPage: number): URLSearchParams {
  const params = new URLSearchParams();

  if (page) {
    params.append("page", String(page));
  }

  if (perPage) {
    params.append("per_page", String(perPage));
  }

  const month = toHistoryPeriodParam(selectedHistoryMonth.value, 1, 12);
  const year = toHistoryPeriodParam(selectedHistoryYear.value, 2000, 9999);

  if (month) {
    params.append("month", month);
  }

  if (year) {
    params.append("year", year);
  }

  return params;
}

function toggleSortOrder(column: SortBy): void {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = column;
    sortOrder.value = "asc";
  }

  currentPage.value = 1;
  loadCustomers();
}

function getSortIcon(column: SortBy): string {
  if (sortBy.value !== column) {
    return "↕";
  }

  return sortOrder.value === "asc" ? "↑" : "↓";
}

async function loadCustomers(): Promise<void> {
  loadingList.value = true;
  listError.value = null;

  try {
    const params = new URLSearchParams({
      page: String(currentPage.value),
      per_page: String(perPage.value),
      sort_by: sortBy.value,
      sort_order: sortOrder.value,
    });

    if (searchInput.value.trim()) {
      params.append("search", searchInput.value.trim());
    }

    const response = await authenticatedFetch(`/api/customers?${params}`);
    const data = await response.json();

    if (!response.ok) {
      listError.value = data.message || "Não foi possível carregar os clientes.";
      return;
    }

    customers.value = data.data as Customer[];
    totalCustomers.value = data.pagination.total;
    totalPages.value = data.pagination.total_pages;
    currentPage.value = data.pagination.page;
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    listError.value = "Erro de conexão ao carregar clientes.";
  } finally {
    loadingList.value = false;
  }
}

function clearSearch(): void {
  searchInput.value = "";
  currentPage.value = 1;
}

async function loadHistoryCustomers(): Promise<void> {
  loadingHistoryCustomers.value = true;
  historyCustomersError.value = null;

  try {
    await customerStore.fetchIfStale(authenticatedFetch);

    if (customerStore.error) {
      historyCustomersError.value = customerStore.error;
      return;
    }

    allCustomersForHistory.value = customerStore.customers as Customer[];
  } catch (error) {
    console.error("Erro ao carregar clientes para histórico:", error);
    historyCustomersError.value = "Erro de conexão ao carregar clientes.";
  } finally {
    loadingHistoryCustomers.value = false;
  }
}

async function loadFiadoHistory(): Promise<void> {
  if (!selectedHistoryCustomer.value) {
    return;
  }

  loadingFiadoHistory.value = true;
  fiadoHistoryError.value = null;

  try {
    const params = createHistorySearchParams(fiadoHistoryPage.value, fiadoHistoryPerPage.value);

    const response = await authenticatedFetch(
      `/api/customers/${selectedHistoryCustomer.value.id}/fiado-history?${params}`,
    );
    const data = await response.json();

    if (!response.ok) {
      fiadoHistoryError.value = data.message || "Não foi possível carregar o histórico de compras.";
      return;
    }

    fiadoHistoryRows.value = data.data as SaleWithPayments[];
    fiadoHistoryTotal.value = data.pagination.total;
    fiadoHistoryTotalPages.value = data.pagination.total_pages;
    fiadoHistoryPage.value = data.pagination.page;
    fiadoHistorySummary.value = {
      fiado_period_cents: data.summary?.fiado_period_cents ?? 0,
      fiado_open_cents: data.summary?.fiado_open_cents ?? 0,
      fiado_paid_cents: data.summary?.fiado_paid_cents ?? 0,
    };
  } catch (error) {
    console.error("Erro ao carregar histórico de fiado:", error);
    fiadoHistoryError.value = "Erro de conexão ao carregar histórico de compras.";
  } finally {
    loadingFiadoHistory.value = false;
  }
}

async function loadPaymentHistory(): Promise<void> {
  if (!selectedHistoryCustomer.value) {
    return;
  }

  loadingPaymentHistory.value = true;
  paymentHistoryError.value = null;

  try {
    const params = createHistorySearchParams(paymentHistoryPage.value, paymentHistoryPerPage.value);

    const response = await authenticatedFetch(
      `/api/customers/${selectedHistoryCustomer.value.id}/payment-history?${params}`,
    );
    const data = await response.json();

    if (!response.ok) {
      paymentHistoryError.value = data.message || "Não foi possível carregar o histórico de pagamentos.";
      return;
    }

    paymentHistoryRows.value = data.data as PaymentHistoryRow[];
    paymentHistoryTotal.value = data.pagination.total;
    paymentHistoryTotalPages.value = data.pagination.total_pages;
    paymentHistoryPage.value = data.pagination.page;
    paymentHistorySummary.value = {
      total_paid_period_cents: data.summary?.total_paid_period_cents ?? 0,
      fiado_open_cents: data.summary?.fiado_open_cents ?? 0,
    };
  } catch (error) {
    console.error("Erro ao carregar histórico de pagamentos:", error);
    paymentHistoryError.value = "Erro de conexão ao carregar histórico de pagamentos.";
  } finally {
    loadingPaymentHistory.value = false;
  }
}

function goToFiadoHistoryPage(page: number): void {
  fiadoHistoryPage.value = page;
  loadFiadoHistory();
}

function goToPreviousFiadoHistoryPage(): void {
  if (fiadoHistoryPage.value <= 1) {
    return;
  }

  fiadoHistoryPage.value--;
  loadFiadoHistory();
}

function goToNextFiadoHistoryPage(): void {
  if (fiadoHistoryPage.value >= fiadoHistoryTotalPages.value) {
    return;
  }

  fiadoHistoryPage.value++;
  loadFiadoHistory();
}

function goToPaymentHistoryPage(page: number): void {
  paymentHistoryPage.value = page;
  loadPaymentHistory();
}

function goToPreviousPaymentHistoryPage(): void {
  if (paymentHistoryPage.value <= 1) {
    return;
  }

  paymentHistoryPage.value--;
  loadPaymentHistory();
}

function goToNextPaymentHistoryPage(): void {
  if (paymentHistoryPage.value >= paymentHistoryTotalPages.value) {
    return;
  }

  paymentHistoryPage.value++;
  loadPaymentHistory();
}

function handlePerPageChange(): void {
  currentPage.value = 1;
  loadCustomers();
}

function handleFiadoHistoryPerPageChange(): void {
  fiadoHistoryPage.value = 1;
  loadFiadoHistory();
}

function handlePaymentHistoryPerPageChange(): void {
  paymentHistoryPage.value = 1;
  loadPaymentHistory();
}

function goToPage(page: number): void {
  currentPage.value = page;
  loadCustomers();
}

function goToPreviousPage(): void {
  if (currentPage.value > 1) {
    currentPage.value--;
    loadCustomers();
  }
}

function goToNextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    loadCustomers();
  }
}

function openCreateModal(): void {
  isEditMode.value = false;
  editingId.value = null;
  formData.value = {
    name: "",
    phone: "",
    credit_limit_input: "",
    payment_due_day: "",
    is_active: true,
  };
  formErrors.value = {};
  showModal.value = true;
}

function openEditModal(customer: Customer): void {
  isEditMode.value = true;
  editingId.value = customer.id;
  originalIsActive.value = customer.is_active;
  formData.value = {
    name: customer.name,
    phone: customer.phone ? formatPhoneForInput(customer.phone) : "",
    credit_limit_input: formatCents(customer.credit_limit_cents),
    payment_due_day: customer.payment_due_day ? String(customer.payment_due_day) : "",
    is_active: customer.is_active,
  };
  formErrors.value = {};
  showModal.value = true;
}

function openPaymentModal(customer: Customer): void {
  selectedPaymentCustomer.value = customer;
  paymentFormData.value = {
    amount_input: "",
    pin: "",
  };
  paymentFormErrors.value = {};
  showPaymentModal.value = true;
}

function openWhatsAppModal(customer: Customer): void {
  selectedWhatsAppCustomer.value = customer;
  whatsAppFormData.value = {
    charge_type: "full",
    amount_input: "",
  };
  whatsAppFormErrors.value = {};
  showWhatsAppModal.value = true;
}

function closeModal(): void {
  showModal.value = false;
  formErrors.value = {};
}

function closePaymentModal(): void {
  showPaymentModal.value = false;
  selectedPaymentCustomer.value = null;
  paymentFormData.value = {
    amount_input: "",
    pin: "",
  };
  paymentFormErrors.value = {};
}

function closeWhatsAppModal(): void {
  showWhatsAppModal.value = false;
  selectedWhatsAppCustomer.value = null;
  whatsAppFormData.value = {
    charge_type: "full",
    amount_input: "",
  };
  whatsAppFormErrors.value = {};
}

useModalStack(
  [
    { isOpen: showModal, close: closeModal },
    { isOpen: showPaymentModal, close: closePaymentModal },
    { isOpen: showWhatsAppModal, close: closeWhatsAppModal },
    { isOpen: showReceiptModal, close: closeReceiptModal },
  ],
  { listenEscape: true },
);

function showSuccessToast(message: string): void {
  toast(message);
}

function getWhatsAppPhoneDigits(customer: Customer | null): string {
  if (!customer?.phone) {
    return "";
  }

  return normalizePhoneDigits(customer.phone);
}

function getWhatsAppChargeAmountCents(): number | null {
  if (!selectedWhatsAppCustomer.value) {
    return null;
  }

  if (whatsAppFormData.value.charge_type === "full") {
    return selectedWhatsAppCustomer.value.current_debt_cents;
  }

  return parseCurrencyToCents(whatsAppFormData.value.amount_input);
}

async function loadWhatsAppSettings(): Promise<void> {
  try {
    const response = await authenticatedFetch("/api/settings");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (typeof data.whatsapp_message_fiado_vencido === "string" && data.whatsapp_message_fiado_vencido.trim()) {
      whatsappMessageVencido.value = data.whatsapp_message_fiado_vencido;
    }

    if (typeof data.whatsapp_message_fiado_a_vencer === "string" && data.whatsapp_message_fiado_a_vencer.trim()) {
      whatsappMessageAVencer.value = data.whatsapp_message_fiado_a_vencer;
    }

    if (typeof data.whatsapp_due_partial_message === "string" && data.whatsapp_due_partial_message.trim()) {
      whatsappDuePartialMessage.value = data.whatsapp_due_partial_message;
    }

    if (typeof data.whatsapp_overdue_partial_message === "string" && data.whatsapp_overdue_partial_message.trim()) {
      whatsappOverduePartialMessage.value = data.whatsapp_overdue_partial_message;
    }
  } catch {
    // silently fall back to built-in defaults
  }
}

function validateForm(): boolean {
  formErrors.value = {};

  if (!formData.value.name.trim()) {
    formErrors.value.name = ["Nome é obrigatório"];
  } else if (formData.value.name.trim().length < 2 || formData.value.name.trim().length > 100) {
    formErrors.value.name = ["Nome deve ter entre 2 e 100 caracteres"];
  }

  const phoneDigits = normalizePhoneDigits(formData.value.phone);

  if (phoneDigits && phoneDigits.length !== 11) {
    formErrors.value.phone = ["Telefone deve ter 11 dígitos no formato (XX) X XXXX-XXXX"];
  }

  const creditLimitCents = parseCurrencyToCents(formData.value.credit_limit_input);

  if (creditLimitCents === null) {
    formErrors.value.credit_limit_cents = ["Limite de fiado é obrigatório"];
  } else if (creditLimitCents < 0) {
    formErrors.value.credit_limit_cents = ["Limite de fiado não pode ser negativo"];
  }

  if (formData.value.payment_due_day.trim()) {
    const parsedDueDay = Number.parseInt(formData.value.payment_due_day, 10);

    if (Number.isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
      formErrors.value.payment_due_day = ["Dia de pagamento deve estar entre 1 e 31"];
    }
  }

  return Object.keys(formErrors.value).length === 0;
}

function validatePaymentForm(): boolean {
  paymentFormErrors.value = {};

  if (!selectedPaymentCustomer.value) {
    paymentFormErrors.value.submit = "Cliente não selecionado";
    return false;
  }

  const amountCents = parseCurrencyToCents(paymentFormData.value.amount_input);

  if (amountCents === null || amountCents <= 0) {
    paymentFormErrors.value.amount_cents = ["Valor do pagamento deve ser maior que zero"];
  } else if (amountCents > selectedPaymentCustomer.value.current_debt_cents) {
    paymentFormErrors.value.amount_cents = [
      `Valor não pode ser maior que ${formatCents(selectedPaymentCustomer.value.current_debt_cents)}`,
    ];
  }

  if (!paymentFormData.value.pin.trim()) {
    paymentFormErrors.value.pin = ["PIN é obrigatório"];
  } else if (!/^\d{4,6}$/.test(paymentFormData.value.pin)) {
    paymentFormErrors.value.pin = ["PIN deve conter entre 4 e 6 dígitos numéricos"];
  }

  return Object.keys(paymentFormErrors.value).length === 0;
}

function validateWhatsAppForm(): boolean {
  whatsAppFormErrors.value = {};

  if (!selectedWhatsAppCustomer.value) {
    whatsAppFormErrors.value.submit = "Cliente não selecionado";
    return false;
  }

  const phoneDigits = getWhatsAppPhoneDigits(selectedWhatsAppCustomer.value);

  if (phoneDigits.length !== 11) {
    whatsAppFormErrors.value.submit = "Cliente não possui telefone válido para WhatsApp";
  }

  if (whatsAppFormData.value.charge_type === "partial") {
    const amountCents = parseCurrencyToCents(whatsAppFormData.value.amount_input);

    if (amountCents === null || amountCents <= 0) {
      whatsAppFormErrors.value.amount_cents = ["Valor da cobrança deve ser maior que zero"];
    } else if (amountCents > selectedWhatsAppCustomer.value.current_debt_cents) {
      whatsAppFormErrors.value.amount_cents = [
        `Valor não pode ser maior que ${formatCents(selectedWhatsAppCustomer.value.current_debt_cents)}`,
      ];
    }
  }

  return Object.keys(whatsAppFormErrors.value).length === 0;
}

async function submitForm(): Promise<void> {
  if (!validateForm()) {
    formErrors.value.submit = "Revise os campos destacados para continuar.";
    return;
  }

  if (isEditMode.value && originalIsActive.value && !formData.value.is_active) {
    const ok = await confirm({
      title: "Desativar cliente",
      message: `Tem certeza que deseja desativar "${formData.value.name}"? O cliente não poderá realizar compras no fiado.`,
      confirmLabel: "Desativar",
    });

    if (!ok) {
      return;
    }
  }

  loadingSubmit.value = true;
  formErrors.value.submit = undefined;

  const creditLimitCents = parseCurrencyToCents(formData.value.credit_limit_input);
  const payload = {
    ...buildCustomerPayload(
      {
        name: formData.value.name,
        phone: formData.value.phone,
        creditLimitCents: creditLimitCents ?? 0,
        paymentDueDay: formData.value.payment_due_day,
        isActive: formData.value.is_active,
      },
      normalizePhoneDigits,
    ),
  };

  try {
    const url = isEditMode.value ? `/api/customers/${editingId.value}` : "/api/customers";
    const method = isEditMode.value ? "PUT" : "POST";
    const response = await authenticatedFetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      if (data.errors) {
        formErrors.value = { ...formErrors.value, ...data.errors };
      } else {
        formErrors.value.submit = data.message || "Erro ao salvar cliente.";
      }
      return;
    }

    closeModal();
    await loadCustomers();
    customerStore.invalidate();
    showSuccessToast(
      isEditMode.value ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!",
    );
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);
    formErrors.value.submit = "Erro de conexão com o servidor";
  } finally {
    loadingSubmit.value = false;
  }
}

async function submitPaymentForm(): Promise<void> {
  if (!validatePaymentForm()) {
    return;
  }

  if (!selectedPaymentCustomer.value) {
    return;
  }

  paymentLoading.value = true;
  paymentFormErrors.value.submit = undefined;

  const amountCents = parseCurrencyToCents(paymentFormData.value.amount_input);

  const payload = {
    amount_cents: amountCents,
    pin: paymentFormData.value.pin,
  };
  const paidCustomerId = selectedPaymentCustomer.value.id;

  try {
    const response = await authenticatedFetch(`/api/customers/${selectedPaymentCustomer.value.id}/pay-debt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      paymentFormErrors.value.submit = data.message || "Erro ao registrar pagamento.";
      return;
    }

    closePaymentModal();
    customerStore.invalidate();
    await loadCustomers();

    if (selectedHistoryCustomer.value?.id === paidCustomerId) {
      if (activeTab.value === "purchase-history") {
        await loadFiadoHistory();
      }

      if (activeTab.value === "payment-history") {
        await loadPaymentHistory();
      }
    }

    showSuccessToast("Pagamento de fiado registrado com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar pagamento:", error);
    paymentFormErrors.value.submit = "Erro de conexão com o servidor";
  } finally {
    paymentLoading.value = false;
  }
}

function submitWhatsAppForm(): void {
  if (!validateWhatsAppForm()) {
    return;
  }

  if (!selectedWhatsAppCustomer.value) {
    return;
  }

  const phoneDigits = getWhatsAppPhoneDigits(selectedWhatsAppCustomer.value);
  const chargeAmountCents = getWhatsAppChargeAmountCents();

  if (!chargeAmountCents || chargeAmountCents <= 0) {
    whatsAppFormErrors.value.submit = "Valor da cobrança inválido";
    return;
  }

  const message = buildWhatsAppChargeMessage({
    customer: selectedWhatsAppCustomer.value,
    chargeAmountCents,
    chargeType: whatsAppFormData.value.charge_type,
    messageVencido: whatsappMessageVencido.value,
    messageAVencer: whatsappMessageAVencer.value,
    messageDuePartial: whatsappDuePartialMessage.value,
    messageOverduePartial: whatsappOverduePartialMessage.value,
  });
  const whatsappUrl = `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, "_blank");
  closeWhatsAppModal();
}
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-3xl font-bold text-gray-900">Clientes</h1>
        </div>

        <!-- Tabs -->
        <div class="mt-6 -mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
          <div class="flex min-w-max gap-1 border-b border-gray-200 md:min-w-0">
            <button
              type="button"
              :class="[
                'min-h-11 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold transition',
                activeTab === 'customers'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
              @click="activeTab = 'customers'"
            >
              Clientes
            </button>
            <button
              type="button"
              :class="[
                'min-h-11 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold transition',
                activeTab === 'purchase-history'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
              @click="activeTab = 'purchase-history'"
            >
              Histórico de Compras
            </button>
            <button
              type="button"
              :class="[
                'min-h-11 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold transition',
                activeTab === 'payment-history'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
              @click="activeTab = 'payment-history'"
            >
              Histórico de Pagamentos
            </button>
          </div>
        </div>

        <!-- ==================== ABA: Clientes ==================== -->
        <section v-if="activeTab === 'customers'" class="mt-6">
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <!-- Search Bar -->
            <div class="flex flex-1 gap-2">
              <input
                v-model="searchInput"
                type="text"
                placeholder="Buscar por nome ou telefone..."
                class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
              />
              <button
                v-if="searchInput"
                type="button"
                @click="clearSearch"
                class="min-h-11 rounded-lg bg-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              @click="openCreateModal"
              class="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-dark sm:w-auto"
            >
              + Novo Cliente
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="loadingList" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div v-for="index in 6" :key="index" class="h-12 animate-pulse rounded bg-gray-100"></div>
          </div>

          <!-- Error State -->
          <div
            v-else-if="listError"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
            role="alert"
          >
            <p>{{ listError }}</p>
            <button
              type="button"
              @click="loadCustomers"
              class="mt-3 rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
            >
              Tentar novamente
            </button>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="customers.length === 0"
            class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600"
          >
            Nenhum cliente cadastrado ainda.
          </div>

          <!-- Table / Mobile Cards -->
          <div v-else>
            <div class="mb-4 flex items-center justify-end">
              <div class="flex items-center gap-2">
                <label class="text-sm font-medium text-gray-700">Itens por página:</label>
                <select
                  v-model="perPage"
                  @change="handlePerPageChange"
                  class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option :value="5">5</option>
                  <option :value="10">10</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                </select>
              </div>
            </div>
            <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
              <table class="w-full min-w-[1200px]">
                <caption class="sr-only">Lista de clientes cadastrados</caption>
                <thead class="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                      @click="toggleSortOrder('name')"
                    >
                      <span class="flex items-center gap-2">
                        Nome
                        <span class="text-xs">{{ getSortIcon("name") }}</span>
                      </span>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Telefone</th>
                    <th
                      scope="col"
                      class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                      @click="toggleSortOrder('credit_limit_cents')"
                    >
                      <span class="flex items-center gap-2">
                        Limite de Fiado
                        <span class="text-xs">{{ getSortIcon("credit_limit_cents") }}</span>
                      </span>
                    </th>
                    <th
                      scope="col"
                      class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                      @click="toggleSortOrder('payment_due_day')"
                    >
                      <span class="flex items-center gap-2">
                        Dia de Pagamento
                        <span class="text-xs">{{ getSortIcon("payment_due_day") }}</span>
                      </span>
                    </th>
                    <th
                      scope="col"
                      class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                      @click="toggleSortOrder('current_debt_cents')"
                    >
                      <span class="flex items-center gap-2">
                        Fiado Atual
                        <span class="text-xs">{{ getSortIcon("current_debt_cents") }}</span>
                      </span>
                    </th>
                    <th
                      scope="col"
                      class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                      @click="toggleSortOrder('is_active')"
                    >
                      <span class="flex items-center gap-2">
                        Status
                        <span class="text-xs">{{ getSortIcon("is_active") }}</span>
                      </span>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="customer in customers" :key="customer.id" class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-900">{{ customer.name }}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">
                      {{ formatPhoneForDisplay(customer.phone) }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">
                      {{ formatCents(customer.credit_limit_cents) }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">
                      {{ formatPaymentDueDay(customer.payment_due_day) }}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">
                      <div class="flex items-center gap-2">
                        <span :class="isDebtVisible(customer.id) ? '' : 'blur-xs'">
                          {{ formatCents(customer.current_debt_cents) }}
                        </span>
                        <button
                          type="button"
                          :aria-label="isDebtVisible(customer.id) ? 'Ocultar fiado atual' : 'Mostrar fiado atual'"
                          class="min-h-11 min-w-11 flex items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                          @click="toggleDebtVisibility(customer.id)"
                        >
                          <svg
                            v-if="isDebtVisible(customer.id)"
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-3.582-10-8 0-1.775.723-3.414 1.943-4.747m3.174-2.516A10.058 10.058 0 0112 3c5.523 0 10 3.582 10 8 0 2.043-.957 3.906-2.56 5.363M15 12a3 3 0 10-4.243 2.83M3 3l18 18"
                            />
                          </svg>
                          <svg
                            v-else
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z"
                            />
                          </svg>
                        </button>
                        <button
                          v-if="customer.current_debt_cents > 0"
                          type="button"
                          :aria-label="`Cobrar cliente ${customer.name} pelo WhatsApp`"
                          class="min-h-11 inline-flex items-center gap-1 rounded px-3 text-xs font-semibold text-success transition hover:bg-gray-100"
                          @click="openWhatsAppModal(customer)"
                        >
                          <span>Cobrar 💰</span>
                        </button>
                        <button
                          v-if="customer.current_debt_cents > 0"
                          type="button"
                          :aria-label="`Registrar pagamento de fiado de ${customer.name}`"
                          class="min-h-11 inline-flex items-center gap-1 rounded px-3 text-xs font-semibold text-primary transition hover:bg-gray-100"
                          @click="openPaymentModal(customer)"
                        >
                          <span class="text-base leading-none select-none" aria-hidden="true">💲</span>
                          <span>Quitar</span>
                        </button>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-sm">
                      <span
                        :class="[
                          'inline-block rounded-full px-3 py-1 text-xs font-semibold',
                          customer.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-200 text-gray-700',
                        ]"
                      >
                        {{ customer.is_active ? "Ativo" : "Inativo" }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <button
                        type="button"
                        aria-label="Editar cliente"
                        class="min-h-11 min-w-11 flex items-center justify-center rounded text-primary transition hover:bg-gray-100"
                        @click="openEditModal(customer)"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M11.983 5.33a1 1 0 011.034 0l1.92 1.11a1 1 0 00.75.1l2.174-.582a1 1 0 011.149.48l1.11 1.921a1 1 0 00.609.482l2.175.583a1 1 0 01.576 1.558l-1.065 1.721a1 1 0 00-.148.77l.329 2.238a1 1 0 01-1.034 1.154l-2.255-.169a1 1 0 00-.738.26l-1.57 1.44a1 1 0 01-1.653-.412l-.879-2.086a1 1 0 00-.57-.54l-2.1-.814a1 1 0 01-.464-1.638l1.386-1.618a1 1 0 00.235-.742l-.235-2.247a1 1 0 011.234-1.074l2.23.427a1 1 0 00.767-.156l1.852-1.182z"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <ul class="space-y-2 md:hidden">
              <li
                v-for="customer in customers"
                :key="customer.id"
                class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div class="mb-3 flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-base font-semibold text-gray-900">{{ customer.name }}</p>
                    <p v-if="customer.phone" class="mt-0.5 text-xs text-gray-400">
                      📞 {{ formatPhoneForDisplay(customer.phone) }}
                    </p>
                  </div>
                  <span
                    :class="[
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                      customer.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-200 text-gray-700',
                    ]"
                  >
                    {{ customer.is_active ? 'Ativo' : 'Inativo' }}
                  </span>
                </div>

                <div class="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Limite fiado</p>
                    <p class="text-sm font-bold text-gray-800">
                      {{ formatCents(customer.credit_limit_cents) }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Fiado atual</p>
                    <div class="flex items-center justify-center gap-1">
                      <p
                        :class="[
                          'text-sm font-bold',
                          customer.current_debt_cents > 0 ? 'text-warning' : 'text-gray-400',
                          isDebtVisible(customer.id) ? '' : 'blur-xs',
                        ]"
                      >
                        {{ formatCents(customer.current_debt_cents) }}
                      </p>
                      <button
                        type="button"
                        :aria-label="isDebtVisible(customer.id) ? 'Ocultar fiado atual' : 'Mostrar fiado atual'"
                        class="flex items-center justify-center rounded text-gray-400 transition hover:text-gray-600"
                        @click="toggleDebtVisibility(customer.id)"
                      >
                        <svg
                          v-if="isDebtVisible(customer.id)"
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-3.582-10-8 0-1.775.723-3.414 1.943-4.747m3.174-2.516A10.058 10.058 0 0112 3c5.523 0 10 3.582 10 8 0 2.043-.957 3.906-2.56 5.363M15 12a3 3 0 10-4.243 2.83M3 3l18 18"
                          />
                        </svg>
                        <svg
                          v-else
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Vencimento</p>
                    <p class="text-sm font-bold text-gray-700">
                      {{ formatPaymentDueDay(customer.payment_due_day) }}
                    </p>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    v-if="customer.current_debt_cents > 0"
                    type="button"
                    :aria-label="`Cobrar cliente ${customer.name} pelo WhatsApp`"
                    class="min-h-11 inline-flex flex-1 items-center justify-center rounded-lg border border-success/20 bg-success/10 text-sm font-semibold text-success transition hover:bg-success/20"
                    @click="openWhatsAppModal(customer)"
                  >
                    Cobrar 💰
                  </button>

                  <button
                    v-if="customer.current_debt_cents > 0"
                    type="button"
                    :aria-label="`Registrar pagamento de fiado de ${customer.name}`"
                    class="min-h-11 inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-warning/20 bg-warning/10 text-sm font-semibold text-warning transition hover:bg-warning/20"
                    @click="openPaymentModal(customer)"
                  >
                    <span class="text-base leading-none" aria-hidden="true">💲</span>
                    Quitar
                  </button>

                  <button
                    type="button"
                    :aria-label="`Editar cliente ${customer.name}`"
                    class="min-h-11 inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 text-sm font-medium text-primary transition hover:bg-primary/5"
                    @click="openEditModal(customer)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11.983 5.33a1 1 0 011.034 0l1.92 1.11a1 1 0 00.75.1l2.174-.582a1 1 0 011.149.48l1.11 1.921a1 1 0 00.609.482l2.175.583a1 1 0 01.576 1.558l-1.065 1.721a1 1 0 00-.148.77l.329 2.238a1 1 0 01-1.034 1.154l-2.255-.169a1 1 0 00-.738.26l-1.57 1.44a1 1 0 01-1.653-.412l-.879-2.086a1 1 0 00-.57-.54l-2.1-.814a1 1 0 01-.464-1.638l1.386-1.618a1 1 0 00.235-.742l-.235-2.247a1 1 0 011.234-1.074l2.23.427a1 1 0 00.767-.156l1.852-1.182z"
                      />
                    </svg>
                    Editar
                  </button>
                </div>
              </li>
            </ul>
          </div>

        <!-- Pagination Controls -->
        <div
          v-if="customers.length > 0 && totalPages > 1"
          class="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
        >
          <div class="text-sm text-gray-600">
            Mostrando
            <span class="font-semibold">{{ (currentPage - 1) * perPage + 1 }}</span>
            –
            <span class="font-semibold">{{ Math.min(currentPage * perPage, totalCustomers) }}</span>
            de <span class="font-semibold">{{ totalCustomers }}</span> clientes
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="currentPage === 1"
              @click="goToPreviousPage"
              class="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
            >
              ← Anterior
            </button>

            <div class="flex gap-1">
              <button
                v-for="page in totalPagesArray"
                :key="page"
                type="button"
                @click="goToPage(page)"
                :class="[
                  'rounded px-2 py-1 text-sm font-medium transition',
                  page === currentPage
                    ? 'bg-primary text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
                ]"
              >
                {{ page }}
              </button>
            </div>

            <button
              type="button"
              :disabled="currentPage === totalPages"
              @click="goToNextPage"
              class="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
            >
              Próxima →
            </button>
          </div>
        </div>
        </section>

        <!-- ==================== ABA: Histórico de Compras ==================== -->
        <section v-if="activeTab === 'purchase-history'" class="mt-6">
          <div class="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
            <div class="relative min-w-0 flex-1 sm:max-w-md">
              <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Cliente</label>
              <div class="flex gap-2">
                <input
                  v-model="historyCustomerSearchInput"
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
                  @focus="openHistoryCustomerDropdown"
                  @input="openHistoryCustomerDropdown"
                />
                <button
                  v-if="selectedHistoryCustomer"
                  type="button"
                  aria-label="Limpar cliente selecionado no historico de compras"
                  @click="clearSelectedHistoryCustomer"
                  class="min-h-11 rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
                >
                  ✕
                </button>
              </div>

              <div
                v-if="showHistoryCustomerDropdown && !selectedHistoryCustomer"
                class="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
              >
                <div v-if="loadingHistoryCustomers" class="p-3 text-center text-sm text-gray-500">
                  Carregando clientes...
                </div>
                <div v-else-if="historyCustomersError" class="p-3 text-sm text-danger">
                  {{ historyCustomersError }}
                </div>
                <div v-else-if="filteredHistoryCustomers.length === 0" class="p-3 text-center text-sm text-gray-500">
                  Nenhum cliente encontrado.
                </div>
                <button
                  v-for="customer in filteredHistoryCustomers"
                  :key="customer.id"
                  type="button"
                  class="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                  @click="selectHistoryCustomer(customer)"
                >
                  <div>
                    <span class="block text-sm font-medium text-gray-900">{{ customer.name }}</span>
                    <span class="text-xs text-gray-500">
                      {{ customer.phone ? formatPhoneForDisplay(customer.phone) : "Sem telefone" }}
                    </span>
                  </div>
                  <span
                    :class="[
                      'text-xs font-semibold',
                      customer.is_active ? 'text-green-700' : 'text-gray-500',
                    ]"
                  >
                    {{ customer.is_active ? "Ativo" : "Inativo" }}
                  </span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Mês</label>
                <select
                  v-model.number="selectedHistoryMonth"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
                >
                  <option v-for="month in monthOptions" :key="month.value" :value="month.value">
                    {{ month.label }}
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Ano</label>
                <select
                  v-model.number="selectedHistoryYear"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
                >
                  <option v-for="year in yearOptions" :key="year" :value="year">
                    {{ year }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div
            v-if="!selectedHistoryCustomer"
            class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600"
          >
            Selecione um cliente para visualizar o histórico de compras.
          </div>

          <div v-else class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div v-if="!loadingFiadoHistory" class="mb-4 grid grid-cols-3 gap-2 xl:hidden">
                <div class="rounded-lg bg-surface p-3 text-center">
                  <p class="text-xs text-gray-400">Fiado do período</p>
                  <p class="text-sm font-bold text-gray-800">
                    {{ formatCents(fiadoHistorySummary.fiado_period_cents) }}
                  </p>
                </div>
                <div class="rounded-lg bg-surface p-3 text-center">
                  <p class="text-xs text-gray-400">Em aberto</p>
                  <p class="text-sm font-bold text-warning">
                    {{ formatCents(fiadoHistorySummary.fiado_open_cents) }}
                  </p>
                </div>
                <div class="rounded-lg bg-surface p-3 text-center">
                  <p class="text-xs text-gray-400">Pago no período</p>
                  <p class="text-sm font-bold text-success">
                    {{ formatCents(fiadoHistorySummary.fiado_paid_cents) }}
                  </p>
                </div>
              </div>

              <div v-if="loadingFiadoHistory" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <div v-for="index in 6" :key="index" class="h-10 animate-pulse rounded bg-gray-100"></div>
              </div>

              <div
                v-else-if="fiadoHistoryError"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
                role="alert"
              >
                <p>{{ fiadoHistoryError }}</p>
                <button
                  type="button"
                  @click="loadFiadoHistory"
                  class="mt-3 rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
                >
                  Tentar novamente
                </button>
              </div>

              <div
                v-else-if="fiadoHistoryRows.length === 0"
                class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600"
              >
                Nenhuma compra em fiado encontrada para este cliente no período selecionado.
              </div>

              <template v-else>
                <div class="mb-4 flex items-center justify-end">
                  <div class="flex items-center gap-2">
                    <label class="text-sm font-medium text-gray-700">Itens por página:</label>
                    <select
                      v-model="fiadoHistoryPerPage"
                      @change="handleFiadoHistoryPerPageChange"
                      class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option :value="5">5</option>
                      <option :value="10">10</option>
                      <option :value="20">20</option>
                      <option :value="50">50</option>
                    </select>
                  </div>
                </div>
                <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
                  <table class="w-full min-w-[720px]">
                    <caption class="sr-only">Histórico de compras em fiado do cliente selecionado</caption>
                    <thead class="bg-gray-50">
                      <tr>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Dia</th>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Horário</th>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Valor em Fiado</th>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tipo de Pagamento</th>
                        <th scope="col" class="px-6 py-3 text-center text-sm font-semibold text-gray-700">Recibo</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                      <tr v-for="sale in fiadoHistoryRows" :key="sale.id" class="hover:bg-gray-50">
                        <td class="px-6 py-4 text-sm text-gray-900">{{ formatDateDay(sale.created_at) }}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">{{ formatTime(sale.created_at) }}</td>
                        <td class="px-6 py-4 text-sm font-medium text-gray-900">
                          {{ formatCents(getFiadoAmountCents(sale)) }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-600">{{ getPaymentTypeLabel(sale) }}</td>
                        <td class="px-6 py-4 text-center">
                          <button
                            type="button"
                            aria-label="Ver recibo"
                            class="rounded bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-dark"
                            @click="openReceiptModal(sale)"
                          >
                            Recibo
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <ul class="space-y-2 md:hidden">
                  <li
                    v-for="sale in fiadoHistoryRows"
                    :key="sale.id"
                    class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div class="mb-3 flex items-start justify-between">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">
                          {{ formatDateDay(sale.created_at) }}
                        </p>
                        <p class="text-xs text-gray-400">{{ formatTime(sale.created_at) }}</p>
                      </div>
                      <div class="text-right">
                        <p class="text-sm font-bold text-warning">
                          {{ formatCents(getFiadoAmountCents(sale)) }}
                        </p>
                        <p class="text-xs text-gray-400">{{ getPaymentTypeLabel(sale) }}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      class="min-h-11 w-full rounded-lg border border-gray-200 text-sm font-medium text-primary transition hover:bg-primary/5"
                      :aria-label="`Ver comprovante de ${formatDateDay(sale.created_at)}`"
                      @click="openReceiptModal(sale)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="mr-1 inline h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Ver comprovante
                    </button>
                  </li>
                </ul>

                <div
                  v-if="fiadoHistoryTotalPages > 1"
                  class="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p class="text-center text-sm text-gray-600 sm:text-left">
                    Mostrando
                    <span class="font-semibold">{{ (fiadoHistoryPage - 1) * fiadoHistoryPerPage + 1 }}</span>
                    –
                    <span class="font-semibold">{{ Math.min(fiadoHistoryPage * fiadoHistoryPerPage, fiadoHistoryTotal) }}</span>
                    de <span class="font-semibold">{{ fiadoHistoryTotal }}</span> registros
                  </p>

                  <div class="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      :disabled="fiadoHistoryPage === 1"
                      @click="goToPreviousFiadoHistoryPage"
                      class="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                    >
                      ← Anterior
                    </button>

                    <div class="hidden gap-1 sm:flex">
                      <button
                        v-for="page in fiadoHistoryPagesArray"
                        :key="page"
                        type="button"
                        @click="goToFiadoHistoryPage(page)"
                        :class="[
                          'min-h-11 min-w-11 rounded-lg text-sm font-medium transition',
                          page === fiadoHistoryPage
                            ? 'bg-primary text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
                        ]"
                      >
                        {{ page }}
                      </button>
                    </div>

                    <span class="px-2 text-sm text-gray-500 sm:hidden">
                      {{ fiadoHistoryPage }} / {{ fiadoHistoryTotalPages }}
                    </span>

                    <button
                      type="button"
                      :disabled="fiadoHistoryPage === fiadoHistoryTotalPages"
                      @click="goToNextFiadoHistoryPage"
                      class="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              </template>
            </div>

            <aside class="hidden h-fit rounded-lg border border-gray-200 bg-white p-4 xl:sticky xl:top-24 xl:block">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Resumo do Período
              </h3>

              <div v-if="loadingFiadoHistory" class="mt-4 space-y-3">
                <div class="h-14 animate-pulse rounded bg-gray-100"></div>
                <div class="h-14 animate-pulse rounded bg-gray-100"></div>
                <div class="h-14 animate-pulse rounded bg-gray-100"></div>
              </div>

              <div v-else class="mt-4 space-y-3">
                <div class="rounded bg-gray-50 p-3">
                  <p class="text-xs font-semibold uppercase text-gray-500">Fiado do Período</p>
                  <p class="mt-1 text-lg font-bold text-gray-900">
                    {{ formatCents(fiadoHistorySummary.fiado_period_cents) }}
                  </p>
                </div>

                <div class="rounded bg-gray-50 p-3">
                  <p class="text-xs font-semibold uppercase text-gray-500">Fiado em Aberto</p>
                  <p class="mt-1 text-lg font-bold text-warning">
                    {{ formatCents(fiadoHistorySummary.fiado_open_cents) }}
                  </p>
                </div>

                <div class="rounded bg-gray-50 p-3">
                  <p class="text-xs font-semibold uppercase text-gray-500">Fiado Pago no Período</p>
                  <p class="mt-1 text-lg font-bold text-success">
                    {{ formatCents(fiadoHistorySummary.fiado_paid_cents) }}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <!-- ==================== ABA: Histórico de Pagamentos ==================== -->
        <section v-if="activeTab === 'payment-history'" class="mt-6">
          <div class="mb-6 flex flex-wrap items-end gap-4">
            <div class="relative w-full max-w-md">
              <label class="mb-1 block text-sm font-medium text-gray-700">Selecione o cliente</label>
              <div class="flex gap-2">
                <input
                  v-model="historyCustomerSearchInput"
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  class="flex-1 rounded border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @focus="openHistoryCustomerDropdown"
                  @input="openHistoryCustomerDropdown"
                />
                <button
                  v-if="selectedHistoryCustomer"
                  type="button"
                  aria-label="Limpar cliente selecionado no historico de pagamentos"
                  @click="clearSelectedHistoryCustomer"
                  class="rounded bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
                >
                  ✕
                </button>
              </div>

              <div
                v-if="showHistoryCustomerDropdown && !selectedHistoryCustomer"
                class="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
              >
                <div v-if="loadingHistoryCustomers" class="p-3 text-center text-sm text-gray-500">
                  Carregando clientes...
                </div>
                <div v-else-if="historyCustomersError" class="p-3 text-sm text-danger">
                  {{ historyCustomersError }}
                </div>
                <div v-else-if="filteredHistoryCustomers.length === 0" class="p-3 text-center text-sm text-gray-500">
                  Nenhum cliente encontrado.
                </div>
                <button
                  v-for="customer in filteredHistoryCustomers"
                  :key="customer.id"
                  type="button"
                  class="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                  @click="selectHistoryCustomer(customer)"
                >
                  <div>
                    <span class="block text-sm font-medium text-gray-900">{{ customer.name }}</span>
                    <span class="text-xs text-gray-500">
                      {{ customer.phone ? formatPhoneForDisplay(customer.phone) : "Sem telefone" }}
                    </span>
                  </div>
                  <span
                    :class="[
                      'text-xs font-semibold',
                      customer.is_active ? 'text-green-700' : 'text-gray-500',
                    ]"
                  >
                    {{ customer.is_active ? "Ativo" : "Inativo" }}
                  </span>
                </button>
              </div>
            </div>

            <div class="flex items-end gap-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Mês</label>
                <select
                  v-model.number="selectedHistoryMonth"
                  class="rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option v-for="month in monthOptions" :key="month.value" :value="month.value">
                    {{ month.label }}
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Ano</label>
                <select
                  v-model.number="selectedHistoryYear"
                  class="rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option v-for="year in yearOptions" :key="year" :value="year">
                    {{ year }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div
            v-if="!selectedHistoryCustomer"
            class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600"
          >
            Selecione um cliente para visualizar o histórico de pagamentos de fiado.
          </div>

          <div v-else class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div v-if="loadingPaymentHistory" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <div v-for="index in 6" :key="index" class="h-10 animate-pulse rounded bg-gray-100"></div>
              </div>

              <div
                v-else-if="paymentHistoryError"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
                role="alert"
              >
                <p>{{ paymentHistoryError }}</p>
                <button
                  type="button"
                  @click="loadPaymentHistory"
                  class="mt-3 rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
                >
                  Tentar novamente
                </button>
              </div>

              <div
                v-else-if="paymentHistoryRows.length === 0"
                class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600"
              >
                Nenhum pagamento de fiado encontrado para este cliente no período selecionado.
              </div>

              <template v-else>
                <div class="mb-4 flex items-center justify-end">
                  <div class="flex items-center gap-2">
                    <label class="text-sm font-medium text-gray-700">Itens por página:</label>
                    <select
                      v-model="paymentHistoryPerPage"
                      @change="handlePaymentHistoryPerPageChange"
                      class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option :value="5">5</option>
                      <option :value="10">10</option>
                      <option :value="20">20</option>
                      <option :value="50">50</option>
                    </select>
                  </div>
                </div>
                <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
                  <table class="w-full min-w-[760px]">
                    <caption class="sr-only">Histórico de pagamentos de fiado do cliente selecionado</caption>
                    <thead class="bg-gray-50">
                      <tr>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Dia</th>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Horário</th>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fiado em Aberto</th>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Valor Pago</th>
                        <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tipo de Pagamento</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                      <tr v-for="payment in paymentHistoryRows" :key="payment.id" class="hover:bg-gray-50">
                        <td class="px-6 py-4 text-sm text-gray-900">{{ formatDateDay(payment.created_at) }}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">{{ formatTime(payment.created_at) }}</td>
                        <td class="px-6 py-4 text-sm text-gray-900">
                          {{ formatCents(getPaymentHistoryDebtBeforeCents(payment)) }}
                        </td>
                        <td class="px-6 py-4 text-sm font-medium text-gray-900">
                          {{ formatCents(payment.amount_cents) }}
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-600">{{ getPaymentHistoryTypeLabel(payment) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <ul class="space-y-2 md:hidden">
                  <li
                    v-for="payment in paymentHistoryRows"
                    :key="payment.id"
                    class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div class="mb-3 flex items-start justify-between">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">{{ formatDateDay(payment.created_at) }}</p>
                        <p class="text-xs text-gray-400">{{ formatTime(payment.created_at) }}</p>
                      </div>
                      <div class="text-right">
                        <p class="text-xs text-gray-400">Valor pago</p>
                        <p class="text-sm font-bold text-success">{{ formatCents(payment.amount_cents) }}</p>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <div class="rounded-lg bg-surface px-2 py-1.5 text-center">
                        <p class="text-xs text-gray-400">Fiado em aberto</p>
                        <p class="text-sm font-bold text-warning">
                          {{ formatCents(getPaymentHistoryDebtBeforeCents(payment)) }}
                        </p>
                      </div>
                      <div class="rounded-lg bg-surface px-2 py-1.5 text-center">
                        <p class="text-xs text-gray-400">Tipo de pagamento</p>
                        <p class="text-sm font-bold text-gray-700">{{ getPaymentHistoryTypeLabel(payment) }}</p>
                      </div>
                    </div>
                  </li>
                </ul>

                <div
                  v-if="paymentHistoryTotalPages > 1"
                  class="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p class="text-center text-sm text-gray-600 sm:text-left">
                    Mostrando
                    <span class="font-semibold">{{ (paymentHistoryPage - 1) * paymentHistoryPerPage + 1 }}</span>
                    –
                    <span class="font-semibold">{{ Math.min(paymentHistoryPage * paymentHistoryPerPage, paymentHistoryTotal) }}</span>
                    de <span class="font-semibold">{{ paymentHistoryTotal }}</span> registros
                  </p>

                  <div class="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      :disabled="paymentHistoryPage === 1"
                      @click="goToPreviousPaymentHistoryPage"
                      class="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                    >
                      ← Anterior
                    </button>

                    <div class="hidden gap-1 sm:flex">
                      <button
                        v-for="page in paymentHistoryPagesArray"
                        :key="page"
                        type="button"
                        @click="goToPaymentHistoryPage(page)"
                        :class="[
                          'min-h-11 min-w-11 rounded-lg text-sm font-medium transition',
                          page === paymentHistoryPage
                            ? 'bg-primary text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
                        ]"
                      >
                        {{ page }}
                      </button>
                    </div>

                    <span class="px-2 text-sm text-gray-500 sm:hidden">
                      {{ paymentHistoryPage }} / {{ paymentHistoryTotalPages }}
                    </span>

                    <button
                      type="button"
                      :disabled="paymentHistoryPage === paymentHistoryTotalPages"
                      @click="goToNextPaymentHistoryPage"
                      class="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              </template>
            </div>

            <aside class="h-fit rounded-lg border border-gray-200 bg-white p-4 xl:sticky xl:top-24">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Resumo do Período
              </h3>

              <div v-if="loadingPaymentHistory" class="mt-4 space-y-3">
                <div class="h-14 animate-pulse rounded bg-gray-100"></div>
                <div class="h-14 animate-pulse rounded bg-gray-100"></div>
              </div>

              <div v-else class="mt-4 space-y-3">
                <div class="rounded bg-gray-50 p-3">
                  <p class="text-xs font-semibold uppercase text-gray-500">Fiado Pago no Período</p>
                  <p class="mt-1 text-lg font-bold text-success">
                    {{ formatCents(paymentHistorySummary.total_paid_period_cents) }}
                  </p>
                </div>

                <div class="rounded bg-gray-50 p-3">
                  <p class="text-xs font-semibold uppercase text-gray-500">Fiado em Aberto</p>
                  <p class="mt-1 text-lg font-bold text-warning">
                    {{ formatCents(paymentHistorySummary.fiado_open_cents) }}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <!-- ==================== MODAIS ==================== -->

        <!-- Receipt Modal -->
        <div
          v-if="showReceiptModal && selectedReceiptSale"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-receipt-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closeReceiptModal"></div>
          <div class="relative w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:mx-auto sm:max-w-md sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden"></div>
            <div class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 id="customer-receipt-modal-title" class="text-xl font-bold text-gray-900">Comprovante de Compra</h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar modal"
                @click="closeReceiptModal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm">
              <div class="border-b border-dashed border-gray-400 pb-2 text-center font-bold">
                PDV FIADODIGITAL
              </div>

              <div class="space-y-1 border-b border-dashed border-gray-400 pb-2">
                <p>
                  <span class="text-gray-600">Cliente:</span>
                  <span class="ml-1 font-medium text-gray-900">{{ selectedHistoryCustomer?.name }}</span>
                </p>
                <p>
                  <span class="text-gray-600">Data:</span>
                  <span class="ml-1 font-medium text-gray-900">{{ formatDateTimeWithConnector(selectedReceiptSale.created_at) }}</span>
                </p>
                <p>
                  <span class="text-gray-600">Terminal:</span>
                  <span class="ml-1 font-medium text-gray-900">{{ selectedReceiptSale.terminal_id }}</span>
                </p>
              </div>

              <div class="border-b border-dashed border-gray-400 pb-2">
                <p class="mb-1 font-bold text-gray-800">ITENS DA COMPRA</p>
                <div
                  v-for="item in selectedReceiptSale.items"
                  :key="item.id"
                  class="mb-1"
                >
                  <div class="flex justify-between">
                    <span class="text-gray-700">{{ item.quantity }}x {{ getReceiptItemName(item.product_name) }}</span>
                    <span class="text-gray-900">{{ formatCents(item.total_cents) }}</span>
                  </div>
                  <div
                    v-if="item.discount_cents > 0"
                    class="mt-1 flex justify-between text-xs text-gray-500"
                  >
                    <span>Unitário: {{ formatCents(getUnitPriceFromItem(item)) }} | Desconto item: {{ formatCents(item.discount_cents) }}</span>
                    <span></span>
                  </div>
                </div>
              </div>

              <div class="space-y-1 border-b border-dashed border-gray-400 pb-2">
                <div class="flex justify-between">
                  <span class="text-gray-600">Subtotal:</span>
                  <span class="text-gray-900">{{ formatCents(selectedReceiptSale.subtotal_cents) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Desconto:</span>
                  <span class="text-gray-900">{{ formatCents(selectedReceiptSale.discount_cents) }}</span>
                </div>
                <div class="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>{{ formatCents(selectedReceiptSale.total_cents) }}</span>
                </div>
              </div>

              <div>
                <p class="mb-1 font-bold text-gray-800">PAGAMENTO</p>
                <div
                  v-for="(payment, paymentIndex) in selectedReceiptSale.payments"
                  :key="paymentIndex"
                  class="flex justify-between"
                >
                  <span class="text-gray-600">{{ getPaymentMethodLabel(payment.method) }}:</span>
                  <span class="text-gray-900">{{ formatCents(payment.amount_cents) }}</span>
                </div>
                <div
                  v-if="selectedReceiptSale.payments.length === 0"
                  class="flex justify-between"
                >
                  <span class="text-gray-600">{{ getPaymentMethodLabel(selectedReceiptSale.payment_method) }}:</span>
                  <span class="text-gray-900">{{ formatCents(selectedReceiptSale.total_cents) }}</span>
                </div>
              </div>
            </div>

            <div class="mt-4 flex justify-end gap-3">
              <button
                type="button"
                class="min-h-11 rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                @click="closeReceiptModal"
              >
                Fechar
              </button>
              <button
                type="button"
                class="min-h-11 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark"
                @click="printReceipt"
              >
                Imprimir
              </button>
            </div>
            </div>
          </div>
        </div>

        <!-- WhatsApp Charge Modal -->
        <div
          v-if="showWhatsAppModal && selectedWhatsAppCustomer"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-whatsapp-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closeWhatsAppModal"></div>
          <div class="relative w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:mx-auto sm:max-w-md sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden"></div>
            <div class="p-4 sm:p-6">
              <div class="mb-4 flex items-center justify-between">
                <h2 id="customer-whatsapp-modal-title" class="text-xl font-bold text-gray-900">Cobrança via WhatsApp</h2>
                <button
                  type="button"
                  class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Fechar modal"
                  @click="closeWhatsAppModal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div class="mb-4 space-y-2 rounded bg-gray-50 p-3">
                <div class="text-sm font-medium text-gray-700">{{ selectedWhatsAppCustomer.name }}</div>
                <div class="text-sm text-gray-600">
                  Telefone:
                  <span class="font-semibold text-gray-900">
                    {{ selectedWhatsAppCustomer.phone ? formatPhoneForDisplay(selectedWhatsAppCustomer.phone) : "Não informado" }}
                  </span>
                </div>
                <div class="text-sm text-gray-600">
                  Dívida total:
                  <span class="font-semibold text-gray-900">
                    {{ formatCents(selectedWhatsAppCustomer.current_debt_cents) }}
                  </span>
                </div>
                <div class="text-sm text-gray-600">
                  Vencimento:
                  <span class="font-semibold text-gray-900">
                    {{ formatPaymentDueDay(selectedWhatsAppCustomer.payment_due_day) }}
                  </span>
                </div>
              </div>

              <div
                v-if="whatsAppFormErrors.submit"
                class="mb-4 rounded bg-red-100 p-3 text-sm text-danger"
                role="alert"
              >
                {{ whatsAppFormErrors.submit }}
              </div>

              <form class="space-y-4" novalidate @submit.prevent="submitWhatsAppForm">
                <fieldset>
                  <legend class="mb-2 block text-sm font-medium text-gray-700">Tipo de cobrança</legend>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 transition hover:border-success/40">
                      <input v-model="whatsAppFormData.charge_type" type="radio" value="full" class="h-4 w-4 border-gray-300 text-success focus:ring-success/30" />
                      <span class="text-sm font-medium text-gray-700">Completa</span>
                    </label>
                    <label class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 transition hover:border-success/40">
                      <input v-model="whatsAppFormData.charge_type" type="radio" value="partial" class="h-4 w-4 border-gray-300 text-success focus:ring-success/30" />
                      <span class="text-sm font-medium text-gray-700">Parcial</span>
                    </label>
                  </div>
                </fieldset>

                <div v-if="whatsAppFormData.charge_type === 'partial'">
                  <label for="whatsapp_charge_amount" class="mb-1 block text-sm font-medium text-gray-700">
                    Valor da Cobrança *
                  </label>
                  <input
                    id="whatsapp_charge_amount"
                    :value="whatsAppFormData.amount_input"
                    type="text"
                    autofocus
                    inputmode="numeric"
                    placeholder="R$ 0,00"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handleWhatsAppAmountInput"
                  />
                  <div v-if="whatsAppFormErrors.amount_cents" class="mt-1 text-xs text-danger">
                    {{ whatsAppFormErrors.amount_cents[0] }}
                  </div>
                </div>

                <div class="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-900">
                  <span class="font-medium">Prévia:</span>
                  {{ whatsAppFormData.charge_type === "full"
                    ? ` cobrança do valor total de ${formatCents(selectedWhatsAppCustomer.current_debt_cents)}.`
                    : ` cobrança parcial de ${whatsAppFormData.amount_input || "R$ 0,00"}, com dívida total de ${formatCents(selectedWhatsAppCustomer.current_debt_cents)}.` }}
                </div>

                <div class="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    class="min-h-11 rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                    @click="closeWhatsAppModal"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    class="min-h-11 rounded bg-success px-4 py-2 font-medium text-white transition hover:bg-green-600"
                  >
                    Enviar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Payment Modal -->
        <div
          v-if="showPaymentModal && selectedPaymentCustomer"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-payment-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closePaymentModal"></div>
          <div class="relative w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:mx-auto sm:max-w-md sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden"></div>
            <div class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 id="customer-payment-modal-title" class="text-xl font-bold text-gray-900">Registrar Pagamento de Fiado</h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar modal"
                @click="closePaymentModal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="mb-4 space-y-2 rounded bg-gray-50 p-3">
              <div class="text-sm font-medium text-gray-700">{{ selectedPaymentCustomer.name }}</div>
              <div class="text-sm text-gray-600">
                Dívida atual:
                <span class="font-semibold text-gray-900">
                  {{ formatCents(selectedPaymentCustomer.current_debt_cents) }}
                </span>
              </div>
            </div>

            <div
              v-if="paymentFormErrors.submit"
              class="mb-4 rounded bg-red-100 p-3 text-sm text-danger"
              role="alert"
            >
              {{ paymentFormErrors.submit }}
            </div>

            <form class="space-y-4" novalidate @submit.prevent="submitPaymentForm">
              <div>
                <label for="payment_amount" class="mb-1 block text-sm font-medium text-gray-700">
                  Valor do Pagamento *
                </label>
                <input
                  id="payment_amount"
                  :value="paymentFormData.amount_input"
                  type="text"
                  autofocus
                  inputmode="numeric"
                  placeholder="R$ 0,00"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handlePaymentAmountInput"
                />
                <div v-if="paymentFormErrors.amount_cents" class="mt-1 text-xs text-danger">
                  {{ paymentFormErrors.amount_cents[0] }}
                </div>
              </div>

              <div>
                <label for="payment_pin" class="mb-1 block text-sm font-medium text-gray-700">
                  PIN do Administrador *
                </label>
                <input
                  id="payment_pin"
                  v-model="paymentFormData.pin"
                  type="password"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="••••••"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handlePaymentPinInput"
                />
                <div v-if="paymentFormErrors.pin" class="mt-1 text-xs text-danger">
                  {{ paymentFormErrors.pin[0] }}
                </div>
              </div>

              <div class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  class="min-h-11 rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closePaymentModal"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="paymentLoading"
                  class="min-h-11 flex items-center gap-2 rounded bg-success px-4 py-2 font-medium text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    v-if="paymentLoading"
                    class="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>{{ paymentLoading ? "Processando..." : "Confirmar Pagamento" }}</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>

        <!-- Create/Edit Modal -->
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-form-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closeModal"></div>
          <div class="relative w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:mx-auto sm:max-w-md sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden"></div>
            <div class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 id="customer-form-modal-title" class="text-xl font-bold text-gray-900">
                {{ isEditMode ? "Editar Cliente" : "Novo Cliente" }}
              </h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar modal"
                @click="closeModal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div
              v-if="formErrors.submit"
              class="mb-4 rounded bg-red-100 p-3 text-sm text-danger"
              role="alert"
            >
              {{ formErrors.submit }}
            </div>

            <form class="space-y-4" novalidate @submit.prevent="submitForm">
              <div>
                <label for="name" class="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
                <input
                  id="name"
                  v-model="formData.name"
                  type="text"
                  autofocus
                  maxlength="100"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div v-if="formErrors.name" class="mt-1 text-xs text-danger">{{ formErrors.name[0] }}</div>
              </div>

              <div>
                <label for="phone" class="mb-1 block text-sm font-medium text-gray-700">Telefone</label>
                <input
                  id="phone"
                  :value="formData.phone"
                  type="text"
                  inputmode="numeric"
                  placeholder="(81) 9 1234-5678"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handlePhoneInput"
                />
                <div v-if="formErrors.phone" class="mt-1 text-xs text-danger">{{ formErrors.phone[0] }}</div>
              </div>

              <div>
                <label for="credit_limit" class="mb-1 block text-sm font-medium text-gray-700">
                  Limite de Fiado *
                </label>
                <input
                  id="credit_limit"
                  :value="formData.credit_limit_input"
                  type="text"
                  inputmode="numeric"
                  placeholder="R$ 0,00"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleCreditLimitInput"
                />
                <div v-if="formErrors.credit_limit_cents" class="mt-1 text-xs text-danger">
                  {{ formErrors.credit_limit_cents[0] }}
                </div>
              </div>

              <div>
                <label for="payment_due_day" class="mb-1 block text-sm font-medium text-gray-700">
                  Dia de Pagamento
                </label>
                <input
                  id="payment_due_day"
                  :value="formData.payment_due_day"
                  type="text"
                  maxlength="2"
                  inputmode="numeric"
                  placeholder="Ex.: 5"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handlePaymentDueDayInput"
                />
                <p class="mt-1 text-xs text-gray-500">
                  {{
                    formData.payment_due_day
                      ? `Todo dia ${formData.payment_due_day} do mês`
                      : "Defina o dia preferencial de pagamento"
                  }}
                </p>
                <div v-if="formErrors.payment_due_day" class="mt-1 text-xs text-danger">
                  {{ formErrors.payment_due_day[0] }}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <input
                  id="is_active"
                  v-model="formData.is_active"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
                />
                <label for="is_active" class="text-sm font-medium text-gray-700">Ativo</label>
              </div>

              <div class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  class="min-h-11 rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closeModal"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="loadingSubmit"
                  class="min-h-11 flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    v-if="loadingSubmit"
                    class="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>{{ loadingSubmit ? "Salvando..." : "Salvar" }}</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>

        <div
          v-if="showToast"
          :role="toastType === 'error' ? 'alert' : 'status'"
          :aria-live="toastType === 'error' ? 'assertive' : 'polite'"
          aria-atomic="true"
          :class="[
            'fixed bottom-4 right-4 z-50 rounded-lg px-6 py-3 text-white shadow-lg',
            toastType === 'error' ? 'bg-danger' : toastType === 'warning' ? 'bg-warning' : 'bg-success',
          ]"
        >
          {{ toastMessage }}
        </div>
      </main>
    </div>
  </div>

  <ConfirmDialog
    :open="showConfirm"
    :title="confirmTitle"
    :message="confirmMessage"
    :confirm-label="confirmLabel"
    @confirm="onConfirm"
    @cancel="onCancel"
  />
</template>
