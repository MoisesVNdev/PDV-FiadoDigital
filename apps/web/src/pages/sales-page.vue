<script setup lang="ts">
import {
  formatCents,
  parseCentsFromString,
  PAYMENT_METHODS,
  type CashRegister,
  type Customer,
  type PaymentMethod,
  type Product,
} from "@pdv/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import { useApi } from "@/composables/use-api.js";
import { useWebSocket } from "@/composables/use-websocket.js";
import { useAuthStore } from "@/stores/auth.store.js";
import { useSaleStore } from "@/stores/sale.store.js";

type ManagerPinAction = "remove-item" | "cancel-sale" | "high-discount";

type PendingManagerPin = {
  action: ManagerPinAction;
  productId?: string;
  discountCents?: number;
};

type PaymentEntry = {
  method: PaymentMethod;
  amountInput: string;
};

const { authenticatedFetch } = useApi();
const authStore = useAuthStore();
const saleStore = useSaleStore();
const { isConnected, lastMessage } = useWebSocket();

const terminalId = ref(localStorage.getItem("pdv_terminal_id") || "PDV-01");

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

const discountInput = ref("");
const discountError = ref<string | null>(null);
const discountLimitPercentage = ref(10);

const showManagerPinModal = ref(false);
const managerPin = ref("");
const managerPinError = ref<string | null>(null);
const managerPinLoading = ref(false);
const pendingManagerPinAction = ref<PendingManagerPin | null>(null);

const showWeightModal = ref(false);
const weightedProduct = ref<Product | null>(null);
const weightedQuantityInput = ref("1,000");
const weightedModalError = ref<string | null>(null);

const showProductSearchModal = ref(false);
const productSearchInput = ref("");
const allProducts = ref<Product[]>([]);
const loadingAllProducts = ref(false);
const productSearchError = ref<string | null>(null);

const showPaymentModal = ref(false);
const paymentRows = ref<PaymentEntry[]>([{ method: PAYMENT_METHODS.CASH, amountInput: "" }]);
const cashReceivedInput = ref("");
const paymentLoading = ref(false);
const paymentError = ref<string | null>(null);
const paymentSuccess = ref(false);
const finalizedChangeCents = ref(0);
const finalizedReceivedCents = ref(0);

const showCashOutModal = ref(false);
const showCashInModal = ref(false);
const movementAmountInput = ref("");
const movementDescription = ref("");
const movementLoading = ref(false);
const movementError = ref<string | null>(null);

const stockAlertToasts = ref<Array<{ id: string; message: string; productId: string }>>([]);

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
    return sum + parseCurrencyInputToCents(row.amountInput);
  }, 0);
});

const remainingCents = computed(() => totalCents.value - paymentRowsTotalCents.value);

const cashAmountRequiredCents = computed(() => {
  return paymentRows.value
    .filter((row) => row.method === PAYMENT_METHODS.CASH)
    .reduce((sum, row) => sum + parseCurrencyInputToCents(row.amountInput), 0);
});

const cashReceivedCents = computed(() => parseCurrencyInputToCents(cashReceivedInput.value));

const cashChangeCents = computed(() => {
  const change = cashReceivedCents.value - cashAmountRequiredCents.value;

  if (change < 0) {
    return 0;
  }

  return change;
});

const weightedTotalCents = computed(() => {
  if (!weightedProduct.value) {
    return 0;
  }

  const weightInKg = parseWeightInputToKg(weightedQuantityInput.value);
  return Math.round(weightInKg * weightedProduct.value.price_cents);
});

const customerCanUseFiado = computed(() => {
  if (!selectedCustomer.value) {
    return false;
  }

  if (selectedCustomer.value.credit_blocked) {
    return false;
  }

  return selectedCustomer.value.current_debt_cents + totalCents.value <= selectedCustomer.value.credit_limit_cents;
});

const productSearchResults = computed(() => {
  const term = productSearchInput.value.trim().toLowerCase();

  if (!term) {
    return allProducts.value.slice(0, 30);
  }

  return allProducts.value
    .filter((product) => {
      return (
        product.name.toLowerCase().includes(term) ||
        (product.barcode || "").toLowerCase().includes(term)
      );
    })
    .slice(0, 30);
});

