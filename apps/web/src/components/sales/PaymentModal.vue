<script setup lang="ts">
import { computed, nextTick, ref, onMounted, watch } from "vue";
import {
  formatCents,
  PAYMENT_METHODS,
  type CardMachine,
  type Customer,
  type PaymentMethod,
} from "@pdv/shared";
import { useApi } from "@/composables/use-api.js";
import { useFormatting } from "@/composables/use-formatting.js";
import { useSaleDomain } from "@/composables/use-sale-domain.js";
import { useSaleCalculator } from "@/composables/use-sale-calculator.js";
import { useAuthStore } from "@/stores/auth.store.js";
import { useSaleStore } from "@/stores/sale.store.js";

type PaymentEntry = {
  method: PaymentMethod;
  amountInput: string;
  card_machine_id?: string;
  installments?: number;
};

const props = defineProps<{
  terminalId: string;
  paymentRows: PaymentEntry[];
  customer: Customer | null;
}>();

const emit = defineEmits<{
  (e: "update:paymentRows", rows: PaymentEntry[]): void;
  (e: "update:customer", customer: Customer | null): void;
  (e: "cancel"): void;
  (e: "success", data: { saleId: string }): void;
  (e: "open-pix", pixCents: number, payload: any): void;
}>();

const { authenticatedFetch } = useApi();
const {
  normalizePhoneDigits,
  formatPhoneForDisplay,
  formatPhoneForInput,
  parseCurrencyInputToCents,
  formatCurrencyInput: toCurrencyMaskedValue,
} = useFormatting();
const { calcCardRate, applyCardFee, calcChange, validateFiadoCredit, buildSalePayload } = useSaleCalculator();
const { resolvePaymentMethod } = useSaleDomain();
const authStore = useAuthStore();
const saleStore = useSaleStore();

const paymentMethods = [
  { label: "Dinheiro", value: PAYMENT_METHODS.CASH },
  { label: "Pix", value: PAYMENT_METHODS.PIX },
  { label: "Cartão de Crédito", value: PAYMENT_METHODS.CREDIT_CARD },
  { label: "Cartão de Débito", value: PAYMENT_METHODS.DEBIT_CARD },
  { label: "Fiado", value: PAYMENT_METHODS.FIADO },
];

const INACTIVE_CUSTOMER_SEARCH_MESSAGE = "Cliente inativo. Não é possível vinculá-lo a uma venda.";
const INACTIVE_FIADO_MODAL_MESSAGE = "Este cliente está inativo e não pode realizar compras a prazo.";

// Emit wrapper methods
function updateRows(rows: PaymentEntry[]) {
  emit("update:paymentRows", rows);
}
function updateCustomer(c: Customer | null) {
  emit("update:customer", c);
}

// Payment states
const cashReceivedInput = ref("");
const cardMachines = ref<CardMachine[]>([]);
const loadingCardMachines = ref(false);
const paymentLoading = ref(false);
const paymentError = ref<string | null>(null);
const paymentSuccess = ref(false);
const finalizedChangeCents = ref(0);
const finalizedReceivedCents = ref(0);

// Customer states
const customerSearchInput = ref(props.customer?.phone ? formatPhoneForInput(props.customer.phone) : "");
const customerSearchMessage = ref<string | null>(null);
const showCustomerDebt = ref(false);
const showCustomerListModal = ref(false);
const allCustomers = ref<Customer[]>([]);
const loadingCustomers = ref(false);
const customerListError = ref<string | null>(null);
const customerListFilterInput = ref("");

// Change discount states
const showChangeDiscountInput = ref(false);
const changeDiscountInput = ref("");
const changeDiscountError = ref<string | null>(null);
const changeDiscountInputRef = ref<HTMLInputElement | null>(null);

const totalCents = computed(() => saleStore.totalCents);

const paymentRowsTotalCents = computed(() => {
  return props.paymentRows.reduce((sum, row) => sum + getAmountWithFeeCentsForRow(row), 0);
});

const remainingCents = computed(() => totalWithFeesCents.value - paymentRowsTotalCents.value);

const cardPaymentRows = computed(() => {
  return props.paymentRows.filter(
    (row) => row.method === PAYMENT_METHODS.CREDIT_CARD || row.method === PAYMENT_METHODS.DEBIT_CARD
  );
});

