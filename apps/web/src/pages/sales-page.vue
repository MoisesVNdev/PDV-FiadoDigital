<script setup lang="ts">
import {
  formatCents,
  PAYMENT_METHODS,
  type CardMachine,
  type CashRegister,
  type Customer,
  type PaymentMethod,
  type Product,
} from "@pdv/shared";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { RecycleScroller } from "vue-virtual-scroller";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import ConfirmDialog from "@/components/layout/confirm-dialog.vue";
import { useApi } from "@/composables/use-api.js";
import { useConfirm } from "@/composables/use-confirm.js";
import { useFormatting } from "@/composables/use-formatting.js";
import { useSaleCalculator } from "@/composables/use-sale-calculator.js";
import { useWebSocket } from "@/composables/use-websocket.js";
import { useAuthStore } from "@/stores/auth.store.js";
import { useSaleStore } from "@/stores/sale.store.js";

type ManagerPinAction = "remove-item" | "cancel-sale";

type PendingManagerPin = {
  action: ManagerPinAction;
  productId?: string;
};

type PaymentEntry = {
  method: PaymentMethod;
  amountInput: string;
  card_machine_id?: string;
  installments?: number;
};

const { authenticatedFetch } = useApi();
const {
  normalizePhoneDigits,
  formatPhoneForDisplay,
  formatPhoneForInput,
  formatStockQuantity,
  parseCurrencyInputToCents,
  formatCurrencyInput: toCurrencyMaskedValue,
} = useFormatting();
const { calcCardRate, applyCardFee, calcChange, validateFiadoCredit, buildSalePayload } = useSaleCalculator();
const authStore = useAuthStore();
const saleStore = useSaleStore();
const { isConnected, connectionWarning: wsConnectionWarning, lastMessage } = useWebSocket();

const terminalId = ref(localStorage.getItem("pdv_terminal_id") || "PDV-01");

const { showConfirm, confirmTitle, confirmMessage, confirmLabel, confirm, onConfirm, onCancel } = useConfirm();
const pixCopied = ref(false);
const showHotkeys = ref(false);

if (!localStorage.getItem("pdv_terminal_id")) {
  localStorage.setItem("pdv_terminal_id", terminalId.value);
}

const now = ref(new Date());
const isOnline = ref(navigator.onLine);
const isCheckingCashRegister = ref(true);
const openCashRegister = ref<CashRegister | null>(null);
const cashRegisterError = ref<string | null>(null);

const showOpenCashModal = ref(false);
const openingBalanceInput = ref("");
const openingCashError = ref<string | null>(null);
const openingCashLoading = ref(false);

const customerSearchInput = ref("");
const selectedCustomer = ref<Customer | null>(null);
const customerSearchMessage = ref<string | null>(null);
const showCustomerDebt = ref(false);
const showCustomerListModal = ref(false);
const allCustomers = ref<Customer[]>([]);
const loadingCustomers = ref(false);
const customerListError = ref<string | null>(null);
const customerListFilterInput = ref("");

const productEntryInput = ref("");
const productInputRef = ref<HTMLInputElement | null>(null);
const productMessage = ref<string | null>(null);
const productLoading = ref(false);

const selectedItemProductId = ref<string | null>(null);

const showChangeDiscountInput = ref(false);
const changeDiscountInput = ref("");
const changeDiscountError = ref<string | null>(null);
const changeDiscountInputRef = ref<HTMLInputElement | null>(null);

const showManagerPinModal = ref(false);
const managerPin = ref("");
const managerPinError = ref<string | null>(null);
const managerPinLoading = ref(false);
const pendingManagerPinAction = ref<PendingManagerPin | null>(null);

const showWeightModal = ref(false);
const weightedProduct = ref<Product | null>(null);
const rawWeight = ref(0);
const weightedInputRef = ref<HTMLInputElement | null>(null);
const weightedModalError = ref<string | null>(null);

const showProductSearchModal = ref(false);
const productSearchInput = ref("");
const productSearchResults = ref<Product[]>([]);
const loadingAllProducts = ref(false);
const productSearchError = ref<string | null>(null);
let productSearchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

const showPaymentModal = ref(false);
const paymentRows = ref<PaymentEntry[]>([{ method: PAYMENT_METHODS.CASH, amountInput: "" }]);
const cashReceivedInput = ref("");
const cardMachines = ref<CardMachine[]>([]);
const loadingCardMachines = ref(false);
const paymentLoading = ref(false);
const paymentError = ref<string | null>(null);
const paymentSuccess = ref(false);
const finalizedChangeCents = ref(0);
const finalizedReceivedCents = ref(0);

// Estados para fluxo do Pix QR Code
const showPixQRCodeModal = ref(false);
const pixQRCodePayload = ref<string>("");
const pixQRCodeCents = ref<number>(0);
const pixQRCodeTxId = ref<string>("");
const pixQRCodeMerchantName = ref<string>("");
const pixQRCodeTimeoutSeconds = ref<number>(300); // 5 minutos
const pixQRCodeLoading = ref(false);
const pixQRCodeError = ref<string | null>(null);
const pixQRCodeExpired = ref(false);
const pixQRCodeCanvasRef = ref<HTMLCanvasElement | null>(null);
const showPixManualConfirmModal = ref(false);
const pixStatusPollingError = ref<string | null>(null);
const pixStatusLabel = ref<string>("Aguardando confirmação do Pix...");

let pixQRCodeCountdownInterval: ReturnType<typeof setInterval> | null = null;
let pixStatusPollingInterval: ReturnType<typeof setInterval> | null = null;

const showCashOutModal = ref(false);
const showCashInModal = ref(false);
const movementAmountInput = ref("");
const movementDescription = ref("");
const movementLoading = ref(false);
const movementError = ref<string | null>(null);

const stockAlertToasts = ref<Array<{ id: string; message: string; productId: string }>>([]);

const INACTIVE_CUSTOMER_SEARCH_MESSAGE =
  "Cliente inativo. Não é possível vinculá-lo a uma venda.";
const INACTIVE_FIADO_MODAL_MESSAGE =
  "Este cliente está inativo e não pode realizar compras a prazo.";

let clockInterval: ReturnType<typeof setInterval> | null = null;
let scannerBuffer = "";
let scannerTimer: ReturnType<typeof setTimeout> | null = null;

const hasModalOpen = computed(
  () =>
    showOpenCashModal.value ||
    showManagerPinModal.value ||
    showWeightModal.value ||
    showProductSearchModal.value ||
    showPaymentModal.value ||
    showPixQRCodeModal.value ||
    showPixManualConfirmModal.value ||
    showCashOutModal.value ||
    showCashInModal.value ||
    showCustomerListModal.value,
);

const subtotalCents = computed(() => saleStore.subtotalCents);
const totalCents = computed(() => saleStore.totalCents);

const paymentMethods = [
  { label: "Dinheiro", value: PAYMENT_METHODS.CASH },
  { label: "Pix", value: PAYMENT_METHODS.PIX },
  { label: "Cartão de Crédito", value: PAYMENT_METHODS.CREDIT_CARD },
  { label: "Cartão de Débito", value: PAYMENT_METHODS.DEBIT_CARD },
  { label: "Fiado", value: PAYMENT_METHODS.FIADO },
];

const paymentRowsTotalCents = computed(() => {
  return paymentRows.value.reduce((sum, row) => {
    return sum + getAmountWithFeeCentsForRow(row);
  }, 0);
});

const remainingCents = computed(() => totalWithFeesCents.value - paymentRowsTotalCents.value);

const cardPaymentRows = computed(() => {
  return paymentRows.value.filter((row) => {
    return row.method === PAYMENT_METHODS.CREDIT_CARD || row.method === PAYMENT_METHODS.DEBIT_CARD;
  });
});

const totalFeeCents = computed(() => {
  return cardPaymentRows.value.reduce((sum, row) => {
    return sum + getFeeCentsForRow(row);
  }, 0);
});

const totalWithFeesCents = computed(() => {
  return totalCents.value + totalFeeCents.value;
});