const customerListResults = computed(() => {
  const term = customerListFilterInput.value.trim().toLowerCase();

  if (!term) {
    return allCustomers.value.slice(0, 50);
  }

  return allCustomers.value
    .filter((customer) => {
      return (
        customer.name.toLowerCase().includes(term) ||
        (customer.phone || "").includes(term)
      );
    })
    .slice(0, 50);
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

  window.removeEventListener("online", handleOnlineStatus);
  window.removeEventListener("offline", handleOnlineStatus);
  window.removeEventListener("keydown", handleGlobalKeydown);

  if (scannerTimer) {
    clearTimeout(scannerTimer);
  }
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

function handleCustomerPhoneInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  customerSearchInput.value = formatPhoneForInput(target.value);
}

function restoreProductInputFocus(): void {
  setTimeout(() => {
    productInputRef.value?.focus();
  }, 0);
}

function parseCurrencyInputToCents(input: string): number {
  if (!input.trim()) {
    return 0;
  }

  return parseCentsFromString(input);
}

function toCurrencyMaskedValue(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return formatCents(Number.parseInt(digits, 10));
}

function handlePaymentRowCurrencyInput(event: Event, row: PaymentEntry): void {
  const target = event.target as HTMLInputElement;
  row.amountInput = toCurrencyMaskedValue(target.value);
}

function handleDiscountCurrencyInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  discountInput.value = toCurrencyMaskedValue(target.value);
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
    const response = await authenticatedFetch(`/api/customers?search=${encodeURIComponent(searchValue)}`);
    const data = await response.json();

    if (!response.ok) {
      customerSearchMessage.value = data.message || "Falha ao buscar cliente.";
      return;
    }

    const customers = (data.data || []) as Customer[];
    selectedCustomer.value = customers[0] || null;

    if (!selectedCustomer.value) {
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
    const response = await authenticatedFetch("/api/customers");
    const data = await response.json();

    if (!response.ok) {
      customerListError.value = data.message || "Não foi possível carregar os clientes.";
      return;
    }

    allCustomers.value = data.data as Customer[];
  } catch {
    customerListError.value = "Erro de conexão ao carregar clientes.";
  } finally {
    loadingCustomers.value = false;
  }
}