const totalFeeCents = computed(() => {
  return props.paymentRows.reduce((sum, row) => sum + getFeeCentsForRow(row), 0);
});

const totalWithFeesCents = computed(() => totalCents.value + totalFeeCents.value);

const feeRateLabel = computed(() => {
  const cardRow = cardPaymentRows.value.find((row) => getFeeCentsForRow(row) > 0);
  if (!cardRow) return "0,00";
  const machine = getSelectedCardMachine(cardRow.card_machine_id);
  if (!machine) return "0,00";
  const rate = getRateByMethod(machine, cardRow.method, cardRow.installments ?? 1);
  return rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

const cashAmountRequiredCents = computed(() => {
  return props.paymentRows
    .filter((row) => row.method === PAYMENT_METHODS.CASH)
    .reduce((sum, row) => sum + parseCurrencyInputToCents(row.amountInput), 0);
});

const cashReceivedCents = computed(() => parseCurrencyInputToCents(cashReceivedInput.value));

const cashChangeCents = computed(() => {
  if (!cashReceivedInput.value.trim()) return 0;
  return calcChange(cashReceivedCents.value, cashAmountRequiredCents.value, 0);
});

const hasFiadoWithoutCustomer = computed(() => {
  return hasFiadoSelectedInPayment.value && !props.customer;
});

const customerListResults = computed(() => {
  const term = customerListFilterInput.value.trim().toLowerCase();
  const activeCustomers = allCustomers.value.filter((c) => c.is_active);
  if (!term) return activeCustomers.slice(0, 50);
  return activeCustomers
    .filter((c) => c.name.toLowerCase().includes(term) || (c.phone || "").includes(term))
    .slice(0, 50);
});

const hasInactiveSelectedCustomer = computed(() => {
  if (!props.customer) return false;
  return !props.customer.is_active;
});

const hasFiadoSelectedInPayment = computed(() => {
  return props.paymentRows.some((row) => row.method === PAYMENT_METHODS.FIADO);
});

const fiadoInactiveCustomerError = computed(() => {
  if (!hasFiadoSelectedInPayment.value) return null;
  if (!hasInactiveSelectedCustomer.value) return null;
  return INACTIVE_FIADO_MODAL_MESSAGE;
});

const availableCreditCents = computed(() => {
  if (!props.customer) return 0;
  return validateFiadoCredit(props.customer.credit_limit_cents, props.customer.current_debt_cents, 0).availableCents;
});

const fiadoAllocationCents = computed(() => {
  const fiadoRow = props.paymentRows.find((row) => row.method === PAYMENT_METHODS.FIADO);
  return fiadoRow ? parseCurrencyInputToCents(fiadoRow.amountInput) : 0;
});

const hasFiadoInsufficientCredit = computed(() => {
  if (!hasFiadoSelectedInPayment.value) return false;
  if (!props.customer) return false;
  return !validateFiadoCredit(props.customer.credit_limit_cents, props.customer.current_debt_cents, fiadoAllocationCents.value).valid;
});

const usedPaymentMethods = computed(() => props.paymentRows.map((row) => row.method));
const availablePaymentMethods = computed(() => paymentMethods.filter((m) => !usedPaymentMethods.value.includes(m.value)));
const canAddMorePaymentRows = computed(() => props.paymentRows.length < 2 && availablePaymentMethods.value.length > 0);
const hasPixPayment = computed(() => props.paymentRows.some((row) => row.method === PAYMENT_METHODS.PIX));
const isCashOnlyPayment = computed(() => props.paymentRows.length === 1 && props.paymentRows[0]?.method === PAYMENT_METHODS.CASH);
const hasAppliedChangeDiscount = computed(() => saleStore.discountCents > 0);
const appliedChangeDiscountMessage = computed(() => {
  if (!hasAppliedChangeDiscount.value) return "";
  return `Desconto de ${formatCents(saleStore.discountCents)} aplicado.`;
});

const pixPaymentCents = computed(() => {
  const pixRow = props.paymentRows.find((row) => row.method === PAYMENT_METHODS.PIX);
  return pixRow ? parseCurrencyInputToCents(pixRow.amountInput) : 0;
});


onMounted(() => {
  void loadActiveCardMachines();
});

watch(() => showChangeDiscountInput.value, async (isVisible) => {
  if (isVisible) {
    await nextTick();
    changeDiscountInputRef.value?.focus();
  }
});

watch(() => isCashOnlyPayment.value, (isCashOnly) => {
  if (isCashOnly) return;
  cancelChangeDiscountInput();
  if (hasAppliedChangeDiscount.value) {
    saleStore.removeChangeDiscount();
  }
});

function handlePaymentRowCurrencyInput(event: Event, rowIndex: number): void {
  const target = event.target as HTMLInputElement;
  const newRows = [...props.paymentRows];
  const row = newRows[rowIndex];
  if (!row) return;

  row.amountInput = toCurrencyMaskedValue(target.value);

  if (newRows.length === 2) {
    const otherIndex = rowIndex === 0 ? 1 : 0;
    const otherRow = newRows[otherIndex];
    if (otherRow) {
      const currentCents = parseCurrencyInputToCents(row.amountInput);
      const remCents = Math.max(0, totalCents.value - currentCents);
      otherRow.amountInput = formatCents(remCents);
    }
  }

  updateRows(newRows);
}

function handlePaymentMethodChange(rowIndex: number): void {
  const newRows = [...props.paymentRows];
  const row = newRows[rowIndex];
  if (!row) return;

  if (!isCardMethod(row.method)) {
    row.card_machine_id = undefined;
    row.installments = 1;
    updateRows(newRows);
    return;
  }

  const firstActive = cardMachines.value.find((m) => m.is_active);
  row.card_machine_id = firstActive?.id ?? undefined;
  row.installments = 1;
  updateRows(newRows);
}

function isCardMethod(method: PaymentMethod): boolean {
  return method === PAYMENT_METHODS.CREDIT_CARD || method === PAYMENT_METHODS.DEBIT_CARD;
}

function getSelectedCardMachine(cardMachineId?: string): CardMachine | null {
  if (!cardMachineId) return null;
  return cardMachines.value.find((m) => m.id === cardMachineId) ?? null;
}

function getRateByMethod(machine: CardMachine, method: PaymentMethod, installments = 1): number {
  const rate = machine.rates[0];
  if (!rate) return 0;
  if (method === PAYMENT_METHODS.CREDIT_CARD) return calcCardRate(rate.credit_base_rate, rate.credit_incremental_rate, installments);
  if (method === PAYMENT_METHODS.DEBIT_CARD) return rate.debit_rate;
  return 0;
}

function getInstallmentOptions(row: PaymentEntry): { value: number; label: string }[] {
  const machine = getSelectedCardMachine(row.card_machine_id);
  const maxInstallments = machine?.rates[0]?.max_installments ?? 1;

  return Array.from({ length: maxInstallments }, (_, i) => {
    const n = i + 1;
    const rate = machine ? getRateByMethod(machine, PAYMENT_METHODS.CREDIT_CARD, n) : 0;
    const rateLabel = rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      value: n,
      label: n === 1 ? `1x à vista (${rateLabel}%)` : `${n}x (${rateLabel}%)`,
    };
  });
}

function getFeeCentsForRow(row: PaymentEntry): number {
  if (!isCardMethod(row.method)) return 0;
  const machine = getSelectedCardMachine(row.card_machine_id);
  if (!machine || machine.absorb_fee) return 0;
  const amountCents = parseCurrencyInputToCents(row.amountInput);
  if (amountCents <= 0) return 0;
  const rate = getRateByMethod(machine, row.method, row.installments ?? 1);
  return applyCardFee(amountCents, rate) - amountCents;
}

function getAmountWithFeeCentsForRow(row: PaymentEntry): number {
  return parseCurrencyInputToCents(row.amountInput) + getFeeCentsForRow(row);
}

function buildPaymentsWithFees(): Array<{ method: PaymentMethod; amount_cents: number; installments?: number; applied_rate?: number }> {
  return props.paymentRows.map((row) => {
    const amountWithFee = getAmountWithFeeCentsForRow(row);
    const machine = getSelectedCardMachine(row.card_machine_id);
    const entry: { method: PaymentMethod; amount_cents: number; installments?: number; applied_rate?: number } = {
      method: row.method,
      amount_cents: amountWithFee,
    };

    if (row.method === PAYMENT_METHODS.CREDIT_CARD && row.installments) {
      entry.installments = row.installments;
      if (machine) {
        entry.applied_rate = getRateByMethod(machine, row.method, row.installments);
      }
    }
    return entry;
  });
}

function updateFinalizedPaymentSummary(): void {
  finalizedReceivedCents.value = paymentRowsTotalCents.value;
  finalizedChangeCents.value = cashChangeCents.value;
}

async function loadActiveCardMachines(): Promise<void> {
  loadingCardMachines.value = true;
  try {
    const response = await authenticatedFetch("/api/card-machines?only_active=true");
    const data = await response.json();

    if (!response.ok) {
      paymentError.value = data.message || "Não foi possível carregar as maquininhas ativas.";
      return;
    }

    cardMachines.value = (data.data as CardMachine[]) ?? [];

    const newRows = [...props.paymentRows];
    for (const row of newRows) {
      if (!isCardMethod(row.method)) continue;
      const exists = cardMachines.value.some((m) => m.id === row.card_machine_id);
      if (!exists) {
        const firstActive = cardMachines.value.find((m) => m.is_active);
        row.card_machine_id = firstActive?.id;
      }
      if (row.method === PAYMENT_METHODS.CREDIT_CARD && row.installments === undefined) {
        row.installments = 1;
      }
    }
    updateRows(newRows);
  } catch (error) {
    paymentError.value = "Erro de conexão ao carregar maquininhas ativas.";
  } finally {
    loadingCardMachines.value = false;
  }
}

function handleChangeDiscountCurrencyInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  changeDiscountInput.value = toCurrencyMaskedValue(target.value);
}

