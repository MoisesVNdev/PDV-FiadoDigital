<script setup lang="ts">
import { formatCents } from "@pdv/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import { useApi } from "@/composables/use-api.js";

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

type SortBy = "name" | "credit_limit_cents" | "payment_due_day" | "current_debt_cents" | "is_active";
type SortOrder = "asc" | "desc";

const { authenticatedFetch } = useApi();

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
const loadingSubmit = ref(false);

const showPaymentModal = ref(false);
const selectedPaymentCustomer = ref<Customer | null>(null);
const paymentFormData = ref<PaymentFormData>({
  amount_input: "",
  pin: "",
});
const paymentFormErrors = ref<PaymentFormErrors>({});
const paymentLoading = ref(false);

const showToast = ref(false);
const toastMessage = ref("");

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

onMounted(async () => {
  await loadCustomers();
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

function handleEscapeKey(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  if (showModal.value) {
    closeModal();
    return;
  }

  if (showPaymentModal.value) {
    closePaymentModal();
  }
}

function normalizePhoneDigits(rawValue: string): string {
  return rawValue.replace(/\D/g, "").slice(0, 11);
}

function formatPhoneForDisplay(rawValue: string | null): string {
  const digits = rawValue ? rawValue.replace(/\D/g, "").slice(0, 11) : "";

  if (!digits) {
    return "-";
  }

  if (digits.length < 3) {
    return `(${digits}`;
  }

  const areaCode = digits.slice(0, 2);
  const firstDigit = digits.slice(2, 3);
  const mid = digits.slice(3, 7);
  const end = digits.slice(7, 11);

  if (!firstDigit) {
    return `(${areaCode})`;
  }

  if (!mid) {
    return `(${areaCode}) ${firstDigit}`;
  }

  if (!end) {
    return `(${areaCode}) ${firstDigit} ${mid}`;
  }

  return `(${areaCode}) ${firstDigit} ${mid}-${end}`;
}

function formatPhoneForInput(rawValue: string): string {
  const digits = normalizePhoneDigits(rawValue);

  if (!digits) {
    return "";
  }

  if (digits.length < 3) {
    return `(${digits}`;
  }

  const areaCode = digits.slice(0, 2);
  const firstDigit = digits.slice(2, 3);
  const mid = digits.slice(3, 7);
  const end = digits.slice(7, 11);

  if (!mid) {
    return `(${areaCode}) ${firstDigit}`;
  }

  if (!end) {
    return `(${areaCode}) ${firstDigit} ${mid}`;
  }

  return `(${areaCode}) ${firstDigit} ${mid}-${end}`;
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

function showSuccessToast(message: string): void {
  toastMessage.value = message;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
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
    paymentFormErrors.value.submit = ["Cliente não selecionado"];
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

async function submitForm(): Promise<void> {
  if (!validateForm()) {
    formErrors.value.submit = "Revise os campos destacados para continuar.";
    return;
  }

  loadingSubmit.value = true;
  formErrors.value.submit = undefined;

  const creditLimitCents = parseCurrencyToCents(formData.value.credit_limit_input);
  const paymentDueDay = formData.value.payment_due_day
    ? Number.parseInt(formData.value.payment_due_day, 10)
    : undefined;

  const payload = {
    name: formData.value.name.trim(),
    phone: normalizePhoneDigits(formData.value.phone) || undefined,
    credit_limit_cents: creditLimitCents ?? 0,
    payment_due_day: paymentDueDay,
    is_active: formData.value.is_active,
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
    await loadCustomers();
    showSuccessToast("Pagamento de fiado registrado com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar pagamento:", error);
    paymentFormErrors.value.submit = "Erro de conexão com o servidor";
  } finally {
    paymentLoading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">
        <div class="mb-6 flex items-center justify-between">
          <h1 class="text-3xl font-bold text-gray-900">Clientes</h1>
          <button
            type="button"
            @click="openCreateModal"
            class="rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark"
          >
            + Novo Cliente
          </button>
        </div>

        <!-- Search Bar -->
        <div class="mb-6 flex gap-2">
          <input
            v-model="searchInput"
            type="text"
            placeholder="Buscar por nome ou telefone..."
            class="flex-1 rounded border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            v-if="searchInput"
            type="button"
            @click="clearSearch"
            class="rounded bg-gray-200 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-300"
          >
            ✕ Limpar
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

        <!-- Table -->
        <div v-else class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table class="w-full min-w-[1200px]">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  @click="toggleSortOrder('name')"
                >
                  <span class="flex items-center gap-2">
                    Nome
                    <span class="text-xs">{{ getSortIcon("name") }}</span>
                  </span>
                </th>
                <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Telefone</th>
                <th
                  class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  @click="toggleSortOrder('credit_limit_cents')"
                >
                  <span class="flex items-center gap-2">
                    Limite de Fiado
                    <span class="text-xs">{{ getSortIcon("credit_limit_cents") }}</span>
                  </span>
                </th>
                <th
                  class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  @click="toggleSortOrder('payment_due_day')"
                >
                  <span class="flex items-center gap-2">
                    Dia de Pagamento
                    <span class="text-xs">{{ getSortIcon("payment_due_day") }}</span>
                  </span>
                </th>
                <th
                  class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  @click="toggleSortOrder('current_debt_cents')"
                >
                  <span class="flex items-center gap-2">
                    Fiado Atual
                    <span class="text-xs">{{ getSortIcon("current_debt_cents") }}</span>
                  </span>
                </th>
                <th
                  class="cursor-pointer px-6 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  @click="toggleSortOrder('is_active')"
                >
                  <span class="flex items-center gap-2">
                    Status
                    <span class="text-xs">{{ getSortIcon("is_active") }}</span>
                  </span>
                </th>
                <th class="px-6 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
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
                      class="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
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
                      :aria-label="'Registrar pagamento de fiado para ' + customer.name"
                      class="rounded p-1.5 text-primary transition hover:bg-gray-100"
                      @click="openPaymentModal(customer)"
                    >
                      💲
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
                    class="rounded p-2 text-primary transition hover:bg-gray-100"
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

        <!-- Payment Modal -->
        <div
          v-if="showPaymentModal && selectedPaymentCustomer"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="closePaymentModal"
        >
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900">Registrar Pagamento de Fiado</h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
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
                  inputmode="numeric"
                  placeholder="R$ 0,00"
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handlePaymentPinInput"
                />
                <div v-if="paymentFormErrors.pin" class="mt-1 text-xs text-danger">
                  {{ paymentFormErrors.pin[0] }}
                </div>
              </div>

              <div class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closePaymentModal"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="paymentLoading"
                  class="flex items-center gap-2 rounded bg-success px-4 py-2 font-medium text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
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

        <!-- Create/Edit Modal -->
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="closeModal"
        >
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900">
                {{ isEditMode ? "Editar Cliente" : "Novo Cliente" }}
              </h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
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
                  maxlength="100"
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closeModal"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="loadingSubmit"
                  class="flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
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

        <div
          v-if="showToast"
          class="fixed bottom-4 right-4 z-50 rounded-lg bg-success px-6 py-3 text-white shadow-lg"
          role="alert"
        >
          {{ toastMessage }}
        </div>
      </main>
    </div>
  </div>
</template>