function selectCustomerFromList(customer: Customer): void {
  selectedCustomer.value = customer;
  customerSearchInput.value = formatPhoneForInput(customer.phone || "");
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

    if (product.weight_unit === "kg" || product.weight_unit === "g") {
      weightedProduct.value = product;
      weightedQuantityInput.value = "1,000";
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
  saleStore.addItem({
    product_id: product.id,
    product_name: product.name,
    product_barcode: product.barcode,
    product_description: product.description,
    quantity,
    unit_price_cents: product.price_cents,
    discount_cents: 0,
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

    if (pending.action === "high-discount") {
      saleStore.discountCents = pending.discountCents || 0;
      discountInput.value = saleStore.discountCents > 0 ? formatCents(saleStore.discountCents) : "";
      discountError.value = null;
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

  saleStore.updateItemQuantity(productId, item.quantity + 1);
}

function decrementItemQuantity(productId: string): void {
  const item = saleStore.items.find((i) => i.product_id === productId);
  
  if (!item) {
    return;
  }

  if (item.quantity <= 1) {
    requestManagerPin({ action: "remove-item", productId });
    return;
  }

  saleStore.updateItemQuantity(productId, item.quantity - 1);
}

function cancelSaleWithApproval(): void {
  if (saleStore.items.length === 0) {
    return;
  }

  requestManagerPin({ action: "cancel-sale" });
}

function applyDiscount(): void {
  discountError.value = null;

  const parsedDiscount = parseCurrencyInputToCents(discountInput.value);

  if (parsedDiscount < 0) {
    discountError.value = "Desconto inválido.";
    return;
  }

  if (parsedDiscount > subtotalCents.value) {
    discountError.value = "Desconto não pode ser maior que o subtotal.";
    return;
  }

  const maxWithoutApproval = Math.floor((subtotalCents.value * discountLimitPercentage.value) / 100);

  if (parsedDiscount > maxWithoutApproval) {
    requestManagerPin({ action: "high-discount", discountCents: parsedDiscount });
    return;
  }

  saleStore.discountCents = parsedDiscount;
}

function openProductSearchModal(): void {
  showProductSearchModal.value = true;
  productSearchInput.value = "";
  productSearchError.value = null;

  if (allProducts.value.length > 0) {
    return;
  }

  loadProductsForSearch();
}

async function loadProductsForSearch(): Promise<void> {
  loadingAllProducts.value = true;
  productSearchError.value = null;

  try {
    const response = await authenticatedFetch("/api/products");
    const data = await response.json();

    if (!response.ok) {
      productSearchError.value = data.message || "Não foi possível carregar os produtos.";
      return;
    }

    allProducts.value = data.data as Product[];
  } catch {
    productSearchError.value = "Erro de conexão ao carregar produtos.";
  } finally {
    loadingAllProducts.value = false;
  }
}

function selectProductFromSearch(product: Product): void {
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

function parseWeightInputToKg(input: string): number {
  const normalized = input.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}

function confirmWeightedItem(): void {
  weightedModalError.value = null;

  if (!weightedProduct.value) {
    weightedModalError.value = "Produto inválido.";
    return;
  }

  const weightInKg = parseWeightInputToKg(weightedQuantityInput.value);

  if (weightInKg <= 0) {
    weightedModalError.value = "Informe um peso válido.";
    return;
  }

  const weightedTotal = Math.round(weightInKg * weightedProduct.value.price_cents);

  if (weightedTotal <= 0) {
    weightedModalError.value = "Valor calculado inválido.";
    return;
  }

  saleStore.addItem({
    product_id: weightedProduct.value.id,
    product_name: `${weightedProduct.value.name} (${weightInKg.toFixed(3).replace(".", ",")} kg)`,
    product_barcode: weightedProduct.value.barcode,
    product_description: weightedProduct.value.description,
    quantity: 1,
    unit_price_cents: weightedTotal,
    discount_cents: 0,
  });

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
  paymentError.value = null;
  paymentSuccess.value = false;
  showPaymentModal.value = true;
}

function addPaymentRow(): void {
  paymentRows.value.push({ method: PAYMENT_METHODS.PIX, amountInput: "" });
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

    if (informedTotal !== totalCents.value) {
      paymentError.value = "A soma dos pagamentos deve ser igual ao total da venda.";
      return;
    }

    const hasFiado = paymentRows.value.some((row) => row.method === PAYMENT_METHODS.FIADO);

    if (hasFiado && !customerCanUseFiado.value) {
      paymentError.value = "Cliente não elegível para fiado.";
      return;
    }

    if (cashAmountRequiredCents.value > 0 && cashReceivedCents.value < cashAmountRequiredCents.value) {
      paymentError.value = "Valor recebido em dinheiro é insuficiente.";
      return;
    }

    const uniqueMethods = Array.from(new Set(paymentRows.value.map((row) => row.method)));
    const paymentMethod = (uniqueMethods.length > 1 ? PAYMENT_METHODS.MIXED : uniqueMethods[0]) as string;

    const operatorId = authStore.user?.id;

    if (!operatorId) {
      paymentError.value = "Operador não identificado.";
      return;
    }

    const payload = saleStore.buildPayload(
      terminalId.value,
      paymentMethod,
      operatorId,
      selectedCustomer.value?.id,
    );

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

    finalizedReceivedCents.value = cashReceivedCents.value;
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
  saleStore.discountCents = 0;
  discountInput.value = "";
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
                  <thead class="sticky top-0 bg-slate-100 text-left text-slate-700">
                    <tr>
                      <th class="px-2 py-2">#</th>
                      <th class="px-2 py-2">Código</th>
                      <th class="px-2 py-2">Nome</th>
                      <th class="px-2 py-2">Qtd</th>
                      <th class="px-2 py-2">Un</th>
                      <th class="px-2 py-2">Valor Unit.</th>
                      <th class="px-2 py-2">Total Item</th>
                      <th class="px-2 py-2">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(item, index) in saleStore.items"
                      :key="`${item.product_id}-${item.unit_price_cents}-${index}`"
                      :class="selectedItemProductId === item.product_id ? 'bg-blue-50' : 'bg-white'"
                      class="border-t border-slate-200"
                      @click="selectedItemProductId = item.product_id"
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
                        <div class="flex items-center gap-1">
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
                      </td>
                      <td class="px-2 py-2">un</td>
                      <td class="px-2 py-2">{{ formatCents(item.unit_price_cents) }}</td>
                      <td class="px-2 py-2">{{ formatCents(item.unit_price_cents * item.quantity - item.discount_cents) }}</td>
                      <td class="px-2 py-2">
                        <button
                          type="button"
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
              <div v-if="saleStore.discountCents > 0" class="flex items-center justify-between">
                <span class="text-slate-600">Desconto</span>
                <strong class="text-amber-700">- {{ formatCents(saleStore.discountCents) }}</strong>
              </div>
            </div>

            <div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p class="text-sm text-blue-700">Total a pagar</p>
              <p class="text-[34px] leading-none font-bold text-blue-900">{{ formatCents(totalCents) }}</p>
            </div>

            <div class="mt-4 rounded-lg border border-slate-200 p-3">
              <p class="mb-2 text-sm font-medium text-slate-700">Desconto geral</p>
              <input
                :value="discountInput"
                type="text"
                inputmode="numeric"
                placeholder="R$ 0,00"
                class="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
                @input="handleDiscountCurrencyInput"
              />
              <p class="mt-1 text-xs text-slate-500">
                Acima de {{ discountLimitPercentage }}% exige PIN de gerente.
              </p>
              <p v-if="discountError" class="mt-1 text-xs text-red-700">{{ discountError }}</p>
              <button
                type="button"
                class="mt-2 h-10 w-full rounded-md border border-blue-300 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                @click="applyDiscount"
              >
                Aplicar desconto
              </button>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                class="h-11 rounded-md bg-blue-700 font-semibold text-white hover:bg-blue-800"
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
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h2 class="text-lg font-bold text-slate-900">Abertura de Caixa</h2>
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
      @click.self="showManagerPinModal = false"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h2 class="text-lg font-bold text-slate-900">Aprovação de Gerente</h2>
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
      @click.self="showWeightModal = false"
    >
      <div class="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
        <h2 class="text-lg font-bold text-slate-900">Pesagem de Produto</h2>

        <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-sm text-slate-700">Produto: <strong>{{ weightedProduct?.name }}</strong></p>
          <p class="mt-1 text-sm text-slate-700">Preço por kg: <strong>{{ formatCents(weightedProduct?.price_cents || 0) }}</strong></p>
        </div>

        <div class="mt-4">
          <label class="mb-1 block text-sm font-medium text-slate-700">Peso (kg)</label>
          <input
            v-model="weightedQuantityInput"
            type="text"
            inputmode="decimal"
            placeholder="1,500"
            class="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
          />
        </div>

        <p class="mt-3 text-sm text-slate-700">
          Valor calculado: <strong>{{ formatCents(weightedTotalCents) }}</strong>
        </p>

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
            @click="confirmWeightedItem"
          >
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showProductSearchModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      @click.self="showProductSearchModal = false"
    >
      <div class="w-full max-w-2xl rounded-xl bg-white p-5 shadow-lg">
        <h2 class="text-lg font-bold text-slate-900">Busca de Produto (F2)</h2>

        <input
          v-model="productSearchInput"
          type="text"
          placeholder="Digite nome ou código"
          class="mt-3 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-500"
        />

        <p v-if="productSearchError" class="mt-2 text-sm text-red-700">{{ productSearchError }}</p>
        <p v-if="loadingAllProducts" class="mt-2 text-sm text-slate-500">Carregando produtos...</p>

        <div class="mt-3 max-h-80 overflow-y-auto rounded-md border border-slate-200">
          <button
            v-for="product in productSearchResults"
            :key="product.id"
            type="button"
            class="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
            @click="selectProductFromSearch(product)"
          >
            <span>
              <span class="block text-sm font-medium text-slate-900">{{ product.name }}</span>
              <span class="text-xs text-slate-500">{{ product.barcode || product.id }}</span>
            </span>
            <strong class="text-sm text-slate-900">{{ formatCents(product.price_cents) }}</strong>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showPaymentModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      @click.self="!paymentSuccess && (showPaymentModal = false)"
    >
      <div class="w-full max-w-3xl rounded-xl bg-white p-5 shadow-lg">
        <h2 class="text-lg font-bold text-slate-900">Pagamento e Finalização</h2>

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
            <p class="text-3xl font-bold text-blue-900">{{ formatCents(totalCents) }}</p>
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
              >
                <option
                  v-for="method in paymentMethods"
                  :key="method.value"
                  :value="method.value"
                  :disabled="isFiadoOptionDisabled(method.value)"
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
            </div>

            <button
              type="button"
              class="h-10 rounded-md border border-blue-300 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              @click="addPaymentRow"
            >
              Adicionar meio de pagamento
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
              :disabled="paymentLoading"
              @click="confirmPayment"
            >
              {{ paymentLoading ? "Confirmando..." : "Confirmar" }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="showCashOutModal || showCashInModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      @click.self="closeCashMovementModal"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h2 class="text-lg font-bold text-slate-900">
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
      @click.self="showCustomerListModal = false"
    >
      <div class="w-full max-w-2xl rounded-xl bg-white p-5 shadow-lg">
        <h2 class="text-lg font-bold text-slate-900">Clientes Cadastrados</h2>

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
</template>