function openChangeDiscountInput(): void {
  showChangeDiscountInput.value = true;
  changeDiscountInput.value = "";
  changeDiscountError.value = null;
}

function cancelChangeDiscountInput(): void {
  showChangeDiscountInput.value = false;
  changeDiscountInput.value = "";
  changeDiscountError.value = null;
}

function confirmChangeDiscount(): void {
  changeDiscountError.value = null;
  const cents = parseCurrencyInputToCents(changeDiscountInput.value);

  if (cents <= 0) {
    cancelChangeDiscountInput();
    return;
  }
  if (cents > 99) {
    changeDiscountError.value = "Desconto de troco não pode exceder R$ 0,99.";
    return;
  }
  if (hasAppliedChangeDiscount.value) {
    changeDiscountError.value = "Desconto de troco já aplicado nesta venda.";
    return;
  }

  saleStore.applyChangeDiscount(cents);
  showChangeDiscountInput.value = false;
  changeDiscountInput.value = "";
}

function removeChangeDiscount(): void {
  saleStore.removeChangeDiscount();
  changeDiscountError.value = null;
}

function handleCashReceivedCurrencyInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  cashReceivedInput.value = toCurrencyMaskedValue(target.value);
}

function addPaymentRow(): void {
  if (!canAddMorePaymentRows.value) return;
  const firstAvailable = availablePaymentMethods.value[0];
  if (!firstAvailable) return;
  
  const newRows = [...props.paymentRows];
  const row: PaymentEntry = { method: firstAvailable.value, amountInput: "", installments: 1 };
  newRows.push(row);
  updateRows(newRows);
  // Re-trigger handle logic on new index
  handlePaymentMethodChange(newRows.length - 1);
}