const feeRateLabel = computed(() => {
  const cardRow = cardPaymentRows.value.find((row) => getFeeCentsForRow(row) > 0);

  if (!cardRow) {
    return "0,00";
  }

  const machine = getSelectedCardMachine(cardRow.card_machine_id);

  if (!machine) {
    return "0,00";
  }

  const rate = getRateByMethod(machine, cardRow.method, cardRow.installments ?? 1);
  return rate.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

const cashAmountRequiredCents = computed(() => {
  return paymentRows.value
    .filter((row) => row.method === PAYMENT_METHODS.CASH)
    .reduce((sum, row) => sum + parseCurrencyInputToCents(row.amountInput), 0);
});

const cashReceivedCents = computed(() => parseCurrencyInputToCents(cashReceivedInput.value));

const cashChangeCents = computed(() => {
  if (!cashReceivedInput.value.trim()) {
    return 0;
  }

  return calcChange(cashReceivedCents.value, cashAmountRequiredCents.value, 0);
});

const weightedTotalCents = computed(() => {
  if (!weightedProduct.value) {
    return 0;
  }

  return Math.round(weightKg.value * weightedProduct.value.price_cents);
});

const weightKg = computed(() => rawWeight.value / 1000);

const weightedInputDisplay = computed(() => {
  return weightKg.value.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
});

const weightedQuantityDisplay = computed(() => {
  const weightInKg = weightKg.value;

  if (weightInKg <= 0) {
    return "0,000 kg";
  }

  return `${weightInKg.toFixed(3).replace(".", ",")} kg`;
});

const weightedStockAvailableDisplay = computed(() => {
  if (!weightedProduct.value) {
    return "0 kg";
  }

  return formatStockQuantity(weightedProduct.value.stock_quantity, true);
});

const isWeightedOverStock = computed(() => {
  if (!weightedProduct.value) {
    return false;
  }

  return weightKg.value > weightedProduct.value.stock_quantity;
});

const weightedOverStockMessage = computed(() => {
  if (!isWeightedOverStock.value || !weightedProduct.value) {
    return null;
  }

  return `Peso informado supera o estoque disponível (${weightedStockAvailableDisplay.value}).`;
});

const customerCanUseFiado = computed(() => {
  if (!selectedCustomer.value) {
    return false;
  }

  if (!selectedCustomer.value.is_active) {
    return false;
  }

  if (selectedCustomer.value.credit_blocked) {
    return false;
  }

  return validateFiadoCredit(
    selectedCustomer.value.credit_limit_cents,
    selectedCustomer.value.current_debt_cents,
    1,
  ).valid;
});

const customerListResults = computed(() => {
  const term = customerListFilterInput.value.trim().toLowerCase();
  const activeCustomers = allCustomers.value.filter((customer) => customer.is_active);

  if (!term) {
    return activeCustomers.slice(0, 50);
  }

  return activeCustomers
    .filter((customer) => {
      return (
        customer.name.toLowerCase().includes(term) ||
        (customer.phone || "").includes(term)
      );
    })
    .slice(0, 50);
});

const hasInactiveSelectedCustomer = computed(() => {
  if (!selectedCustomer.value) {
    return false;
  }

  return !selectedCustomer.value.is_active;
});

const hasFiadoSelectedInPayment = computed(() => {
  return paymentRows.value.some((row) => row.method === PAYMENT_METHODS.FIADO);
});

const fiadoInactiveCustomerError = computed(() => {
  if (!hasFiadoSelectedInPayment.value) {
    return null;
  }

  if (!hasInactiveSelectedCustomer.value) {
    return null;
  }

  return INACTIVE_FIADO_MODAL_MESSAGE;
});

const availableCreditCents = computed(() => {
  if (!selectedCustomer.value) {
    return 0;
  }

  return validateFiadoCredit(
    selectedCustomer.value.credit_limit_cents,
    selectedCustomer.value.current_debt_cents,
    0,
  ).availableCents;
});

const fiadoAllocationCents = computed(() => {
  const fiadoRow = paymentRows.value.find((row) => row.method === PAYMENT_METHODS.FIADO);
  return fiadoRow ? parseCurrencyInputToCents(fiadoRow.amountInput) : 0;
});

const hasFiadoInsufficientCredit = computed(() => {
  if (!hasFiadoSelectedInPayment.value) {
    return false;
  }

  if (!selectedCustomer.value) {
    return false;
  }

  return !validateFiadoCredit(
    selectedCustomer.value.credit_limit_cents,
    selectedCustomer.value.current_debt_cents,
    fiadoAllocationCents.value,
  ).valid;
});

const usedPaymentMethods = computed(() => {
  return paymentRows.value.map((row) => row.method);
});

const availablePaymentMethods = computed(() => {
  return paymentMethods.filter((method) => !usedPaymentMethods.value.includes(method.value));
});

const canAddMorePaymentRows = computed(() => {
  return paymentRows.value.length < 2 && availablePaymentMethods.value.length > 0;
});

const hasPixPayment = computed(() => {
  return paymentRows.value.some((row) => row.method === PAYMENT_METHODS.PIX);
});

const isCashOnlyPayment = computed(() => {
  if (paymentRows.value.length !== 1) {
    return false;
  }

  return paymentRows.value[0]?.method === PAYMENT_METHODS.CASH;
});

const hasAppliedChangeDiscount = computed(() => saleStore.discountCents > 0);
const appliedChangeDiscountMessage = computed(() => {
  if (!hasAppliedChangeDiscount.value) {
    return "";
  }

  return `Desconto de ${formatCents(saleStore.discountCents)} aplicado.`;
});

const pixPaymentCents = computed(() => {
  const pixRow = paymentRows.value.find((row) => row.method === PAYMENT_METHODS.PIX);
  return pixRow ? parseCurrencyInputToCents(pixRow.amountInput) : 0;
});

const pixQRCodeTimeoutFormatted = computed(() => {
  const minutes = Math.floor(pixQRCodeTimeoutSeconds.value / 60);
  const seconds = pixQRCodeTimeoutSeconds.value % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
});

const pixKeySuffix = computed(() => {
  const key = extractPixKeyFromPayload(pixQRCodePayload.value);

  if (!key) {
    return "não disponível";
  }

  return `...${key.slice(-4)}`;
});

onMounted(async () => {
  await checkOpenCashRegister();

  clockInterval = setInterval(() => {
    now.value = new Date();
  }, 1000);

  window.addEventListener("online", handleOnlineStatus);
  window.addEventListener("offline", handleOnlineStatus);
  window.addEventListener("keydown", handleGlobalKeydown);

  restoreProductInputFocus();
});

onUnmounted(() => {
  if (clockInterval) {
    clearInterval(clockInterval);
  }

  if (productSearchDebounceTimeout) {
    clearTimeout(productSearchDebounceTimeout);
    productSearchDebounceTimeout = null;
  }

  window.removeEventListener("online", handleOnlineStatus);
  window.removeEventListener("offline", handleOnlineStatus);
  window.removeEventListener("keydown", handleGlobalKeydown);

  if (scannerTimer) {
    clearTimeout(scannerTimer);
  }

  stopPixQRCodeCountdown();
  stopPixStatusPolling();
});

watch(
  () => hasModalOpen.value,
  (isOpen) => {
    if (isOpen) {
      return;
    }

    restoreProductInputFocus();
  },
);

watch(productSearchInput, (value) => {
  if (!showProductSearchModal.value) {
    return;
  }

  if (productSearchDebounceTimeout) {
    clearTimeout(productSearchDebounceTimeout);
    productSearchDebounceTimeout = null;
  }

  const query = value.trim();

  if (query.length < 2) {
    productSearchResults.value = [];
    productSearchError.value = null;
    loadingAllProducts.value = false;
    return;
  }

  productSearchDebounceTimeout = setTimeout(() => {
    void searchProductsServer(query);
  }, 300);
});

watch(
  () => showWeightModal.value,
  async (isOpen) => {
    if (!isOpen) {
      return;
    }

    rawWeight.value = 0;
    await focusWeightedInput();
  },
);

watch(
  () => showChangeDiscountInput.value,
  async (isVisible) => {
    if (!isVisible) {
      return;
    }

    await nextTick();
    changeDiscountInputRef.value?.focus();
  },
);

watch(
  () => isCashOnlyPayment.value,
  (isCashOnly) => {
    if (isCashOnly) {
      return;
    }

    cancelChangeDiscountInput();

    if (hasAppliedChangeDiscount.value) {
      saleStore.removeChangeDiscount();
    }
  },
);

watch(
  () => lastMessage.value,
  (message) => {
    if (!message) {
      return;
    }

    if (message.type === "stock.low_alert") {
      const payload = message.payload as {
        productId: string;
        productName: string;
        stock_quantity: number;
        min_stock_alert: number;
      };

      const toastId = `stock-alert-${payload.productId}-${Date.now()}`;
      const alertMessage = `⚠️ Estoque baixo: ${payload.productName} (${payload.stock_quantity} ${payload.stock_quantity === 1 ? "unidade restante" : "unidades restantes"})`;

      stockAlertToasts.value.push({
        id: toastId,
        message: alertMessage,
        productId: payload.productId,
      });

      // Remove o toast após 5 segundos
      setTimeout(() => {
        removeStockAlertToast(toastId);
      }, 5000);
    }
  },
);

function handleOnlineStatus(): void {
  isOnline.value = navigator.onLine;
}

function removeStockAlertToast(toastId: string): void {
  const index = stockAlertToasts.value.findIndex((toast) => toast.id === toastId);
  
  if (index !== -1) {
    stockAlertToasts.value.splice(index, 1);
  }
}

function formatDateTime(value: Date): string {
  return value.toLocaleString("pt-BR");
}

function parsePixTlv(rawValue: string): Map<string, string> {
  const fields = new Map<string, string>();
  let offset = 0;

  while (offset + 4 <= rawValue.length) {
    const id = rawValue.slice(offset, offset + 2);
    const size = Number.parseInt(rawValue.slice(offset + 2, offset + 4), 10);

    if (Number.isNaN(size) || size < 0) {
      break;
    }

    const start = offset + 4;
    const end = start + size;

    if (end > rawValue.length) {
      break;
    }

    fields.set(id, rawValue.slice(start, end));
    offset = end;
  }

  return fields;
}

function extractPixKeyFromPayload(payload: string): string | null {
  if (!payload) {
    return null;
  }

  const topLevelFields = parsePixTlv(payload);
  const merchantAccountInfo = topLevelFields.get("26");

  if (!merchantAccountInfo) {
    return null;
  }

  const merchantFields = parsePixTlv(merchantAccountInfo);
  const key = merchantFields.get("01");

  if (!key) {
    return null;
  }

  return key.trim();
}

function toSearchProduct(item: unknown): Product {
  return item as Product;
}

function handleCustomerPhoneInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  customerSearchInput.value = formatPhoneForInput(target.value);
}

function restoreProductInputFocus(): void {
  setTimeout(() => {
    productInputRef.value?.focus();
  }, 0);
}

async function focusWeightedInput(): Promise<void> {
  await nextTick();
  weightedInputRef.value?.focus();
}

function handlePaymentRowCurrencyInput(event: Event, row: PaymentEntry): void {
  const target = event.target as HTMLInputElement;
  row.amountInput = toCurrencyMaskedValue(target.value);
}

function isCardMethod(method: PaymentMethod): boolean {
  return method === PAYMENT_METHODS.CREDIT_CARD || method === PAYMENT_METHODS.DEBIT_CARD;
}

function getSelectedCardMachine(cardMachineId?: string): CardMachine | null {
  if (!cardMachineId) {
    return null;
  }

  return cardMachines.value.find((machine) => machine.id === cardMachineId) ?? null;
}

function getRateByMethod(machine: CardMachine, method: PaymentMethod, installments = 1): number {
  const rate = machine.rates[0];

  if (!rate) {
    return 0;
  }

  if (method === PAYMENT_METHODS.CREDIT_CARD) {
    return calcCardRate(rate.credit_base_rate, rate.credit_incremental_rate, installments);
  }

  if (method === PAYMENT_METHODS.DEBIT_CARD) {
    return rate.debit_rate;
  }

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
  if (!isCardMethod(row.method)) {
    return 0;
  }

  const machine = getSelectedCardMachine(row.card_machine_id);

  if (!machine || machine.absorb_fee) {
    return 0;
  }

  const amountCents = parseCurrencyInputToCents(row.amountInput);

  if (amountCents <= 0) {
    return 0;
  }

  const rate = getRateByMethod(machine, row.method, row.installments ?? 1);
  return applyCardFee(amountCents, rate) - amountCents;
}

function getAmountWithFeeCentsForRow(row: PaymentEntry): number {
  return parseCurrencyInputToCents(row.amountInput) + getFeeCentsForRow(row);
}

function buildPaymentsWithFees(): Array<{ method: PaymentMethod; amount_cents: number; installments?: number; applied_rate?: number }> {
  return paymentRows.value.map((row) => {
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

function handlePaymentMethodChange(row: PaymentEntry): void {
  if (!isCardMethod(row.method)) {
    row.card_machine_id = undefined;
    row.installments = undefined;
    return;
  }

  const firstActive = cardMachines.value.find((machine) => machine.is_active);
  row.card_machine_id = firstActive?.id;

  if (row.method === PAYMENT_METHODS.CREDIT_CARD) {
    row.installments = 1;
  } else {
    row.installments = undefined;
  }
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

    for (const row of paymentRows.value) {
      if (!isCardMethod(row.method)) {
        continue;
      }

      const exists = cardMachines.value.some((machine) => machine.id === row.card_machine_id);

      if (!exists) {
        const firstActive = cardMachines.value.find((machine) => machine.is_active);
        row.card_machine_id = firstActive?.id;
      }

      if (row.method === PAYMENT_METHODS.CREDIT_CARD && row.installments === undefined) {
        row.installments = 1;
      }
    }
  } catch (error) {
    console.error("Erro ao carregar maquininhas ativas:", error);
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

function handleOpeningBalanceCurrencyInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  openingBalanceInput.value = toCurrencyMaskedValue(target.value);
}

function handleCashReceivedCurrencyInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  cashReceivedInput.value = toCurrencyMaskedValue(target.value);
}

function handleMovementAmountCurrencyInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  movementAmountInput.value = toCurrencyMaskedValue(target.value);
}

async function checkOpenCashRegister(): Promise<void> {
  isCheckingCashRegister.value = true;
  cashRegisterError.value = null;

  try {
    const url = `/api/cash-registers?terminal_id=${encodeURIComponent(terminalId.value)}&status=open`;
    const response = await authenticatedFetch(url);
    const data = await response.json();

    if (!response.ok) {
      cashRegisterError.value = data.message || "Não foi possível verificar o caixa.";
      showOpenCashModal.value = true;
      return;
    }

    const list = Array.isArray(data.data) ? (data.data as CashRegister[]) : [];
    openCashRegister.value = list[0] || null;
    showOpenCashModal.value = !openCashRegister.value;
  } catch {
    cashRegisterError.value = "Falha de conexão ao validar caixa aberto.";
    showOpenCashModal.value = true;
  } finally {
    isCheckingCashRegister.value = false;
  }
}

async function submitOpenCashRegister(): Promise<void> {
  openingCashError.value = null;
  openingCashLoading.value = true;

  try {
    const openingBalanceCents = parseCurrencyInputToCents(openingBalanceInput.value);

    if (openingBalanceCents < 0) {
      openingCashError.value = "Valor inválido para abertura de caixa.";
      return;
    }

    const response = await authenticatedFetch("/api/cash-registers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        terminal_id: terminalId.value,
        opening_balance_cents: openingBalanceCents,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      openingCashError.value = data.message || "Não foi possível abrir o caixa.";
      return;
    }

    openCashRegister.value = data.data as CashRegister;
    showOpenCashModal.value = false;
    openingBalanceInput.value = "";
  } catch {
    openingCashError.value = "Erro de conexão ao abrir caixa.";
  } finally {
    openingCashLoading.value = false;
  }
}

async function searchCustomer(): Promise<void> {
  const value = customerSearchInput.value.trim();
  customerSearchMessage.value = null;

  if (!value) {
    return;
  }

  try {
    const digitsOnly = normalizePhoneDigits(value);
    const searchValue = digitsOnly || value;
    const response = await authenticatedFetch(
      `/api/customers?search=${encodeURIComponent(searchValue)}&only_active=true`,
    );
    const data = await response.json();

    if (!response.ok) {
      customerSearchMessage.value = data.message || "Falha ao buscar cliente.";
      return;
    }

    const customers = ((data.data || []) as Customer[]).filter((customer) => customer.is_active);
    selectedCustomer.value = customers[0] || null;

    if (!selectedCustomer.value) {
      const inactiveLookupResponse = await authenticatedFetch(
        `/api/customers?search=${encodeURIComponent(searchValue)}`,
      );
      const inactiveLookupData = await inactiveLookupResponse.json();
      const hasInactiveMatch = ((inactiveLookupData.data || []) as Customer[]).some(
        (customer) => !customer.is_active,
      );

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
  selectedCustomer.value = null;
  customerSearchInput.value = "";
  customerSearchMessage.value = null;
}

function openCustomerListModal(): void {
  showCustomerListModal.value = true;
  customerListFilterInput.value = "";
  customerListError.value = null;

  if (allCustomers.value.length > 0) {
    return;
  }

  loadCustomersForList();
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

    allCustomers.value = (data.data as Customer[]).filter((customer) => customer.is_active);
  } catch {
    customerListError.value = "Erro de conexão ao carregar clientes.";
  } finally {
    loadingCustomers.value = false;
  }
}

function selectCustomerFromList(customer: Customer): void {
  if (!customer.is_active) {
    customerSearchMessage.value = INACTIVE_CUSTOMER_SEARCH_MESSAGE;
    return;
  }

  selectedCustomer.value = customer;
  customerSearchInput.value = formatPhoneForInput(customer.phone || "");
  customerSearchMessage.value = null;
  showCustomerListModal.value = false;
}

async function handleProductEntry(): Promise<void> {
  const value = productEntryInput.value.trim();
  productMessage.value = null;

  if (!value) {
    return;
  }

  const parsed = parseQuantityAndCode(value);
  productLoading.value = true;

  try {
    const product = await findProduct(parsed.code);

    if (!product) {
      productMessage.value = "Produto não encontrado.";
      return;
    }

    if (product.is_bulk || product.weight_unit === "kg" || product.weight_unit === "g") {
      weightedProduct.value = product;
      rawWeight.value = 0;
      weightedModalError.value = null;
      showWeightModal.value = true;
      return;
    }

    addProductToCart(product, parsed.quantity);
    productEntryInput.value = "";
  } catch {
    productMessage.value = "Erro ao consultar produto.";
  } finally {
    productLoading.value = false;
    restoreProductInputFocus();
  }
}

function parseQuantityAndCode(input: string): { quantity: number; code: string } {
  const parsed = input.match(/^(\d+)\*(.+)$/);

  if (!parsed) {
    return { quantity: 1, code: input };
  }

  const quantity = Number.parseInt(parsed[1] || "1", 10);
  const code = (parsed[2] || "").trim();

  if (!Number.isFinite(quantity) || quantity <= 0 || !code) {
    return { quantity: 1, code: input };
  }

  return { quantity, code };
}

async function findProduct(code: string): Promise<Product | null> {
  const byBarcodeResponse = await authenticatedFetch(`/api/products?barcode=${encodeURIComponent(code)}`);
  const byBarcodeData = await byBarcodeResponse.json();

  if (byBarcodeResponse.ok) {
    const byBarcodeList = Array.isArray(byBarcodeData.data) ? (byBarcodeData.data as Product[]) : [];

    if (byBarcodeList.length > 0) {
      return byBarcodeList[0] || null;
    }
  }

  const byIdResponse = await authenticatedFetch(`/api/products/${encodeURIComponent(code)}`);
  const byIdData = await byIdResponse.json();

  if (!byIdResponse.ok) {
    return null;
  }

  return byIdData.data as Product;
}

function addProductToCart(product: Product, quantity: number): void {
  // Verificar estoque disponível
  const existingItem = saleStore.items.find((i) => i.product_id === product.id);
  const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
  const requestedTotal = currentQuantityInCart + quantity;

  if (requestedTotal > product.stock_quantity) {
    productMessage.value = `Estoque insuficiente. Disponível: ${formatStockQuantity(product.stock_quantity, product.is_bulk)}.`;
    return;
  }

  saleStore.addItem({
    product_id: product.id,
    product_name: product.name,
    product_barcode: product.barcode,
    product_description: product.description,
    quantity,
    unit_price_cents: product.price_cents,
    discount_cents: 0,
    stock_quantity: product.stock_quantity,
  });
}

function requestManagerPin(action: PendingManagerPin): void {
  pendingManagerPinAction.value = action;
  managerPin.value = "";
  managerPinError.value = null;
  showManagerPinModal.value = true;
}

async function validateManagerPinAndProceed(): Promise<void> {
  managerPinError.value = null;
  managerPinLoading.value = true;

  try {
    const response = await authenticatedFetch("/api/auth/validate-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: managerPin.value }),
    });
    const data = await response.json();

    if (!response.ok) {
      managerPinError.value = data.message || "PIN inválido.";
      return;
    }

    const pending = pendingManagerPinAction.value;

    if (!pending) {
      showManagerPinModal.value = false;
      return;
    }

    if (pending.action === "remove-item" && pending.productId) {
      saleStore.removeItem(pending.productId);
      selectedItemProductId.value = null;
    }

    if (pending.action === "cancel-sale") {
      resetSaleState();
    }

    showManagerPinModal.value = false;
    pendingManagerPinAction.value = null;
  } catch {
    managerPinError.value = "Erro ao validar PIN.";
  } finally {
    managerPinLoading.value = false;
  }
}

function removeItemWithApproval(productId: string): void {
  if (saleStore.items.length === 0) {
    return;
  }

  requestManagerPin({ action: "remove-item", productId });
}

function incrementItemQuantity(productId: string): void {
  const item = saleStore.items.find((i) => i.product_id === productId);
  
  if (!item) {
    return;
  }

  if (item.is_bulk) {
    return;
  }

  // Validar estoque disponível
  if (item.quantity + 1 > item.stock_quantity) {
    productMessage.value = `Estoque insuficiente. Disponível: ${formatStockQuantity(item.stock_quantity, item.is_bulk ?? false)}.`;
    return;
  }

  saleStore.updateItemQuantity(productId, item.quantity + 1);
}

function decrementItemQuantity(productId: string): void {
  const item = saleStore.items.find((i) => i.product_id === productId);
  
  if (!item) {
    return;
  }

  if (item.is_bulk) {
    return;
  }

  if (item.quantity <= 1) {
    requestManagerPin({ action: "remove-item", productId });
    return;
  }

  saleStore.updateItemQuantity(productId, item.quantity - 1);
}

async function cancelSaleWithApproval(): Promise<void> {
  if (saleStore.items.length === 0) {
    return;
  }

  const ok = await confirm({
    title: "Cancelar venda",
    message: "Tem certeza que deseja cancelar esta venda? Todos os itens do carrinho serão removidos.",
    confirmLabel: "Cancelar venda",
  });

  if (!ok) {
    return;
  }

  requestManagerPin({ action: "cancel-sale" });
}

function openProductSearchModal(): void {
  showProductSearchModal.value = true;
  productSearchInput.value = "";
  productSearchResults.value = [];
  productSearchError.value = null;
  loadingAllProducts.value = false;
}

async function searchProductsServer(query: string): Promise<void> {
  loadingAllProducts.value = true;
  productSearchError.value = null;

  try {
    const response = await authenticatedFetch(
      `/api/products?search=${encodeURIComponent(query)}&per_page=10&page=1`,
    );
    const data = await response.json();

    if (!response.ok) {
      productSearchError.value = data.message || "Não foi possível buscar produtos.";
      return;
    }

    productSearchResults.value = data.data as Product[];
  } catch {
    productSearchError.value = "Erro de conexão ao buscar produtos.";
  } finally {
    loadingAllProducts.value = false;
  }
}

function selectProductFromSearch(product: Product): void {
  if (product.is_bulk || product.weight_unit === "kg" || product.weight_unit === "g") {
    weightedProduct.value = product;
    rawWeight.value = 0;
    weightedModalError.value = null;
    showWeightModal.value = true;
    showProductSearchModal.value = false;
    return;
  }

  addProductToCart(product, 1);
  showProductSearchModal.value = false;
}

function closeTopModal(): void {
  if (showManagerPinModal.value) {
    showManagerPinModal.value = false;
    return;
  }

  if (showWeightModal.value) {
    showWeightModal.value = false;
    return;
  }

  if (showProductSearchModal.value) {
    showProductSearchModal.value = false;
    return;
  }

  if (showPaymentModal.value) {
    showPaymentModal.value = false;
    paymentError.value = null;
    paymentSuccess.value = false;
    return;
  }

  if (showCashOutModal.value) {
    closeCashMovementModal();
    return;
  }

  if (showCashInModal.value) {
    closeCashMovementModal();
  }
}

function handleWeightedInputKeydown(event: KeyboardEvent): void {
  if (event.key >= "0" && event.key <= "9") {
    rawWeight.value = rawWeight.value * 10 + Number(event.key);
    event.preventDefault();
    return;
  }

  if (event.key === "Backspace") {
    rawWeight.value = Math.floor(rawWeight.value / 10);
    event.preventDefault();
    return;
  }

  if (event.key === "Tab" || event.key === "Escape" || event.key === "Enter") {
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    return;
  }

  event.preventDefault();
}

function confirmWeightedItem(): void {
  weightedModalError.value = null;

  if (!weightedProduct.value) {
    weightedModalError.value = "Produto inválido.";
    return;
  }

  const weightInKg = weightKg.value;

  if (weightInKg <= 0) {
    weightedModalError.value = "Informe um peso válido.";
    return;
  }

  if (isWeightedOverStock.value) {
    weightedModalError.value = weightedOverStockMessage.value;
    return;
  }

  const weightedTotal = Math.round(weightInKg * weightedProduct.value.price_cents);

  if (weightedTotal <= 0) {
    weightedModalError.value = "Valor calculado inválido.";
    return;
  }

  if (weightedProduct.value.is_bulk) {
    saleStore.addItem({
      product_id: weightedProduct.value.id,
      product_name: weightedProduct.value.name,
      product_barcode: weightedProduct.value.barcode,
      product_description: weightedProduct.value.description,
      quantity: weightInKg,
      unit_price_cents: weightedProduct.value.price_cents,
      total_cents: weightedTotal,
      is_bulk: true,
      discount_cents: 0,
      stock_quantity: weightedProduct.value.stock_quantity,
    });
  } else {
    saleStore.addItem({
      product_id: weightedProduct.value.id,
      product_name: `${weightedProduct.value.name} (${weightInKg.toFixed(3).replace(".", ",")} kg)`,
      product_barcode: weightedProduct.value.barcode,
      product_description: weightedProduct.value.description,
      quantity: 1,
      unit_price_cents: weightedTotal,
      discount_cents: 0,
      stock_quantity: weightedProduct.value.stock_quantity,
    });
  }

  showWeightModal.value = false;
  productEntryInput.value = "";
}

function openPaymentModal(): void {
  if (saleStore.items.length === 0) {
    paymentError.value = "Adicione itens ao carrinho antes de finalizar.";
    return;
  }

  paymentRows.value = [{ method: PAYMENT_METHODS.CASH, amountInput: formatCents(totalCents.value) }];
  cashReceivedInput.value = "";
  cancelChangeDiscountInput();
  paymentError.value = null;
  pixQRCodeError.value = null;
  paymentSuccess.value = false;
  void loadActiveCardMachines();
  showPaymentModal.value = true;
}

function addPaymentRow(): void {
  if (!canAddMorePaymentRows.value) {
    return;
  }

  const firstAvailable = availablePaymentMethods.value[0];

  if (!firstAvailable) {
    return;
  }

  const row: PaymentEntry = { method: firstAvailable.value, amountInput: "", card_machine_id: undefined };
  handlePaymentMethodChange(row);
  paymentRows.value.push(row);
}

function removePaymentRow(index: number): void {
  if (paymentRows.value.length === 1) {
    return;
  }

  paymentRows.value.splice(index, 1);
}

function isFiadoOptionDisabled(method: PaymentMethod): boolean {
  if (method !== PAYMENT_METHODS.FIADO) {
    return false;
  }

  return !customerCanUseFiado.value;
}

async function confirmPayment(): Promise<void> {
  paymentError.value = null;
  paymentLoading.value = true;

  try {
    if (paymentRows.value.length === 0) {
      paymentError.value = "Adicione ao menos uma forma de pagamento.";
      return;
    }

    const informedTotal = paymentRowsTotalCents.value;

    if (informedTotal < totalWithFeesCents.value) {
      paymentError.value = "A soma dos pagamentos é insuficiente para o total da venda.";
      return;
    }

    for (const row of paymentRows.value) {
      if (!isCardMethod(row.method)) {
        continue;
      }

      if (!row.card_machine_id) {
        paymentError.value = "Selecione a maquininha para pagamentos no cartão.";
        return;
      }
    }

    const hasFiado = paymentRows.value.some((row) => row.method === PAYMENT_METHODS.FIADO);

    if (hasFiado && hasInactiveSelectedCustomer.value) {
      paymentError.value = INACTIVE_FIADO_MODAL_MESSAGE;
      return;
    }

    if (hasFiado && !customerCanUseFiado.value) {
      paymentError.value = "Cliente não elegível para fiado.";
      return;
    }

    const hasCashReceivedEntry = cashReceivedInput.value.trim().length > 0;

    if (cashAmountRequiredCents.value > 0 && hasCashReceivedEntry && cashReceivedCents.value < cashAmountRequiredCents.value) {
      paymentError.value = "Valor recebido em dinheiro é insuficiente.";
      return;
    }

    const uniqueMethods = Array.from(new Set(paymentRows.value.map((row) => row.method)));
    const paymentMethod = (uniqueMethods.length > 1 ? PAYMENT_METHODS.MIXED : uniqueMethods[0]) as string;
    const finalTotalCents = totalWithFeesCents.value;

    const operatorId = authStore.user?.id;

    if (!operatorId) {
      paymentError.value = "Operador não identificado.";
      return;
    }

    // Se há Pix, gerar QR Code e aguardar confirmação do operador
    if (hasPixPayment.value) {
      await generatePixQRCode();
      return;
    }

    const payments = buildPaymentsWithFees();
    const payload = buildSalePayload({
      terminalId: terminalId.value,
      paymentMethod,
      operatorId,
      payments,
      customerId: selectedCustomer.value?.id,
      finalTotalCents,
      buildPayload: saleStore.buildPayload,
    });

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

    finalizedReceivedCents.value = cashReceivedInput.value.trim()
      ? cashReceivedCents.value
      : cashAmountRequiredCents.value;
    finalizedChangeCents.value = cashChangeCents.value;
    paymentSuccess.value = true;

    await requestReceiptPrint({
      sale_id: data.data?.id,
      terminal_id: terminalId.value,
    });

    resetSaleState();
  } catch {
    paymentError.value = "Erro de conexão ao finalizar venda.";
  } finally {
    paymentLoading.value = false;
  }
}

function closePaymentModalAfterSuccess(): void {
  showPaymentModal.value = false;
  paymentSuccess.value = false;
  paymentError.value = null;
  cancelChangeDiscountInput();
}

async function generatePixQRCode(): Promise<void> {
  pixQRCodeError.value = null;
  paymentError.value = null;
  pixQRCodeLoading.value = true;

  try {
    if (!hasPixPayment.value) {
      pixQRCodeError.value = "Pix não selecionado como meio de pagamento.";
      return;
    }

    const saleUuid = saleStore.saleUuid || crypto.randomUUID();
    saleStore.saleUuid = saleUuid;
    const pixCents = pixPaymentCents.value;

    if (pixCents <= 0) {
      pixQRCodeError.value = "Valor do Pix não foi especificado.";
      return;
    }

    pixQRCodeTxId.value = "";
    pixQRCodeCents.value = pixCents;

    const response = await authenticatedFetch("/api/pix/qrcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: pixCents,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data.message || "Falha ao gerar QR Code Pix.";
      pixQRCodeError.value = message;
      paymentError.value = message;
      return;
    }

    pixQRCodeTxId.value = typeof data.data?.tx_id === "string" ? data.data.tx_id : "";
    pixQRCodePayload.value = data.data?.qr_code_payload || "";
    pixQRCodeMerchantName.value = data.data?.merchant_name || "";

    if (!pixQRCodePayload.value.trim()) {
      const message = "Falha ao gerar QR Code Pix. Tente novamente.";
      pixQRCodeError.value = message;
      paymentError.value = message;
      return;
    }

    pixQRCodeTimeoutSeconds.value = 300; // 5 minutos
    pixQRCodeExpired.value = false;
    showPixQRCodeModal.value = true;

    await nextTick();

    if (pixQRCodeCanvasRef.value) {
      await QRCode.toCanvas(pixQRCodeCanvasRef.value, pixQRCodePayload.value, {
        width: 220,
        margin: 1,
      });
    }

    // Iniciar contagem regressiva
    startPixQRCodeCountdown();
    startPixStatusPolling();
  } catch {
    const message = "Erro de conexão ao gerar QR Code Pix.";
    pixQRCodeError.value = message;
    paymentError.value = message;
  } finally {
    pixQRCodeLoading.value = false;
  }
}

function startPixQRCodeCountdown(): void {
  if (pixQRCodeCountdownInterval) {
    clearInterval(pixQRCodeCountdownInterval);
  }

  pixQRCodeCountdownInterval = setInterval(() => {
    pixQRCodeTimeoutSeconds.value -= 1;

    if (pixQRCodeTimeoutSeconds.value <= 0) {
      pixQRCodeExpired.value = true;
      clearInterval(pixQRCodeCountdownInterval!);
      pixQRCodeCountdownInterval = null;
    }
  }, 1000);
}

function stopPixQRCodeCountdown(): void {
  if (pixQRCodeCountdownInterval) {
    clearInterval(pixQRCodeCountdownInterval);
    pixQRCodeCountdownInterval = null;
  }
}

function stopPixStatusPolling(): void {
  if (pixStatusPollingInterval) {
    clearInterval(pixStatusPollingInterval);
    pixStatusPollingInterval = null;
  }
}

async function checkPixPaymentStatus(): Promise<void> {
  if (!pixQRCodeTxId.value || paymentLoading.value || !showPixQRCodeModal.value) {
    return;
  }

  try {
    const response = await authenticatedFetch(
      `/api/pix/status/${encodeURIComponent(pixQRCodeTxId.value)}`,
    );
    const data = await response.json();

    if (!response.ok) {
      pixStatusPollingError.value = data.message || "Falha ao consultar status do Pix.";
      return;
    }

    const status = data.data?.status as string | undefined;

    if (status === "confirmed") {
      stopPixStatusPolling();
      pixStatusLabel.value = "Pagamento Pix confirmado automaticamente.";
      await confirmPixReceived("automatic");
      return;
    }

    if (status === "expired") {
      pixQRCodeExpired.value = true;
      pixStatusLabel.value = "QR Code Pix expirado.";
      stopPixStatusPolling();
      return;
    }

    if (status === "failed") {
      pixStatusPollingError.value = "Pagamento Pix não autorizado pelo provedor.";
      stopPixStatusPolling();
      return;
    }

    pixStatusLabel.value = "Aguardando confirmação do Pix...";
    pixStatusPollingError.value = null;
  } catch {
    pixStatusPollingError.value = "Não foi possível atualizar o status do Pix agora.";
  }
}

function startPixStatusPolling(): void {
  stopPixStatusPolling();
  pixStatusPollingError.value = null;
  pixStatusLabel.value = "Aguardando confirmação do Pix...";

  void checkPixPaymentStatus();

  pixStatusPollingInterval = setInterval(() => {
    void checkPixPaymentStatus();
  }, 3000);
}

async function copyPixCodigo(): Promise<void> {
  if (!pixQRCodePayload.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(pixQRCodePayload.value);
    pixCopied.value = true;
    setTimeout(() => { pixCopied.value = false; }, 2000);
  } catch {
    // Clipboard API não disponível — usuario pode copiar manualmente do campo
  }
}

function openPixManualConfirmModal(): void {
  showPixManualConfirmModal.value = true;
}

function closePixManualConfirmModal(): void {
  showPixManualConfirmModal.value = false;
}

async function confirmPixReceived(source: "manual" | "automatic" = "manual"): Promise<void> {
  paymentError.value = null;
  paymentLoading.value = true;

  try {
    // Agora finalizar a venda normalmente
    const uniqueMethods = Array.from(new Set(paymentRows.value.map((row) => row.method)));
    const paymentMethod = (uniqueMethods.length > 1 ? PAYMENT_METHODS.MIXED : uniqueMethods[0]) as string;
    const finalTotalCents = totalWithFeesCents.value;

    const operatorId = authStore.user?.id;

    if (!operatorId) {
      paymentError.value = "Operador não identificado.";
      return;
    }

    const payments = buildPaymentsWithFees();
    const payload = buildSalePayload({
      terminalId: terminalId.value,
      paymentMethod,
      operatorId,
      payments,
      customerId: selectedCustomer.value?.id,
      finalTotalCents,
      buildPayload: saleStore.buildPayload,
    });

    const requestBody = {
      ...payload,
      pix_confirmed_manually: source === "manual",
      pix_confirmed_automatically: source === "automatic",
    };

    const response = await authenticatedFetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      paymentError.value = data.message || "Falha ao finalizar venda com Pix.";
      return;
    }

    finalizedReceivedCents.value = cashReceivedInput.value.trim()
      ? cashReceivedCents.value
      : cashAmountRequiredCents.value;
    finalizedChangeCents.value = cashChangeCents.value;
    paymentSuccess.value = true;

    await requestReceiptPrint({
      sale_id: data.data?.id,
      terminal_id: terminalId.value,
    });

    stopPixQRCodeCountdown();
    stopPixStatusPolling();
    showPixManualConfirmModal.value = false;
    showPixQRCodeModal.value = false;
    resetSaleState();
  } catch {
    paymentError.value = "Erro de conexão ao finalizar venda com Pix.";
  } finally {
    paymentLoading.value = false;
  }
}

function confirmPixReceivedManual(): Promise<void> {
  return confirmPixReceived("manual");
}

function closePixQRCodeModal(): void {
  showPixManualConfirmModal.value = false;
  showPixQRCodeModal.value = false;
  stopPixQRCodeCountdown();
  stopPixStatusPolling();
  pixQRCodePayload.value = "";
  pixQRCodeError.value = null;
  pixQRCodeExpired.value = false;
  pixStatusPollingError.value = null;
  pixStatusLabel.value = "Aguardando confirmação do Pix...";
}

async function requestReceiptPrint(payload: Record<string, unknown>): Promise<void> {
  try {
    const response = await authenticatedFetch("/api/print/receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return;
    }
  } catch {
    // fallback no bloco abaixo
  }

  window.print();
}

function openCashOutModal(): void {
  movementAmountInput.value = "";
  movementDescription.value = "";
  movementError.value = null;
  showCashOutModal.value = true;
}

function openCashInModal(): void {
  movementAmountInput.value = "";
  movementDescription.value = "";
  movementError.value = null;
  showCashInModal.value = true;
}

function closeCashMovementModal(): void {
  showCashOutModal.value = false;
  showCashInModal.value = false;
  movementAmountInput.value = "";
  movementDescription.value = "";
  movementError.value = null;
}

async function submitCashMovement(type: "cash-out" | "cash-in"): Promise<void> {
  movementError.value = null;

  if (!openCashRegister.value) {
    movementError.value = "Não há caixa aberto para este terminal.";
    return;
  }

  const amountCents = parseCurrencyInputToCents(movementAmountInput.value);

  if (amountCents <= 0) {
    movementError.value = "Informe um valor válido.";
    return;
  }

  movementLoading.value = true;

  try {
    const response = await authenticatedFetch(`/api/cash-registers/${openCashRegister.value.id}/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: amountCents,
        description: movementDescription.value.trim() || (type === "cash-out" ? "Sangria" : "Suprimento"),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      movementError.value = data.message || "Não foi possível registrar movimentação.";
      return;
    }

    await requestReceiptPrint({
      terminal_id: terminalId.value,
      cash_register_id: openCashRegister.value.id,
      movement_type: type,
      amount_cents: amountCents,
      description: movementDescription.value,
    });

    closeCashMovementModal();
  } catch {
    movementError.value = "Erro de conexão ao registrar movimentação.";
  } finally {
    movementLoading.value = false;
  }
}

function resetSaleState(): void {
  saleStore.clearCart();
  cancelChangeDiscountInput();
  selectedCustomer.value = null;
  customerSearchInput.value = "";
  selectedItemProductId.value = null;
  productEntryInput.value = "";
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (captureScannerInput(event)) {
    return;
  }

  if (event.key === "Escape") {
    closeTopModal();
    return;
  }

  if (hasModalOpen.value) {
    return;
  }

  if (event.key === "F2") {
    event.preventDefault();
    openProductSearchModal();
    return;
  }

  if (event.key === "F4") {
    event.preventDefault();
    openPaymentModal();
    return;
  }

  if (event.key === "F6") {
    event.preventDefault();
    openCashOutModal();
    return;
  }

  if (event.key === "F7") {
    event.preventDefault();
    openCashInModal();
    return;
  }

  if (event.key === "F8") {
    event.preventDefault();

    if (selectedItemProductId.value) {
      removeItemWithApproval(selectedItemProductId.value);
    }

    return;
  }

  if (event.key === "F9") {
    event.preventDefault();
    cancelSaleWithApproval();
  }
}

function captureScannerInput(event: KeyboardEvent): boolean {
  if (hasModalOpen.value) {
    return false;
  }

  const target = event.target as HTMLElement | null;
  const tagName = (target?.tagName || "").toLowerCase();
  const isTypingContext = tagName === "input" || tagName === "textarea" || tagName === "select";

  if (isTypingContext) {
    return false;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  if (event.key === "Enter") {
    if (!scannerBuffer) {
      return false;
    }

    event.preventDefault();
    productEntryInput.value = scannerBuffer;
    scannerBuffer = "";
    void handleProductEntry();
    return true;
  }

  if (event.key.length !== 1) {
    return false;
  }

  scannerBuffer += event.key;

  if (scannerTimer) {
    clearTimeout(scannerTimer);
  }

  scannerTimer = setTimeout(() => {
    scannerBuffer = "";
  }, 90);

  return true;
}

</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      
      <!-- Toasts de alerta de estoque -->
      <div class="fixed right-4 top-20 z-50 space-y-2">
        <div
          v-for="toast in stockAlertToasts"
          :key="toast.id"
          class="flex min-w-[300px] items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 shadow-lg"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <span class="text-lg">⚠️</span>
          <div class="flex-1">
            <p class="text-sm font-medium text-amber-900">{{ toast.message }}</p>
          </div>
          <button
            type="button"
            aria-label="Fechar alerta"
            class="text-amber-700 hover:text-amber-900"
            @click="removeStockAlertToast(toast.id)"
          >
            ✕
          </button>
        </div>
      </div>

      <main class="flex-1 p-4 md:p-6">
        <section
          class="sticky top-0 z-20 mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-5"
        >
          <div>
            <p class="text-xs text-slate-500">Terminal</p>
            <p class="text-base font-semibold text-slate-900">{{ terminalId }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Operador</p>
            <p class="text-base font-semibold text-slate-900">{{ authStore.user?.name || "N/D" }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Data e hora</p>
            <p class="text-base font-semibold text-slate-900">{{ formatDateTime(now) }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <span class="inline-flex items-center gap-2 text-sm">
              <span :class="isOnline ? 'text-green-600' : 'text-red-600'">{{ isOnline ? "●" : "●" }}</span>
              <span class="text-slate-700">{{ isOnline ? "Online" : "Offline" }}</span>
            </span>
            <span class="inline-flex items-center gap-2 text-sm">
              <span :class="isConnected ? 'text-green-600' : 'text-red-600'">{{ isConnected ? "●" : "●" }}</span>
              <span class="text-slate-700">WebSocket</span>
            </span>
          </div>
          <div>
            <p class="text-xs text-slate-500">Impressora</p>
            <p class="text-base font-semibold text-slate-900">N/D</p>
          </div>
        </section>

        <p v-if="cashRegisterError" class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ cashRegisterError }}
        </p>

        <p v-if="wsConnectionWarning" class="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {{ wsConnectionWarning }}
        </p>

        <div v-if="isCheckingCashRegister" class="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
          Validando caixa aberto para o terminal...
        </div>

        <div v-else-if="openCashRegister" class="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p class="mb-2 text-sm font-medium text-slate-700">Cliente (opcional)</p>
              <div class="flex flex-col gap-2 md:flex-row">
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

              <div v-if="selectedCustomer" class="mt-3 rounded-md border border-slate-200 bg-white p-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-semibold text-slate-900">{{ selectedCustomer.name }}</p>
                    <p v-if="selectedCustomer.phone" class="text-sm text-slate-500">
                      Tel: {{ formatPhoneForDisplay(selectedCustomer.phone) }}
                    </p>
                    <p class="text-sm text-slate-500">
                      Saldo fiado:
                      <span
                        class="mx-1 inline-block"
                        :class="showCustomerDebt ? '' : 'blur-sm select-none'"
                      >
                        {{ formatCents(selectedCustomer.current_debt_cents) }}
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

            <div class="mb-4 rounded-lg border border-slate-200 p-3">
              <p class="mb-2 text-sm font-medium text-slate-700">Entrada de produtos</p>
              <input
                ref="productInputRef"
                v-model="productEntryInput"
                type="text"
                autofocus
                placeholder="Código de barras ou quantidade*código"
                class="h-12 w-full rounded-md border border-slate-300 px-3 text-base outline-none focus:border-blue-500"
                @keydown.enter.prevent="handleProductEntry"
              />
              <p v-if="productLoading" class="mt-2 text-sm text-slate-500">Consultando produto...</p>
              <p v-if="productMessage" class="mt-2 text-sm text-slate-600">{{ productMessage }}</p>
            </div>

            <div class="rounded-lg border border-slate-200">
              <div class="max-h-[420px] overflow-y-auto">
                <table class="min-w-full text-sm">
                  <caption class="sr-only">Itens adicionados no carrinho da venda atual</caption>
                  <thead class="sticky top-0 bg-slate-100 text-left text-slate-700">
                    <tr>
                      <th scope="col" class="px-2 py-2">#</th>
                      <th scope="col" class="px-2 py-2">Código</th>
                      <th scope="col" class="px-2 py-2">Nome</th>
                      <th scope="col" class="px-2 py-2">Qtd</th>
                      <th scope="col" class="px-2 py-2">Un</th>
                      <th scope="col" class="px-2 py-2">Valor Unit.</th>
                      <th scope="col" class="px-2 py-2">Total Item</th>
                      <th scope="col" class="px-2 py-2">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(item, index) in saleStore.items"
                      :key="`${item.product_id}-${item.unit_price_cents}-${index}`"
                      :class="selectedItemProductId === item.product_id ? 'bg-primary/5 outline-2 outline-primary/30' : ''"
                      class="border-t border-slate-200 cursor-pointer"
                      tabindex="0"
                      @click="selectedItemProductId = item.product_id"
                      @keydown.enter="selectedItemProductId = item.product_id"
                    >
                      <td class="px-2 py-2">{{ index + 1 }}</td>
                      <td class="px-2 py-2">{{ item.product_barcode || "-" }}</td>
                      <td class="px-2 py-2">
                        <div>
                          <span>{{ item.product_name }}</span>
                          <span
                            v-if="item.product_description"
                            class="ml-1 cursor-help text-xs text-slate-500"
                            :title="item.product_description"
                          >
                            ⓘ
                          </span>
                        </div>
                      </td>
                      <td class="px-2 py-2">
                        <div v-if="!item.is_bulk" class="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Diminuir quantidade"
                            class="flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                            @click.stop="decrementItemQuantity(item.product_id)"
                          >
                            −
                          </button>
                          <span class="min-w-8 text-center">{{ item.quantity }}</span>
                          <button
                            type="button"
                            aria-label="Aumentar quantidade"
                            class="flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                            @click.stop="incrementItemQuantity(item.product_id)"
                          >
                            +
                          </button>
                        </div>
                        <span v-else class="text-xs font-medium text-slate-700">
                          {{ item.quantity.toFixed(3).replace('.', ',') }} kg
                        </span>
                      </td>
                      <td class="px-2 py-2">{{ item.is_bulk ? "kg" : "un" }}</td>
                      <td class="px-2 py-2">{{ formatCents(item.unit_price_cents) }}</td>
                      <td class="px-2 py-2">
                        {{ formatCents((item.is_bulk ? (item.total_cents || 0) : (item.unit_price_cents * item.quantity)) - item.discount_cents) }}
                      </td>
                      <td class="px-2 py-2">
                        <button
                          type="button"
                          :aria-label="`Remover item ${item.product_name}`"
                          class="rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50"
                          @click.stop="removeItemWithApproval(item.product_id)"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                    <tr v-if="saleStore.items.length === 0">
                      <td colspan="8" class="px-3 py-6 text-center text-slate-500">
                        Nenhum item no carrinho.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 class="mb-3 text-lg font-semibold text-slate-900">Resumo financeiro</h2>
            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-slate-600">Subtotal</span>
                <strong class="text-slate-900">{{ formatCents(subtotalCents) }}</strong>
              </div>
            </div>

            <div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p class="text-sm text-blue-700">Total a pagar</p>
              <p class="text-[34px] leading-none font-bold text-blue-900">{{ formatCents(totalCents) }}</p>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                class="h-11 rounded-md bg-blue-700 font-semibold text-white transition"
                :class="isConnected ? 'hover:bg-blue-800' : 'opacity-50 cursor-not-allowed'"
                :disabled="!isConnected"
                :title="!isConnected ? 'Sem conexão com o servidor. Aguarde a reconexão.' : ''"
                @click="openPaymentModal"
              >
                Finalizar venda (F4)
              </button>
              <button
                type="button"
                class="h-11 rounded-md border border-red-300 font-semibold text-red-700 hover:bg-red-50"
                @click="cancelSaleWithApproval"
              >
                Cancelar venda (F9)
              </button>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                class="h-10 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                @click="openProductSearchModal"
              >
                Buscar produto (F2)
              </button>
              <button
                type="button"
                class="h-10 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                @click="openCashOutModal"
              >
                Sangria (F6)
              </button>
              <button
                type="button"
                class="h-10 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                @click="openCashInModal"
              >
                Suprimento (F7)
              </button>
              <button
                type="button"
                class="h-10 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                @click="selectedItemProductId && removeItemWithApproval(selectedItemProductId)"
              >
                Cancelar item (F8)
              </button>
            </div>

            <!-- Painel de atalhos de teclado (recolhível) -->
            <div class="mt-4">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
                :aria-expanded="showHotkeys"
                aria-controls="hotkeys-panel"
                @click="showHotkeys = !showHotkeys"
              >
                <span>⌨️ Atalhos de teclado</span>
                <span>{{ showHotkeys ? '▲' : '▼' }}</span>
              </button>
              <div
                v-if="showHotkeys"
                id="hotkeys-panel"
                class="mt-1 grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600"
              >
                <span>F2 — Buscar produto</span>
                <span>F4 — Finalizar venda</span>
                <span>F6 — Sangria</span>
                <span>F7 — Suprimento</span>
                <span>F8 — Cancelar item</span>
                <span>F9 — Cancelar venda</span>
              </div>
            </div>
          </aside>
        </div>

        <div
          v-else
          class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          É necessário abrir o caixa deste terminal para iniciar vendas.
        </div>
      </main>
    </div>

    <div
      v-if="showOpenCashModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-open-cash-modal-title"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h2 id="sales-open-cash-modal-title" class="text-lg font-bold text-slate-900">Abertura de Caixa</h2>
        <p class="mt-1 text-sm text-slate-600">
          Informe o fundo de troco para liberar o registro de vendas.
        </p>

        <div class="mt-4">
          <label class="mb-1 block text-sm font-medium text-slate-700">Fundo de troco</label>
          <input
            :value="openingBalanceInput"
            type="text"
            inputmode="numeric"
            placeholder="R$ 0,00"
            class="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
            @input="handleOpeningBalanceCurrencyInput"
          />
        </div>

        <p v-if="openingCashError" class="mt-2 text-sm text-red-700">{{ openingCashError }}</p>

        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="h-11 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            :disabled="openingCashLoading"
            @click="submitOpenCashRegister"
          >
            {{ openingCashLoading ? "Abrindo..." : "Confirmar abertura" }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showManagerPinModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-manager-pin-modal-title"
      @click.self="showManagerPinModal = false"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h2 id="sales-manager-pin-modal-title" class="text-lg font-bold text-slate-900">Aprovação de Gerente</h2>
        <p class="mt-1 text-sm text-slate-600">Informe o PIN para autorizar esta ação.</p>

        <input
          v-model="managerPin"
          type="password"
          inputmode="numeric"
          maxlength="6"
          class="mt-4 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
          @keydown.enter.prevent="validateManagerPinAndProceed"
        />

        <p v-if="managerPinError" class="mt-2 text-sm text-red-700">{{ managerPinError }}</p>

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="h-10 rounded-md border border-slate-300 px-3 text-slate-700 hover:bg-slate-100"
            @click="showManagerPinModal = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="h-10 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            :disabled="managerPinLoading"
            @click="validateManagerPinAndProceed"
          >
            {{ managerPinLoading ? "Validando..." : "Confirmar" }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showWeightModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-weight-modal-title"
      @click.self="showWeightModal = false"
    >
      <div class="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
        <h2 id="sales-weight-modal-title" class="text-lg font-bold text-slate-900">
          {{ weightedProduct?.is_bulk ? "Produto a Granel" : "Pesagem de Produto" }}
        </h2>

        <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-sm text-slate-700">Produto: <strong>{{ weightedProduct?.name }}</strong></p>
          <p class="mt-1 text-sm text-slate-700">Preço por kg: <strong>{{ formatCents(weightedProduct?.price_cents || 0) }}</strong></p>
        </div>

        <div class="mt-4">
          <label class="mb-1 block text-sm font-medium text-slate-700">Peso (kg)</label>
          <input
            ref="weightedInputRef"
            :value="weightedInputDisplay"
            type="text"
            inputmode="numeric"
            readonly
            class="h-11 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-blue-500"
            @keydown="handleWeightedInputKeydown"
          />
        </div>

        <p class="mt-2 text-sm text-slate-600">
          Estoque disponível: <strong>{{ weightedStockAvailableDisplay }}</strong>
        </p>

        <p class="mt-3 text-sm text-slate-700">
          Valor calculado: <strong>{{ formatCents(weightedTotalCents) }}</strong>
        </p>

        <p class="mt-1 text-xs text-slate-600">Peso informado: {{ weightedQuantityDisplay }}</p>

        <p v-if="weightedOverStockMessage" class="mt-2 text-sm text-red-700">{{ weightedOverStockMessage }}</p>

        <p v-if="weightedModalError" class="mt-2 text-sm text-red-700">{{ weightedModalError }}</p>

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="h-10 rounded-md border border-slate-300 px-4 text-slate-700 hover:bg-slate-100"
            @click="showWeightModal = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="h-10 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
            :disabled="isWeightedOverStock"
            :class="isWeightedOverStock ? 'cursor-not-allowed opacity-60' : ''"
            @click="confirmWeightedItem"
          >
            Adicionar ao Carrinho
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showProductSearchModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-product-search-modal-title"
      @click.self="showProductSearchModal = false"
    >
      <div class="w-full max-w-2xl rounded-xl bg-white p-5 shadow-lg">
        <h2 id="sales-product-search-modal-title" class="text-lg font-bold text-slate-900">Busca de Produto (F2)</h2>

        <input
          v-model="productSearchInput"
          type="text"
          autofocus
          placeholder="Digite nome ou código"
          class="mt-3 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
        />

        <p v-if="productSearchError" class="mt-2 text-sm text-red-700">{{ productSearchError }}</p>
        <p v-if="loadingAllProducts" class="mt-2 text-sm text-slate-500">Carregando produtos...</p>
        <p v-if="!loadingAllProducts && !productSearchError && productSearchInput.trim().length < 2" class="mt-2 text-sm text-slate-500">
          Digite ao menos 2 caracteres para buscar.
        </p>
        <p v-if="!loadingAllProducts && !productSearchError && productSearchInput.trim().length >= 2 && productSearchResults.length === 0" class="mt-2 text-sm text-slate-500">
          Nenhum produto encontrado.
        </p>

        <div class="mt-3 rounded-md border border-slate-200">
          <RecycleScroller
            :items="productSearchResults"
            key-field="id"
            :item-size="54"
            class="max-h-80 overflow-y-auto"
            list-tag="div"
            item-tag="div"
          >
            <template #default="{ item: product }">
              <button
                type="button"
                class="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                @click="selectProductFromSearch(toSearchProduct(product))"
              >
                <span>
                  <span class="block text-sm font-medium text-slate-900">{{ toSearchProduct(product).name }}</span>
                  <span class="text-xs text-slate-500">{{ toSearchProduct(product).barcode || toSearchProduct(product).id }}</span>
                </span>
                <strong class="text-sm text-slate-900">{{ formatCents(toSearchProduct(product).price_cents) }}</strong>
              </button>
            </template>
          </RecycleScroller>
        </div>
      </div>
    </div>

    <div
      v-if="showPaymentModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-payment-modal-title"
      @click.self="!paymentSuccess && (showPaymentModal = false)"
    >
      <div class="w-full max-w-3xl rounded-xl bg-white p-5 shadow-lg">
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

          <div class="mt-4 space-y-3">
            <div
              v-for="(row, index) in paymentRows"
              :key="`payment-row-${index}`"
              class="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-3 md:grid-cols-[1.2fr_1fr_auto]"
            >
              <select
                v-model="row.method"
                class="h-11 rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
                @change="handlePaymentMethodChange(row)"
              >
                <option
                  v-for="method in paymentMethods"
                  :key="method.value"
                  :value="method.value"
                  :disabled="isFiadoOptionDisabled(method.value) || (usedPaymentMethods.includes(method.value) && row.method !== method.value)"
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
                @input="(event) => handlePaymentRowCurrencyInput(event, row)"
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
                <label class="mb-1 block text-xs font-semibold text-slate-700">Maquininha *</label>
                <select
                  v-model="row.card_machine_id"
                  class="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  :disabled="loadingCardMachines"
                >
                  <option value="" disabled>Selecione uma maquininha ativa</option>
                  <option v-for="machine in cardMachines" :key="machine.id" :value="machine.id">
                    {{ machine.name }} - {{ machine.absorb_fee ? "Absorver taxa" : "Repassar ao cliente" }}
                  </option>
                </select>

                <template v-if="row.method === PAYMENT_METHODS.CREDIT_CARD">
                  <label class="mb-1 mt-3 block text-xs font-semibold text-slate-700">Parcelamento</label>
                  <select
                    v-model="row.installments"
                    class="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option
                      v-for="opt in getInstallmentOptions(row)"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </template>

                <p v-if="getFeeCentsForRow(row) > 0" class="mt-2 text-xs text-slate-700">
                  Valor base: {{ formatCents(parseCurrencyInputToCents(row.amountInput)) }} | Taxa: {{
                    formatCents(getFeeCentsForRow(row))
                  }} | Total com taxa: {{ formatCents(getAmountWithFeeCentsForRow(row)) }}
                </p>
              </div>
            </div>

            <button
              type="button"
              class="h-10 rounded-md border border-blue-300 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canAddMorePaymentRows"
              @click="addPaymentRow"
            >
              {{ canAddMorePaymentRows ? "Adicionar meio de pagamento" : "Máximo de 2 meios de pagamento atingido." }}
            </button>
          </div>

          <div v-if="cashAmountRequiredCents > 0" class="mt-4 rounded-md border border-slate-200 p-3">
            <p class="mb-2 text-sm font-medium text-slate-700">Pagamento em dinheiro</p>
            <label class="mb-1 block text-sm text-slate-600">Valor recebido</label>
            <input
              :value="cashReceivedInput"
              type="text"
              inputmode="numeric"
              placeholder="R$ 0,00"
              class="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
              @input="handleCashReceivedCurrencyInput"
            />
            <p class="mt-2 text-sm text-slate-700">Troco: <strong>{{ formatCents(cashChangeCents) }}</strong></p>

            <div v-if="isCashOnlyPayment" class="mt-3">
              <button
                v-if="!showChangeDiscountInput && !hasAppliedChangeDiscount"
                type="button"
                class="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
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
                  class="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  @input="handleChangeDiscountCurrencyInput"
                  @keydown.enter.prevent="confirmChangeDiscount"
                />
                <button
                  type="button"
                  class="h-10 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800"
                  @click="confirmChangeDiscount"
                >
                  Confirmar
                </button>
              </div>

              <div
                v-else-if="hasAppliedChangeDiscount"
                class="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
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

              <p v-if="changeDiscountError" class="mt-1 text-xs text-red-700">{{ changeDiscountError }}</p>
            </div>
          </div>

          <div v-if="hasFiadoSelectedInPayment && selectedCustomer" class="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
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

          <div class="mt-4 rounded-md border border-slate-200 p-3">
            <p class="text-sm text-slate-700">
              Saldo restante:
              <strong :class="remainingCents === 0 ? 'text-green-700' : 'text-amber-700'">
                {{ formatCents(Math.abs(remainingCents)) }}
              </strong>
            </p>
          </div>

          <p v-if="paymentError" role="alert" class="mt-3 text-sm text-red-700">
            {{ paymentError }}
          </p>

          <p v-if="fiadoInactiveCustomerError" role="alert" class="mt-2 text-sm text-amber-700">
            {{ fiadoInactiveCustomerError }}
          </p>

          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="h-10 rounded-md border border-slate-300 px-4 text-slate-700 hover:bg-slate-100"
              @click="showPaymentModal = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="h-10 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              :disabled="paymentLoading || !!fiadoInactiveCustomerError || hasFiadoInsufficientCredit"
              @click="confirmPayment"
            >
              {{ paymentLoading ? "Confirmando..." : "Confirmar" }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="showPixQRCodeModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-pix-qrcode-modal-title"
      @click.self="!pixQRCodeLoading && !paymentLoading && !showPixManualConfirmModal && closePixQRCodeModal()"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h2 id="sales-pix-qrcode-modal-title" class="text-lg font-bold text-slate-900">Confirmar Pagamento Pix</h2>

        <div v-if="!pixQRCodeExpired" class="mt-4">
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p class="text-sm text-blue-700">Valor a pagar</p>
            <p class="text-2xl font-bold text-blue-900">{{ formatCents(pixQRCodeCents) }}</p>
            <p class="mt-2 text-xs text-blue-600">Estabelecimento: {{ pixQRCodeMerchantName }}</p>
          </div>

          <div v-if="pixQRCodePayload" class="mt-4 space-y-3">
            <div class="rounded-lg bg-slate-50 p-3">
              <p class="mb-2 text-sm font-medium text-slate-700">Escaneie o QR Code</p>
              <div class="flex justify-center">
                <canvas ref="pixQRCodeCanvasRef" class="h-40 w-40 border border-slate-200"></canvas>
              </div>
            </div>

            <div class="rounded-lg bg-slate-50 p-3">
              <p class="mb-2 text-sm font-medium text-slate-700">Copia e Cola</p>
              <div class="flex gap-2">
                <input
                  :value="pixQRCodePayload"
                  type="text"
                  readonly
                  class="h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 text-xs outline-none"
                />
                <button
                  type="button"
                  class="h-11 rounded-md px-3 transition"
                  :class="pixCopied ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'"
                  @click="copyPixCodigo"
                >
                  {{ pixCopied ? '✅ Copiado!' : 'Copiar' }}
                </button>
              </div>
            </div>

            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p class="text-sm text-amber-800">
                Validade: 
                <strong>{{ pixQRCodeTimeoutFormatted }}</strong>
              </p>
              <p class="mt-1 text-sm text-amber-800">
                {{ pixStatusLabel }}
              </p>
              <p class="mt-2 text-sm text-amber-900">
                ⚠️ Verifique o recebimento no aplicativo do banco antes de confirmar.
              </p>
            </div>
          </div>

          <p v-if="pixQRCodeError" role="alert" class="mt-3 text-sm text-red-700">
            {{ pixQRCodeError }}
          </p>

          <p v-if="pixStatusPollingError" role="status" aria-live="polite" class="mt-2 text-sm text-amber-700">
            {{ pixStatusPollingError }}
          </p>

          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="h-10 rounded-md border border-slate-300 px-4 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              :disabled="pixQRCodeLoading || paymentLoading"
              @click="closePixQRCodeModal"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="h-10 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              :disabled="pixQRCodeLoading || paymentLoading"
              @click="openPixManualConfirmModal"
            >
              Confirmar Recebimento do Pix
            </button>
          </div>
        </div>

        <div v-else class="mt-4">
          <div class="rounded-lg border border-red-200 bg-red-50 p-3">
            <p class="text-sm text-red-700">QR Code expirado. Gere um novo para continuar.</p>
          </div>
          <div class="mt-4 flex justify-end">
            <button
              type="button"
              class="h-10 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
              @click="closePixQRCodeModal"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showPixManualConfirmModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-pix-manual-modal-title"
      @click.self="!paymentLoading && closePixManualConfirmModal()"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h2 id="sales-pix-manual-modal-title" class="text-lg font-bold text-slate-900">Confirmar Recebimento do Pix</h2>

        <div class="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Confirme que o pagamento de <strong>{{ formatCents(pixQRCodeCents) }}</strong> foi recebido no Pix antes de finalizar a venda.
          </p>
          <p>
            Chave Pix (final): <strong>{{ pixKeySuffix }}</strong>
          </p>
          <p class="text-amber-800">
            ⚠️ Verifique no aplicativo do banco para evitar confirmação indevida.
          </p>
        </div>

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="h-10 rounded-md border border-slate-300 px-4 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            :disabled="paymentLoading"
            @click="closePixManualConfirmModal"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="h-10 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            :disabled="paymentLoading"
            @click="confirmPixReceivedManual"
          >
            {{ paymentLoading ? "Finalizando..." : "Confirmar e Finalizar" }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showCashOutModal || showCashInModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-cash-movement-modal-title"
      @click.self="closeCashMovementModal"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h2 id="sales-cash-movement-modal-title" class="text-lg font-bold text-slate-900">
          {{ showCashOutModal ? "Sangria" : "Suprimento" }}
        </h2>

        <div class="mt-4">
          <label class="mb-1 block text-sm font-medium text-slate-700">Valor</label>
          <input
            :value="movementAmountInput"
            type="text"
            inputmode="numeric"
            placeholder="R$ 0,00"
            class="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
            @input="handleMovementAmountCurrencyInput"
          />
        </div>

        <div class="mt-3">
          <label class="mb-1 block text-sm font-medium text-slate-700">Motivo</label>
          <input
            v-model="movementDescription"
            type="text"
            class="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
            :placeholder="showCashOutModal ? 'Ex.: retirada para troco' : 'Ex.: reforço de caixa'"
          />
        </div>

        <p v-if="movementError" class="mt-2 text-sm text-red-700">{{ movementError }}</p>

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="h-10 rounded-md border border-slate-300 px-4 text-slate-700 hover:bg-slate-100"
            @click="closeCashMovementModal"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="h-10 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            :disabled="movementLoading"
            @click="showCashOutModal ? submitCashMovement('cash-out') : submitCashMovement('cash-in')"
          >
            {{ movementLoading ? "Processando..." : "Confirmar" }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showCustomerListModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-customer-list-modal-title"
      @click.self="showCustomerListModal = false"
    >
      <div class="w-full max-w-2xl rounded-xl bg-white p-5 shadow-lg">
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
            v-for="customer in customerListResults"
            :key="customer.id"
            type="button"
            class="flex w-full items-center justify-between border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50"
            @click="selectCustomerFromList(customer)"
          >
            <div>
              <span class="block text-sm font-medium text-slate-900">{{ customer.name }}</span>
              <span class="text-xs text-slate-500">
                {{ customer.phone ? formatPhoneForDisplay(customer.phone) : "Sem telefone" }}
              </span>
            </div>
            <span class="text-xs text-slate-600">
              Saldo: {{ formatCents(customer.current_debt_cents) }}
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