function removePaymentRow(index: number): void {
  if (props.paymentRows.length === 1) return;
  const newRows = [...props.paymentRows];
  newRows.splice(index, 1);
  updateRows(newRows);
}



async function confirmPayment(): Promise<void> {
  paymentError.value = null;
  paymentLoading.value = true;

  try {
    if (props.paymentRows.length === 0) {
      paymentError.value = "Adicione ao menos uma forma de pagamento.";
      return;
    }

    const informedTotal = paymentRowsTotalCents.value;
    if (informedTotal < totalWithFeesCents.value) {
      paymentError.value = "A soma dos pagamentos é insuficiente para o total da venda.";
      return;
    }

    for (const row of props.paymentRows) {
      if (isCardMethod(row.method) && !row.card_machine_id) {
        paymentError.value = "Selecione a maquininha para pagamentos no cartão.";
        return;
      }
    }

    if (hasFiadoSelectedInPayment.value && !props.customer) {
      paymentError.value = "Selecione um cliente para pagamento em fiado.";
      return;
    }

    if (hasFiadoSelectedInPayment.value && hasInactiveSelectedCustomer.value) {
      paymentError.value = INACTIVE_FIADO_MODAL_MESSAGE;
      return;
    }

    const hasCashReceivedEntry = cashReceivedInput.value.trim().length > 0;
    if (cashAmountRequiredCents.value > 0 && hasCashReceivedEntry && cashReceivedCents.value < cashAmountRequiredCents.value) {
      paymentError.value = "Valor recebido em dinheiro é insuficiente.";
      return;
    }

    const paymentMethod = resolvePaymentMethod(props.paymentRows, PAYMENT_METHODS.MIXED);
    const operatorId = authStore.user?.id;
    if (!operatorId) {
      paymentError.value = "Operador não identificado.";
      return;
    }

    const payments = buildPaymentsWithFees();
    const payload = buildSalePayload({
      terminalId: props.terminalId,
      paymentMethod,
      operatorId,
      payments,
      customerId: props.customer?.id,
      finalTotalCents: totalWithFeesCents.value,
      buildPayload: saleStore.buildPayload,
    });

    if (hasPixPayment.value) {
      emit("open-pix", pixPaymentCents.value, payload);
      return;
    }

    const response = await authenticatedFetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      paymentError.value = data.message || "Falha ao finalizar venda.";
      return;
    }

    updateFinalizedPaymentSummary();
    paymentSuccess.value = true;
    emit("success", { saleId: data.data?.id });

  } catch {
    paymentError.value = "Erro de conexão ao finalizar venda.";
  } finally {
    paymentLoading.value = false;
  }
}

// Customer Methods
function handleCustomerPhoneInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  customerSearchInput.value = formatPhoneForInput(target.value);
}

async function searchCustomer(): Promise<void> {
  const value = customerSearchInput.value.trim();
  customerSearchMessage.value = null;
  if (!value) return;

  try {
    const digitsOnly = normalizePhoneDigits(value);
    const searchValue = digitsOnly || value;
    const response = await authenticatedFetch(`/api/customers?search=${encodeURIComponent(searchValue)}&only_active=true`);
    const data = await response.json();

    if (!response.ok) {
      customerSearchMessage.value = data.message || "Falha ao buscar cliente.";
      return;
    }

    const customers = ((data.data || []) as Customer[]).filter((c) => c.is_active);
    const selected = customers[0] || null;
    updateCustomer(selected);

    if (!selected) {
      const inactiveLookupResponse = await authenticatedFetch(`/api/customers?search=${encodeURIComponent(searchValue)}`);
      const inactiveLookupData = await inactiveLookupResponse.json();
      const hasInactiveMatch = ((inactiveLookupData.data || []) as Customer[]).some((c) => !c.is_active);

      if (hasInactiveMatch) {
        customerSearchMessage.value = INACTIVE_CUSTOMER_SEARCH_MESSAGE;
        return;
      }
      customerSearchMessage.value = "Cliente não cadastrado";
      return;
    }

    customerSearchMessage.value = null;
  } catch {
    customerSearchMessage.value = "Erro de conexão ao buscar cliente.";
  }
}

function clearSelectedCustomer(): void {
  updateCustomer(null);
  customerSearchInput.value = "";
  customerSearchMessage.value = null;
}

function openCustomerListModal(): void {
  showCustomerListModal.value = true;
  customerListFilterInput.value = "";
  customerListError.value = null;

  if (allCustomers.value.length === 0) {
    void loadCustomersForList();
  }
}

async function loadCustomersForList(): Promise<void> {
  loadingCustomers.value = true;
  customerListError.value = null;
  try {
    const response = await authenticatedFetch("/api/customers?only_active=true");
    const data = await response.json();
    if (!response.ok) {
      customerListError.value = data.message || "Não foi possível carregar os clientes.";
      return;
    }
    allCustomers.value = (data.data as Customer[]).filter((c) => c.is_active);
  } catch {
    customerListError.value = "Erro de conexão ao carregar clientes.";
  } finally {
    loadingCustomers.value = false;
  }
}

function selectCustomerFromList(selected: Customer): void {
  if (!selected.is_active) {
    customerSearchMessage.value = INACTIVE_CUSTOMER_SEARCH_MESSAGE;
    return;
  }
  updateCustomer(selected);
  customerSearchInput.value = formatPhoneForInput(selected.phone || "");
  customerSearchMessage.value = null;
  showCustomerListModal.value = false;
}

function closePaymentModalAfterSuccess(): void {
  emit("cancel");
}

function handleOverlayClick() {
  if (!paymentSuccess.value) {
    emit("cancel");
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sales-payment-modal-title"
    @click.self="handleOverlayClick"
  >
    <div class="mx-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-lg">
      <h2 id="sales-payment-modal-title" class="text-lg font-bold text-slate-900">Pagamento e Finalização</h2>

      <div v-if="paymentSuccess" class="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
        <p class="text-base font-semibold text-green-800">Venda concluída com sucesso.</p>
        <p class="mt-2 text-sm text-green-900">Valor recebido: {{ formatCents(finalizedReceivedCents) }}</p>
        <p class="text-sm text-green-900">Troco: {{ formatCents(finalizedChangeCents) }}</p>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="h-10 rounded-md bg-green-700 px-4 font-semibold text-white hover:bg-green-800"
            @click="closePaymentModalAfterSuccess"
          >
            Fechar
          </button>
        </div>
      </div>

      <template v-else>
        <div class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p class="text-sm text-blue-700">Total a pagar</p>
          <p class="text-3xl font-bold text-blue-900">{{ formatCents(totalWithFeesCents) }}</p>
          <div v-if="totalFeeCents > 0" class="mt-2 rounded-md border border-blue-200 bg-white p-2 text-sm">
            <p class="text-gray-700">Total original: {{ formatCents(totalCents) }}</p>
            <p class="text-gray-700">Taxa operadora: {{ formatCents(totalFeeCents) }} ({{ feeRateLabel }}%)</p>
            <p class="font-semibold text-blue-900">Total com taxa: {{ formatCents(totalWithFeesCents) }}</p>
          </div>
        </div>

        <div v-if="hasFiadoSelectedInPayment" class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="mb-2 text-sm font-medium text-slate-700">Cliente (obrigatório para Fiado)</p>
          <div v-if="!customer" class="flex flex-col gap-2 md:flex-row">
            <div class="relative flex-1">
              <input
                :value="customerSearchInput"
                type="text"
                inputmode="tel"
                placeholder="Telefone ou nome do cliente"
                class="h-11 w-full rounded-md border border-slate-300 px-3 pr-10 text-base outline-none focus:border-blue-500"
                @input="handleCustomerPhoneInput"
                @keydown.enter.prevent="searchCustomer"
              />
              <button
                type="button"
                aria-label="Abrir lista de clientes"
                class="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                @click="openCustomerListModal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="h-11 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
              @click="searchCustomer"
            >
              Buscar
            </button>
          </div>

          <div v-if="customer" class="rounded-md border border-slate-200 bg-white p-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-slate-900">{{ customer.name }}</p>
                <p v-if="customer.phone" class="text-sm text-slate-500">
                  Tel: {{ formatPhoneForDisplay(customer.phone) }}
                </p>
                <p class="text-sm text-slate-500">
                  Saldo fiado:
                  <span
                    class="mx-1 inline-block"
                    :class="showCustomerDebt ? '' : 'blur-sm select-none'"
                  >
                    {{ formatCents(Math.max(0, customer.credit_limit_cents - customer.current_debt_cents)) }}
                  </span>
                  <button
                    type="button"
                    class="text-xs font-medium text-blue-700 underline"
                    @click="showCustomerDebt = !showCustomerDebt"
                  >
                    {{ showCustomerDebt ? "Ocultar" : "Mostrar" }}
                  </button>
                </p>
              </div>
              <button
                type="button"
                aria-label="Limpar cliente"
                class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
                @click="clearSelectedCustomer"
              >
                ✕
              </button>
            </div>
          </div>

          <p v-if="customerSearchMessage" class="mt-2 text-sm text-slate-600">{{ customerSearchMessage }}</p>
        </div>

        <div class="mt-4 space-y-3">
          <div
            v-for="(row, index) in paymentRows"
            :key="`payment-row-${index}`"
            class="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-3 md:grid-cols-[1.2fr_1fr_auto]"
          >
            <select
              v-model="row.method"
              class="h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
              @change="handlePaymentMethodChange(index)"
            >
              <option
                v-for="method in paymentMethods"
                :key="method.value"
                :value="method.value"
                :disabled="usedPaymentMethods.includes(method.value) && row.method !== method.value"
              >
                {{ method.label }}
              </option>
            </select>

            <input
              :value="row.amountInput"
              type="text"
              inputmode="numeric"
              placeholder="R$ 0,00"
              class="h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
              @input="(event) => handlePaymentRowCurrencyInput(event, index)"
            />

            <button
              type="button"
              class="h-11 rounded-md border border-slate-300 px-3 text-slate-700 hover:bg-slate-100"
              @click="removePaymentRow(index)"
            >
              Remover
            </button>

            <div
              v-if="isCardMethod(row.method)"
              class="rounded-md border border-slate-200 bg-slate-50 p-3 md:col-span-3"
            >
              <div class="grid grid-cols-1 gap-3" :class="cardMachines.length > 1 && row.method === PAYMENT_METHODS.CREDIT_CARD ? 'md:grid-cols-2' : ''">
                <div v-if="cardMachines.length > 1">
                  <label class="mb-1 block text-xs font-semibold text-slate-700">Maquininha *</label>
                  <select
                    v-model="row.card_machine_id"
                    class="h-10 w-full rounded-md border border-slate-300 px-3 text-base md:text-sm outline-none focus:border-blue-500"
                    :disabled="loadingCardMachines"
                  >
                    <option value="" disabled>Selecione uma maquininha ativa</option>
                    <option v-for="machine in cardMachines" :key="machine.id" :value="machine.id">
                      {{ machine.name }} - {{ machine.absorb_fee ? "Absorver taxa" : "Repassar ao cliente" }}
                    </option>
                  </select>
                </div>

                <div v-if="row.method === PAYMENT_METHODS.CREDIT_CARD">
                  <label class="mb-1 block text-xs font-semibold text-slate-700">Parcelamento</label>
                  <select
                    v-model="row.installments"
                    class="h-10 w-full rounded-md border border-slate-300 px-3 text-base md:text-sm outline-none focus:border-blue-500"
                  >
                    <option
                      v-for="opt in getInstallmentOptions(row)"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
              </div>

              <p v-if="getFeeCentsForRow(row) > 0" class="mt-2 text-xs text-slate-700">
                Valor base: {{ formatCents(parseCurrencyInputToCents(row.amountInput)) }} | Taxa: {{
                  formatCents(getFeeCentsForRow(row))
                }} | Total com taxa: {{ formatCents(getAmountWithFeeCentsForRow(row)) }}
              </p>
            </div>
          </div>

          <button
            v-if="canAddMorePaymentRows"
            type="button"
            class="flex h-14 w-full items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600"
            @click="addPaymentRow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Adicionar meio de pagamento
          </button>
        </div>

        <div v-if="cashAmountRequiredCents > 0" class="mt-4 rounded-md border border-slate-200 p-3">
          <p class="mb-3 text-sm font-medium text-slate-700">Pagamento em dinheiro</p>

          <div class="flex flex-wrap items-end gap-4">
            <div class="w-1/3 min-w-[140px]">
              <label class="mb-1 block text-sm text-slate-600">Valor recebido</label>
              <input
                :value="cashReceivedInput"
                type="text"
                inputmode="numeric"
                placeholder="R$ 0,00"
                class="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
                @input="handleCashReceivedCurrencyInput"
              />
            </div>

            <p class="mb-3 text-sm text-slate-700 whitespace-nowrap">Troco: <strong>{{ formatCents(cashChangeCents) }}</strong></p>

            <div v-if="isCashOnlyPayment" class="mb-0 flex-1 min-w-[200px]">
              <button
                v-if="!showChangeDiscountInput && !hasAppliedChangeDiscount"
                type="button"
                class="h-11 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                @click="openChangeDiscountInput"
              >
                Desconto de Troco
              </button>

              <div v-else-if="showChangeDiscountInput" class="flex items-center gap-2">
                <input
                  ref="changeDiscountInputRef"
                  :value="changeDiscountInput"
                  type="text"
                  inputmode="numeric"
                  placeholder="R$ 0,00"
                  class="h-11 w-32 rounded-md border border-slate-300 px-3 text-base md:text-sm outline-none focus:border-blue-500"
                  @input="handleChangeDiscountCurrencyInput"
                  @keydown.enter.prevent="confirmChangeDiscount"
                />
                <button
                  type="button"
                  class="h-11 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800"
                  @click="confirmChangeDiscount"
                >
                  Confirmar
                </button>
              </div>

              <div
                v-else-if="hasAppliedChangeDiscount"
                class="inline-flex h-11 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-800"
              >
                <span>{{ appliedChangeDiscountMessage }}</span>
                <button
                  type="button"
                  aria-label="Remover desconto de troco"
                  class="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
                  @click="removeChangeDiscount"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
          <p v-if="isCashOnlyPayment && changeDiscountError" class="mt-2 text-xs text-red-700">{{ changeDiscountError }}</p>
        </div>

        <div v-if="hasFiadoSelectedInPayment && customer" class="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p class="text-sm text-blue-700">
            Crédito disponível:
            <strong :class="hasFiadoInsufficientCredit ? 'text-red-700' : 'text-blue-900'">
              {{ formatCents(availableCreditCents) }}
            </strong>
          </p>
          <p v-if="hasFiadoInsufficientCredit" class="mt-1 text-xs text-red-700">
            Valor alocado ao fiado supera o crédito disponível do cliente.
          </p>
        </div>

        <p v-if="paymentError" role="alert" class="mt-3 text-sm text-red-700">
          {{ paymentError }}
        </p>

        <p v-if="fiadoInactiveCustomerError" role="alert" class="mt-2 text-sm text-amber-700">
          {{ fiadoInactiveCustomerError }}
        </p>

        <div class="mt-4 flex items-center justify-between rounded-md border border-slate-200 p-3">
          <p class="text-sm text-slate-700">
            Saldo restante:
            <strong :class="remainingCents === 0 ? 'text-green-700' : 'text-amber-700'">
              {{ formatCents(Math.abs(remainingCents)) }}
            </strong>
          </p>

          <div class="flex gap-2">
            <button
              type="button"
              class="min-h-11 rounded-md border border-slate-300 px-4 text-slate-700 hover:bg-slate-100"
              @click="emit('cancel')"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="min-h-11 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              :disabled="paymentLoading || hasFiadoWithoutCustomer || !!fiadoInactiveCustomerError || hasFiadoInsufficientCredit"
              @click="confirmPayment"
            >
              {{ paymentLoading ? "Confirmando..." : "Confirmar" }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <div
    v-if="showCustomerListModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sales-customer-list-modal-title"
    @click.self="showCustomerListModal = false"
  >
    <div class="mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-lg">
      <h2 id="sales-customer-list-modal-title" class="text-lg font-bold text-slate-900">Clientes Cadastrados</h2>

      <input
        v-model="customerListFilterInput"
        type="text"
        placeholder="Filtrar por nome ou telefone"
        class="mt-3 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
      />

      <p v-if="customerListError" class="mt-2 text-sm text-red-700">{{ customerListError }}</p>

      <div v-if="loadingCustomers" class="mt-4 text-center text-sm text-slate-500">
        Carregando clientes...
      </div>

      <div v-else-if="customerListResults.length === 0" class="mt-4 text-center text-sm text-slate-500">
        Nenhum cliente encontrado.
      </div>

      <div v-else class="mt-3 max-h-96 overflow-y-auto rounded-md border border-slate-200">
        <button
          v-for="c in customerListResults"
          :key="c.id"
          type="button"
          class="flex w-full items-center justify-between border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50"
          @click="selectCustomerFromList(c)"
        >
          <div>
            <span class="block text-sm font-medium text-slate-900">{{ c.name }}</span>
            <span class="text-xs text-slate-500">
              {{ c.phone ? formatPhoneForDisplay(c.phone) : "Sem telefone" }}
            </span>
          </div>
          <span class="text-xs text-slate-600">
            Saldo: {{ formatCents(Math.max(0, c.credit_limit_cents - c.current_debt_cents)) }}
          </span>
        </button>
      </div>

      <div class="mt-4 flex justify-end">
        <button
          type="button"
          class="h-10 rounded-md border border-slate-300 px-4 text-slate-700 hover:bg-slate-100"
          @click="showCustomerListModal = false"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>
