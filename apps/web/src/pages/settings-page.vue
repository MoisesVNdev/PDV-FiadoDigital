<script setup lang="ts">
import type { CardMachine } from "@pdv/shared";
import { computed, onMounted, ref } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import ConfirmDialog from "@/components/layout/confirm-dialog.vue";
import { useApi } from "@/composables/use-api.js";
import { useConfirm } from "@/composables/use-confirm.js";
import { useFormatting } from "@/composables/use-formatting.js";
import { useModalStack } from "@/composables/use-modal-stack.js";
import { useSettingsDomain } from "@/composables/use-settings-domain.js";
import { useToast } from "@/composables/use-toast.js";
import { useAuthStore } from "@/stores/auth.store.js";

type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";
type MainTabKey = "settings" | "payment-methods" | "alerts";
type PaymentTabKey = "pix" | "card-machines" | "fiado" | "whatsapp" | "change-discount";

interface CardMachineFormData {
  name: string;
  is_active: boolean;
  absorb_fee: boolean;
  rates: {
    debit_rate: string;
    credit_base_rate: string;
    credit_incremental_rate: string;
    max_installments: string;
  };
}

interface CardMachineFormErrors {
  name?: string[];
  is_active?: string[];
  absorb_fee?: string[];
  rates?: string[];
  submit?: string;
}

interface PixSettingsResponse {
  pix_key_type: PixKeyType | "";
  pix_key: string;
  merchant_name: string;
  merchant_city: string;
}

interface FormData {
  pix_key_type: PixKeyType | "";
  merchant_name: string;
  merchant_city: string;
}

interface FormErrors {
  pix_key_type?: string[];
  pix_key?: string[];
  merchant_name?: string[];
  merchant_city?: string[];
  submit?: string;
}

interface GeneralSettingsResponse {
  discount_limit_daily: number;
  discount_limit_weekly: number;
  discount_limit_monthly: number;
  store_name: string;
  store_cnpj: string;
  store_address: string;
  store_phone: string;
  receipt_footer: string;
  fiado_max_days: number;
  fiado_allow_inactive: boolean;
  fiado_blocked_message: string;
  stock_alert_min_units: number;
  stock_alert_min_bulk_kg: number;
  cash_register_alert_amount_cents: number;
  refund_alert_limit_cents: number;
  fiado_alert_at_90_percent: boolean;
  fiado_alert_on_due_day: boolean;
  whatsapp_message_fiado_vencido: string;
  whatsapp_message_fiado_a_vencer: string;
  whatsapp_due_partial_message?: string;
  whatsapp_overdue_partial_message?: string;
  stock_alert_type_settings: Record<string, number>;
  stock_alert_type_pct_settings?: Record<string, number>;
}

interface ProductTypeOption {
  id: string;
  name: string;
}

interface ProductStockUnitInfo {
  product_type_id: string | null;
  is_bulk: boolean;
}

type WhatsAppTemplateField = "whatsapp_message_fiado_vencido" | "whatsapp_message_fiado_a_vencer" | "whatsapp_due_partial_message" | "whatsapp_overdue_partial_message";

const { authenticatedFetch } = useApi();
const authStore = useAuthStore();
const activeMainTab = ref<MainTabKey>("settings");
const activePaymentTab = ref<PaymentTabKey>("pix");
const activeWhatsappTemplate = ref<WhatsAppTemplateField>("whatsapp_message_fiado_vencido");

const pixKeyTypeOptions: Array<{ value: PixKeyType; label: string }> = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória (EVP)" },
];

const loadingSettings = ref(false);
const loadingSubmit = ref(false);
const fetchError = ref<string | null>(null);
const pixKeyInput = ref("");
const formData = ref<FormData>({
  pix_key_type: "",
  merchant_name: "",
  merchant_city: "",
});
const formErrors = ref<FormErrors>({});

const generalSettingsLoading = ref(false);
const generalSettingsSaving = ref(false);
const generalSettingsError = ref<string | null>(null);
const systemSubmitError = ref<string | null>(null);
const fiadoSubmitError = ref<string | null>(null);
const whatsappSubmitError = ref<string | null>(null);
const alertsSaving = ref(false);
const alertsSubmitError = ref<string | null>(null);

const systemForm = ref({
  store_name: "",
  store_cnpj: "",
  store_address: "",
  store_phone: "",
  receipt_footer: "",
  discount_limit_daily: "",
  discount_limit_weekly: "",
  discount_limit_monthly: "",
});

const fiadoForm = ref({
  fiado_max_days: "",
  fiado_allow_inactive: false,
  fiado_blocked_message: "",
});

const whatsappForm = ref({
  whatsapp_message_fiado_vencido: "",
  whatsapp_message_fiado_a_vencer: "",
  whatsapp_due_partial_message: "",
  whatsapp_overdue_partial_message: "",
});

const alertsForm = ref({
  stock_alert_min_units: "",
  stock_alert_min_bulk_kg: "",
  cash_register_alert_amount_cents: "",
  refund_alert_limit_cents: "",
  fiado_alert_at_90_percent: true,
  fiado_alert_on_due_day: true,
});

const alertTypeLimitForm = ref<Record<string, string>>({});
const alertTypePctLimitForm = ref<Record<string, string>>({});
const alertTypesSortColumn = ref<"name" | "limit_qty" | "limit_pct" | null>(null);
const alertTypesSortOrder = ref<"asc" | "desc">("asc");
const alertTypesCurrentPage = ref(1);
const ALERT_TYPES_PAGE_SIZE = 5;
const alertProductTypes = ref<ProductTypeOption[]>([]);
const alertTypeUnitMap = ref<Record<string, "un" | "kg">>({});

const showPasswordModal = ref(false);
const confirmationPassword = ref("");
const passwordErrors = ref<string[]>([]);
const modalError = ref<string | null>(null);

const { showToast, toastMessage, toastType, toast } = useToast();
const { showConfirm, confirmTitle, confirmMessage, confirmLabel, confirm, onConfirm, onCancel } = useConfirm();
const {
  normalizeDigits,
  formatCpfForInput,
  formatCnpjForInput,
  formatPhoneForInput,
  formatCurrencyInput,
  parseCurrencyInputToNullableCents,
  formatWeightInput,
  parseWeightInputToNullableKg,
} = useFormatting();
const { sanitizePixKeyInput, validatePixKey, parseRateInput } = useSettingsDomain();

const cardMachines = ref<CardMachine[]>([]);
const loadingCardMachines = ref(false);
const cardMachinesError = ref<string | null>(null);
const showCardMachineModal = ref(false);
const isCardMachineEditMode = ref(false);
const editingCardMachineId = ref<string | null>(null);
const cardMachineFormData = ref<CardMachineFormData>({
  name: "",
  is_active: true,
  absorb_fee: true,
  rates: {
    debit_rate: "",
    credit_base_rate: "",
    credit_incremental_rate: "",
    max_installments: "1",
  },
});
const cardMachineFormErrors = ref<CardMachineFormErrors>({});
const cardMachineSubmitLoading = ref(false);

const currentAdminName = computed(() => authStore.user?.name?.trim() || "Administrador");

const isCardMachinesTab = computed(() => activePaymentTab.value === "card-machines");
const whatsappVencidoTextarea = ref<HTMLTextAreaElement | null>(null);
const whatsappAVencerTextarea = ref<HTMLTextAreaElement | null>(null);
const whatsappDuePartialTextarea = ref<HTMLTextAreaElement | null>(null);
const whatsappOverduePartialTextarea = ref<HTMLTextAreaElement | null>(null);
const whatsappTokenButtons = [
  { label: "+ Nome do Cliente", token: "[NOME]" },
  { label: "+ Valor Total", token: "[TOTAL]" },
  { label: "+ Valor da Cobrança", token: "[COBRANCA]" },
  { label: "+ Data de Vencimento", token: "[VENCIMENTO]" },
] as const;
const whatsappMessageDefaults: Record<WhatsAppTemplateField, string> = {
  whatsapp_message_fiado_vencido:
    "Olá [NOME], notamos que o seu fiado de [TOTAL] venceu em [VENCIMENTO]. Como podemos te ajudar a regularizar?",
  whatsapp_message_fiado_a_vencer:
    "Olá [NOME], passando para lembrar que o seu fiado de [TOTAL] vence em [VENCIMENTO]. Se precisar, estamos à disposição.",
  whatsapp_due_partial_message:
    "Olá [NOME], passando para lembrar que o seu fiado de [TOTAL] vence em [VENCIMENTO]. Sua cobrança atual é de [COBRANCA]. Se precisar, estamos à disposição.",
  whatsapp_overdue_partial_message:
    "Olá [NOME], notamos que o seu fiado de [TOTAL] venceu em [VENCIMENTO]. Falta um pagamento de [COBRANCA]. Como podemos te ajudar a regularizar?",
};
const whatsappPreviewValues: Record<string, string> = {
  "[NOME]": "Fulano",
  "[TOTAL]": "R$ 50,00",
  "[COBRANCA]": "R$ 20,00",
  "[VENCIMENTO]": "25/03/2026",
};

const whatsappPreviewVencido = computed(() =>
  buildWhatsappPreview(whatsappForm.value.whatsapp_message_fiado_vencido, "whatsapp_message_fiado_vencido"),
);

const whatsappPreviewAVencer = computed(() =>
  buildWhatsappPreview(whatsappForm.value.whatsapp_message_fiado_a_vencer, "whatsapp_message_fiado_a_vencer"),
);

const whatsappPreviewDuePartial = computed(() =>
  buildWhatsappPreview(whatsappForm.value.whatsapp_due_partial_message, "whatsapp_due_partial_message"),
);

const whatsappPreviewOverduePartial = computed(() =>
  buildWhatsappPreview(whatsappForm.value.whatsapp_overdue_partial_message, "whatsapp_overdue_partial_message"),
);

const ratePreviewItems = computed(() => {
  const baseRate = parseRateInput(cardMachineFormData.value.rates.credit_base_rate);
  const incrementalRate = parseRateInput(cardMachineFormData.value.rates.credit_incremental_rate);
  const maxInstallments = Number.parseInt(cardMachineFormData.value.rates.max_installments, 10);

  if (baseRate === null || incrementalRate === null || Number.isNaN(maxInstallments) || maxInstallments < 1) {
    return [];
  }

  return Array.from({ length: maxInstallments }, (_, i) => {
    const n = i + 1;
    const rate = baseRate + (n - 1) * incrementalRate;
    return {
      installments: n,
      rateLabel: rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  });
});

const pixKeyPlaceholder = computed(() => {
  if (formData.value.pix_key_type === "cpf") {
    return "000.000.000-00";
  }

  if (formData.value.pix_key_type === "cnpj") {
    return "00.000.000/0000-00";
  }

  if (formData.value.pix_key_type === "email") {
    return "seunome@email.com";
  }

  if (formData.value.pix_key_type === "phone") {
    return "(81) 9 9999-9999";
  }

  if (formData.value.pix_key_type === "random") {
    return "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
  }

  return "Selecione o tipo de chave para continuar";
});

const pixKeyInputMode = computed(() => {
  if (
    formData.value.pix_key_type === "cpf" ||
    formData.value.pix_key_type === "cnpj" ||
    formData.value.pix_key_type === "phone"
  ) {
    return "numeric";
  }

  return "text";
});

const pixKeyStorageHint = computed(() => {
  if (formData.value.pix_key_type === "phone") {
    return "O telefone será salvo sem máscara, com DDD e 9 dígitos.";
  }

  if (formData.value.pix_key_type === "email") {
    return "O e-mail será salvo sem formatação adicional.";
  }

  if (formData.value.pix_key_type === "random") {
    return "A chave aleatória deve estar no formato UUID v4.";
  }

  return "O valor será salvo sem máscara, apenas com os caracteres essenciais.";
});

onMounted(async () => {
  await loadAlertTypeMetadata();
  await loadGeneralSettings();
  await loadPixSettings();
  await loadCardMachines();
});

function formatStoredPixKeyForDisplay(type: PixKeyType | "", value: string): string {
  if (type === "cpf") {
    return formatCpfForInput(value);
  }

  if (type === "cnpj") {
    return formatCnpjForInput(value);
  }

  if (type === "phone") {
    return formatPhoneForInput(value);
  }

  return value;
}

function handleStoreCnpjInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  systemForm.value.store_cnpj = formatCnpjForInput(target.value);
}

function handleStorePhoneInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  systemForm.value.store_phone = formatPhoneForInput(target.value);
}

function handleDiscountLimitInput(
  event: Event,
  field: "discount_limit_daily" | "discount_limit_weekly" | "discount_limit_monthly",
): void {
  const target = event.target as HTMLInputElement;
  systemForm.value[field] = formatCurrencyInput(target.value);
}

function handleFiadoMaxDaysInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  fiadoForm.value.fiado_max_days = target.value.replace(/\D/g, "");
}

function handleAlertStockMinUnitsInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  alertsForm.value.stock_alert_min_units = target.value.replace(/\D/g, "");
}

function handleAlertStockMinBulkKgInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  alertsForm.value.stock_alert_min_bulk_kg = formatWeightInput(target.value);
}

function handleAlertCashRegisterInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  alertsForm.value.cash_register_alert_amount_cents = formatCurrencyInput(target.value);
}

function handleAlertRefundLimitInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  alertsForm.value.refund_alert_limit_cents = formatCurrencyInput(target.value);
}

function handleTypeLimitInput(productTypeId: string, unit: "un" | "kg", event: Event): void {
  const target = event.target as HTMLInputElement;

  if (unit === "kg") {
    alertTypeLimitForm.value[productTypeId] = formatWeightInput(target.value);
    return;
  }

  alertTypeLimitForm.value[productTypeId] = target.value.replace(/\D/g, "");
}

const sortedAlertProductTypes = computed(() => {
  const base = [...alertProductTypes.value];
  const column = alertTypesSortColumn.value;

  if (!column) {
    return base.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }

  return base.sort((a, b) => {
    let valA: string | number;
    let valB: string | number;

    if (column === "name") {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (column === "limit_qty") {
      valA = Number(alertTypeLimitForm.value[a.id]?.replace(/[^\d]/g, "") || 0);
      valB = Number(alertTypeLimitForm.value[b.id]?.replace(/[^\d]/g, "") || 0);
    } else {
      valA = Number(alertTypePctLimitForm.value[a.id] || 0);
      valB = Number(alertTypePctLimitForm.value[b.id] || 0);
    }

    const direction = alertTypesSortOrder.value === "asc" ? 1 : -1;
    return valA > valB ? direction : valA < valB ? -direction : 0;
  });
});

const totalAlertTypePages = computed(() =>
  Math.max(1, Math.ceil(alertProductTypes.value.length / ALERT_TYPES_PAGE_SIZE)),
);

const paginatedAlertProductTypes = computed(() => {
  const start = (alertTypesCurrentPage.value - 1) * ALERT_TYPES_PAGE_SIZE;
  return sortedAlertProductTypes.value.slice(start, start + ALERT_TYPES_PAGE_SIZE);
});

function getTypeUnit(productTypeId: string): "un" | "kg" {
  return alertTypeUnitMap.value[productTypeId] ?? "un";
}

function toggleAlertTypesSort(column: "name" | "limit_qty" | "limit_pct"): void {
  if (alertTypesSortColumn.value === column) {
    alertTypesSortOrder.value = alertTypesSortOrder.value === "asc" ? "desc" : "asc";
  } else {
    alertTypesSortColumn.value = column;
    alertTypesSortOrder.value = "asc";
  }
  alertTypesCurrentPage.value = 1;
}

function handleTypePctInput(productTypeId: string, event: Event): void {
  const target = event.target as HTMLInputElement;
  const raw = target.value.replace(/\D/g, "");
  const parsed = Number.parseInt(raw, 10);
  alertTypePctLimitForm.value[productTypeId] = Number.isNaN(parsed) ? "" : String(Math.min(100, parsed));
}

function getWhatsappDefaultMessage(field: WhatsAppTemplateField): string {
  return whatsappMessageDefaults[field];
}

function getWhatsappMessageLength(field: WhatsAppTemplateField): number {
  return whatsappForm.value[field].length;
}

function ensureWhatsappMessageDefault(field: WhatsAppTemplateField): void {
  if (whatsappForm.value[field].trim()) {
    return;
  }

  whatsappForm.value[field] = getWhatsappDefaultMessage(field);
}

function restoreWhatsappDefault(field: WhatsAppTemplateField): void {
  whatsappForm.value[field] = getWhatsappDefaultMessage(field);
}

function getWhatsappTextarea(field: WhatsAppTemplateField): HTMLTextAreaElement | null {
  if (field === "whatsapp_message_fiado_vencido") {
    return whatsappVencidoTextarea.value;
  }
  if (field === "whatsapp_due_partial_message") {
    return whatsappDuePartialTextarea.value;
  }
  if (field === "whatsapp_overdue_partial_message") {
    return whatsappOverduePartialTextarea.value;
  }

  return whatsappAVencerTextarea.value;
}

function insertWhatsappToken(field: WhatsAppTemplateField, token: string): void {
  ensureWhatsappMessageDefault(field);

  const textarea = getWhatsappTextarea(field);
  const currentValue = whatsappForm.value[field];

  if (!textarea) {
    whatsappForm.value[field] = `${currentValue} ${token}`.trim();
    return;
  }

  const selectionStart = textarea.selectionStart ?? currentValue.length;
  const selectionEnd = textarea.selectionEnd ?? currentValue.length;
  const nextValue =
    currentValue.slice(0, selectionStart) +
    token +
    currentValue.slice(selectionEnd);

  whatsappForm.value[field] = nextValue;

  requestAnimationFrame(() => {
    textarea.focus();
    const cursorPosition = selectionStart + token.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  });
}

function buildWhatsappPreview(message: string, field: WhatsAppTemplateField): string {
  const baseMessage = message.trim() || getWhatsappDefaultMessage(field);

  return Object.entries(whatsappPreviewValues).reduce((preview, [token, value]) => {
    return preview.replaceAll(token, value);
  }, baseMessage);
}

async function loadAlertTypeMetadata(): Promise<void> {
  try {
    const typeResponse = await authenticatedFetch("/api/product-types");
    const typeData = await typeResponse.json();

    if (typeResponse.ok) {
      alertProductTypes.value = (typeData.data || []) as ProductTypeOption[];
    }

    const products: ProductStockUnitInfo[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const productsResponse = await authenticatedFetch(`/api/products?per_page=100&page=${page}`);
      const productsData = await productsResponse.json();

      if (!productsResponse.ok) {
        break;
      }

      const pageData = (productsData.data || []) as ProductStockUnitInfo[];
      products.push(...pageData);

      totalPages = Number.parseInt(String(productsData.pagination?.total_pages || 1), 10) || 1;
      page += 1;
    }

    const allBulkMap: Record<string, boolean> = {};
    const hasAnyProductMap: Record<string, boolean> = {};

    for (const product of products) {
      if (!product.product_type_id) {
        continue;
      }

      hasAnyProductMap[product.product_type_id] = true;

      if (allBulkMap[product.product_type_id] === undefined) {
        allBulkMap[product.product_type_id] = true;
      }

      if (!product.is_bulk) {
        allBulkMap[product.product_type_id] = false;
      }
    }

    const nextUnitMap: Record<string, "un" | "kg"> = {};

    for (const productType of alertProductTypes.value) {
      const hasProducts = hasAnyProductMap[productType.id] === true;
      const isAllBulk = allBulkMap[productType.id] === true;
      nextUnitMap[productType.id] = hasProducts && isAllBulk ? "kg" : "un";
    }

    alertTypeUnitMap.value = nextUnitMap;
  } catch {
    alertProductTypes.value = [];
    alertTypeUnitMap.value = {};
  }
}

async function loadGeneralSettings(): Promise<void> {
  generalSettingsLoading.value = true;
  generalSettingsError.value = null;

  try {
    const response = await authenticatedFetch("/api/settings");
    const data = await response.json();

    if (!response.ok) {
      generalSettingsError.value = data.message || "Não foi possível carregar as configurações gerais.";
      return;
    }

    const settings = data.data as GeneralSettingsResponse;

    systemForm.value = {
      store_name: settings.store_name || "",
      store_cnpj: formatCnpjForInput(settings.store_cnpj || ""),
      store_address: settings.store_address || "",
      store_phone: formatPhoneForInput(settings.store_phone || ""),
      receipt_footer: settings.receipt_footer || "",
      discount_limit_daily: settings.discount_limit_daily > 0 ? formatCurrencyInput(String(settings.discount_limit_daily)) : "",
      discount_limit_weekly: settings.discount_limit_weekly > 0 ? formatCurrencyInput(String(settings.discount_limit_weekly)) : "",
      discount_limit_monthly: settings.discount_limit_monthly > 0 ? formatCurrencyInput(String(settings.discount_limit_monthly)) : "",
    };

    fiadoForm.value = {
      fiado_max_days: settings.fiado_max_days > 0 ? String(settings.fiado_max_days) : "",
      fiado_allow_inactive: settings.fiado_allow_inactive,
      fiado_blocked_message: settings.fiado_blocked_message || "",
    };

    whatsappForm.value = {
      whatsapp_message_fiado_vencido:
        settings.whatsapp_message_fiado_vencido || getWhatsappDefaultMessage("whatsapp_message_fiado_vencido"),
      whatsapp_message_fiado_a_vencer:
        settings.whatsapp_message_fiado_a_vencer || getWhatsappDefaultMessage("whatsapp_message_fiado_a_vencer"),
      whatsapp_due_partial_message:
        settings.whatsapp_due_partial_message || getWhatsappDefaultMessage("whatsapp_due_partial_message"),
      whatsapp_overdue_partial_message:
        settings.whatsapp_overdue_partial_message || getWhatsappDefaultMessage("whatsapp_overdue_partial_message"),
    };

    alertsForm.value = {
      stock_alert_min_units: settings.stock_alert_min_units > 0 ? String(settings.stock_alert_min_units) : "",
      stock_alert_min_bulk_kg: settings.stock_alert_min_bulk_kg > 0 ? formatWeightInput(String(Math.round(settings.stock_alert_min_bulk_kg * 1000))) : "",
      cash_register_alert_amount_cents: settings.cash_register_alert_amount_cents > 0 ? formatCurrencyInput(String(settings.cash_register_alert_amount_cents)) : "",
      refund_alert_limit_cents: settings.refund_alert_limit_cents > 0 ? formatCurrencyInput(String(settings.refund_alert_limit_cents)) : "",
      fiado_alert_at_90_percent: settings.fiado_alert_at_90_percent,
      fiado_alert_on_due_day: settings.fiado_alert_on_due_day,
    };

    const nextTypeLimits: Record<string, string> = {};

    for (const [key, value] of Object.entries(settings.stock_alert_type_settings || {})) {
      const productTypeId = key.replace("stock_alert_type_", "");
      const typeUnit = getTypeUnit(productTypeId);

      if (typeUnit === "kg") {
        nextTypeLimits[productTypeId] = formatWeightInput(String(Math.round(value * 1000)));
        continue;
      }

      nextTypeLimits[productTypeId] = String(Math.trunc(value));
    }

    alertTypeLimitForm.value = nextTypeLimits;

    const nextTypePctLimits: Record<string, string> = {};

    for (const [key, value] of Object.entries(settings.stock_alert_type_pct_settings || {})) {
      const productTypeId = key.replace("stock_alert_type_pct_", "");
      nextTypePctLimits[productTypeId] = String(Math.trunc(value));
    }

    alertTypePctLimitForm.value = nextTypePctLimits;
  } catch {
    generalSettingsError.value = "Erro de conexão ao carregar configurações gerais.";
  } finally {
    generalSettingsLoading.value = false;
  }
}

async function saveSystemSettings(): Promise<void> {
  generalSettingsSaving.value = true;
  systemSubmitError.value = null;

  try {
    const response = await authenticatedFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_name: systemForm.value.store_name.trim(),
        store_cnpj: normalizeDigits(systemForm.value.store_cnpj),
        store_address: systemForm.value.store_address.trim(),
        store_phone: normalizeDigits(systemForm.value.store_phone),
        receipt_footer: systemForm.value.receipt_footer.trim(),
        discount_limit_daily: parseCurrencyInputToNullableCents(systemForm.value.discount_limit_daily) ?? undefined,
        discount_limit_weekly: parseCurrencyInputToNullableCents(systemForm.value.discount_limit_weekly) ?? undefined,
        discount_limit_monthly: parseCurrencyInputToNullableCents(systemForm.value.discount_limit_monthly) ?? undefined,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      systemSubmitError.value = data.message || "Não foi possível salvar as configurações do sistema.";
      return;
    }

    showSuccessToast("Configurações do sistema salvas com sucesso!");
    await loadGeneralSettings();
  } catch {
    systemSubmitError.value = "Erro de conexão ao salvar configurações do sistema.";
  } finally {
    generalSettingsSaving.value = false;
  }
}

async function saveFiadoSettings(): Promise<void> {
  generalSettingsSaving.value = true;
  fiadoSubmitError.value = null;

  const maxDays = fiadoForm.value.fiado_max_days
    ? Number.parseInt(fiadoForm.value.fiado_max_days, 10)
    : 0;

  if (Number.isNaN(maxDays) || maxDays < 0) {
    fiadoSubmitError.value = "Informe um prazo máximo de fiado válido.";
    generalSettingsSaving.value = false;
    return;
  }

  try {
    const response = await authenticatedFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiado_max_days: maxDays,
        fiado_allow_inactive: fiadoForm.value.fiado_allow_inactive,
        fiado_blocked_message: fiadoForm.value.fiado_blocked_message.trim(),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      fiadoSubmitError.value = data.message || "Não foi possível salvar as configurações de fiado.";
      return;
    }

    showSuccessToast("Configurações de fiado salvas com sucesso!");
    await loadGeneralSettings();
  } catch {
    fiadoSubmitError.value = "Erro de conexão ao salvar configurações de fiado.";
  } finally {
    generalSettingsSaving.value = false;
  }
}

async function saveWhatsappSettings(): Promise<void> {
  generalSettingsSaving.value = true;
  whatsappSubmitError.value = null;

  try {
    const response = await authenticatedFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsapp_message_fiado_vencido:
          (whatsappForm.value.whatsapp_message_fiado_vencido.trim() ||
            getWhatsappDefaultMessage("whatsapp_message_fiado_vencido")),
        whatsapp_message_fiado_a_vencer:
          (whatsappForm.value.whatsapp_message_fiado_a_vencer.trim() ||
            getWhatsappDefaultMessage("whatsapp_message_fiado_a_vencer")),
        whatsapp_due_partial_message:
          (whatsappForm.value.whatsapp_due_partial_message.trim() ||
            getWhatsappDefaultMessage("whatsapp_due_partial_message")),
        whatsapp_overdue_partial_message:
          (whatsappForm.value.whatsapp_overdue_partial_message.trim() ||
            getWhatsappDefaultMessage("whatsapp_overdue_partial_message")),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      whatsappSubmitError.value = data.message || "Não foi possível salvar as mensagens de WhatsApp.";
      return;
    }

    showSuccessToast("Mensagens de WhatsApp salvas com sucesso!");
    await loadGeneralSettings();
  } catch {
    whatsappSubmitError.value = "Erro de conexão ao salvar mensagens de WhatsApp.";
  } finally {
    generalSettingsSaving.value = false;
  }
}

async function saveAlertsSettings(): Promise<void> {
  alertsSaving.value = true;
  alertsSubmitError.value = null;

  const stockMinUnits = alertsForm.value.stock_alert_min_units
    ? Number.parseInt(alertsForm.value.stock_alert_min_units, 10)
    : 0;
  const stockMinBulkKg = parseWeightInputToNullableKg(alertsForm.value.stock_alert_min_bulk_kg) ?? 0;

  if (Number.isNaN(stockMinUnits) || stockMinUnits < 0) {
    alertsSubmitError.value = "Informe uma quantidade mínima de estoque válida.";
    alertsSaving.value = false;
    return;
  }

  if (Number.isNaN(stockMinBulkKg) || stockMinBulkKg < 0) {
    alertsSubmitError.value = "Informe um limite válido para produtos a granel.";
    alertsSaving.value = false;
    return;
  }

  const stockTypePayload: Record<string, number> = {};

  for (const [productTypeId, rawValue] of Object.entries(alertTypeLimitForm.value)) {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      continue;
    }

    const typeUnit = getTypeUnit(productTypeId);

    if (typeUnit === "kg") {
      const parsedKg = parseWeightInputToNullableKg(trimmed);

      if (parsedKg === null || Number.isNaN(parsedKg) || parsedKg < 0) {
        continue;
      }

      stockTypePayload[`stock_alert_type_${productTypeId}`] = parsedKg;
      continue;
    }

    const parsedUnits = Number.parseInt(trimmed, 10);

    if (Number.isNaN(parsedUnits) || parsedUnits < 0) {
      continue;
    }

    stockTypePayload[`stock_alert_type_${productTypeId}`] = parsedUnits;
  }

  const stockTypePctPayload: Record<string, number> = {};

  for (const [productTypeId, rawValue] of Object.entries(alertTypePctLimitForm.value)) {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      continue;
    }

    const parsed = Number.parseInt(trimmed, 10);

    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      continue;
    }

    stockTypePctPayload[`stock_alert_type_pct_${productTypeId}`] = parsed;
  }

  try {
    const response = await authenticatedFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stock_alert_min_units: stockMinUnits,
        stock_alert_min_bulk_kg: stockMinBulkKg,
        cash_register_alert_amount_cents:
          parseCurrencyInputToNullableCents(alertsForm.value.cash_register_alert_amount_cents) ?? 0,
        refund_alert_limit_cents:
          parseCurrencyInputToNullableCents(alertsForm.value.refund_alert_limit_cents) ?? 50000,
        fiado_alert_at_90_percent: alertsForm.value.fiado_alert_at_90_percent,
        fiado_alert_on_due_day: alertsForm.value.fiado_alert_on_due_day,
        ...stockTypePayload,
        ...stockTypePctPayload,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      alertsSubmitError.value = data.message || "Não foi possível salvar as configurações de alertas.";
      return;
    }

    showSuccessToast("Configurações de alertas salvas com sucesso!");
    await loadGeneralSettings();
  } catch {
    alertsSubmitError.value = "Erro de conexão ao salvar configurações de alertas.";
  } finally {
    alertsSaving.value = false;
  }
}

async function loadPixSettings(): Promise<void> {
  loadingSettings.value = true;
  fetchError.value = null;
  formErrors.value = {};

  try {
    const response = await authenticatedFetch("/api/settings/pix");
    const data = await response.json();

    if (!response.ok) {
      fetchError.value = data.message || "Não foi possível carregar as configurações do Pix.";
      return;
    }

    const settings = (data.data || {}) as Partial<PixSettingsResponse>;

    formData.value = {
      pix_key_type: settings.pix_key_type || "",
      merchant_name: settings.merchant_name || "",
      merchant_city: settings.merchant_city || "",
    };
    pixKeyInput.value = formatStoredPixKeyForDisplay(settings.pix_key_type || "", settings.pix_key || "");
  } catch (error) {
    console.error("Erro ao carregar configurações do Pix:", error);
    fetchError.value = "Erro de conexão ao carregar configurações do Pix.";
  } finally {
    loadingSettings.value = false;
  }
}

function handlePixKeyTypeChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  formData.value.pix_key_type = target.value as PixKeyType | "";
  pixKeyInput.value = "";
  formErrors.value.pix_key_type = undefined;
  formErrors.value.pix_key = undefined;
}

function handlePixKeyInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const selectedType = formData.value.pix_key_type;

  if (selectedType === "cpf") {
    pixKeyInput.value = formatCpfForInput(target.value);
    return;
  }

  if (selectedType === "cnpj") {
    pixKeyInput.value = formatCnpjForInput(target.value);
    return;
  }

  if (selectedType === "phone") {
    pixKeyInput.value = formatPhoneForInput(target.value);
    return;
  }

  pixKeyInput.value = target.value;
}

function validateForm(): boolean {
  formErrors.value = {};

  if (!formData.value.pix_key_type) {
    formErrors.value.pix_key_type = ["Selecione o tipo de chave Pix."];
  }

  const pixKeyValidationError = validatePixKey(formData.value.pix_key_type, pixKeyInput.value);

  if (pixKeyValidationError) {
    formErrors.value.pix_key = pixKeyValidationError;
  }

  if (!formData.value.merchant_name.trim()) {
    formErrors.value.merchant_name = ["Nome do recebedor é obrigatório."];
  } else if (formData.value.merchant_name.trim().length > 25) {
    formErrors.value.merchant_name = ["Nome do recebedor deve ter no máximo 25 caracteres."];
  }

  if (!formData.value.merchant_city.trim()) {
    formErrors.value.merchant_city = ["Cidade é obrigatória."];
  } else if (formData.value.merchant_city.trim().length > 15) {
    formErrors.value.merchant_city = ["Cidade deve ter no máximo 15 caracteres."];
  }

  return Object.keys(formErrors.value).length === 0;
}

function handleRateInput(event: Event, field: keyof CardMachineFormData["rates"]): void {
  const target = event.target as HTMLInputElement;
  const normalized = target.value.replace(/,/g, ".");

  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) {
    return;
  }

  cardMachineFormData.value.rates[field] = normalized;
}

async function loadCardMachines(): Promise<void> {
  loadingCardMachines.value = true;
  cardMachinesError.value = null;

  try {
    const response = await authenticatedFetch("/api/card-machines");
    const data = await response.json();

    if (!response.ok) {
      cardMachinesError.value = data.message || "Não foi possível carregar as maquininhas.";
      return;
    }

    cardMachines.value = data.data as CardMachine[];
  } catch (error) {
    console.error("Erro ao carregar maquininhas:", error);
    cardMachinesError.value = "Erro de conexão ao carregar maquininhas.";
  } finally {
    loadingCardMachines.value = false;
  }
}

function resetCardMachineForm(): void {
  cardMachineFormData.value = {
    name: "",
    is_active: true,
    absorb_fee: true,
    rates: {
      debit_rate: "",
      credit_base_rate: "",
      credit_incremental_rate: "",
      max_installments: "1",
    },
  };
  cardMachineFormErrors.value = {};
  editingCardMachineId.value = null;
}

function openCreateCardMachineModal(): void {
  isCardMachineEditMode.value = false;
  resetCardMachineForm();
  showCardMachineModal.value = true;
}

function openEditCardMachineModal(cardMachine: CardMachine): void {
  isCardMachineEditMode.value = true;
  editingCardMachineId.value = cardMachine.id;

  const rate = cardMachine.rates[0];

  cardMachineFormData.value = {
    name: cardMachine.name,
    is_active: cardMachine.is_active,
    absorb_fee: cardMachine.absorb_fee,
    rates: {
      debit_rate: rate ? String(rate.debit_rate) : "",
      credit_base_rate: rate ? String(rate.credit_base_rate) : "",
      credit_incremental_rate: rate ? String(rate.credit_incremental_rate) : "",
      max_installments: rate ? String(rate.max_installments) : "1",
    },
  };

  cardMachineFormErrors.value = {};
  showCardMachineModal.value = true;
}

function closeCardMachineModal(): void {
  showCardMachineModal.value = false;
  cardMachineSubmitLoading.value = false;
  resetCardMachineForm();
}

function validateCardMachineForm(): boolean {
  cardMachineFormErrors.value = {};

  if (!cardMachineFormData.value.name.trim()) {
    cardMachineFormErrors.value.name = ["Nome da máquina é obrigatório."];
  }

  const debitRate = parseRateInput(cardMachineFormData.value.rates.debit_rate);
  const creditBaseRate = parseRateInput(cardMachineFormData.value.rates.credit_base_rate);
  const creditIncrementalRate = parseRateInput(cardMachineFormData.value.rates.credit_incremental_rate);
  const maxInstallments = Number.parseInt(cardMachineFormData.value.rates.max_installments, 10);

  if (debitRate === null || creditBaseRate === null || creditIncrementalRate === null) {
    cardMachineFormErrors.value.rates = ["Informe todas as taxas com valores entre 0 e 100."];
  }

  if (Number.isNaN(maxInstallments) || maxInstallments < 1 || maxInstallments > 12) {
    cardMachineFormErrors.value.rates = ["Máximo de parcelas deve estar entre 1 e 12."];
  }

  return Object.keys(cardMachineFormErrors.value).length === 0;
}

async function submitCardMachineForm(): Promise<void> {
  if (!validateCardMachineForm()) {
    cardMachineFormErrors.value.submit = "Revise os campos destacados para continuar.";
    return;
  }

  const debitRate = parseRateInput(cardMachineFormData.value.rates.debit_rate) as number;
  const creditBaseRate = parseRateInput(cardMachineFormData.value.rates.credit_base_rate) as number;
  const creditIncrementalRate = parseRateInput(cardMachineFormData.value.rates.credit_incremental_rate) as number;
  const maxInstallments = Number.parseInt(cardMachineFormData.value.rates.max_installments, 10);

  cardMachineSubmitLoading.value = true;
  cardMachineFormErrors.value.submit = undefined;

  try {
    const payload = {
      name: cardMachineFormData.value.name.trim(),
      is_active: cardMachineFormData.value.is_active,
      absorb_fee: cardMachineFormData.value.absorb_fee,
      rates: {
        debit_rate: debitRate,
        credit_base_rate: creditBaseRate,
        credit_incremental_rate: creditIncrementalRate,
        max_installments: maxInstallments,
      },
    };

    const isEditMode = isCardMachineEditMode.value && editingCardMachineId.value;
    const response = await authenticatedFetch(
      isEditMode ? `/api/card-machines/${editingCardMachineId.value}` : "/api/card-machines",
      {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await response.json();

    if (!response.ok) {
      if (data.errors) {
        cardMachineFormErrors.value = {
          ...cardMachineFormErrors.value,
          ...data.errors,
        };
      } else {
        cardMachineFormErrors.value.submit = data.message || "Não foi possível salvar a maquininha.";
      }
      return;
    }

    closeCardMachineModal();
    await loadCardMachines();
    showSuccessToast(isEditMode ? "Maquininha atualizada com sucesso!" : "Maquininha cadastrada com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar maquininha:", error);
    cardMachineFormErrors.value.submit = "Erro de conexão ao salvar maquininha.";
  } finally {
    cardMachineSubmitLoading.value = false;
  }
}

async function toggleCardMachineActive(cardMachine: CardMachine): Promise<void> {
  const newStatus = !cardMachine.is_active;

  try {
    const response = await authenticatedFetch(`/api/card-machines/${cardMachine.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: newStatus }),
    });
    const data = await response.json();

    if (!response.ok) {
      cardMachinesError.value = data.message || "Não foi possível alterar o status da maquininha.";
      return;
    }

    await loadCardMachines();
    showSuccessToast(newStatus ? "Maquininha ativada com sucesso!" : "Maquininha desativada com sucesso!");
  } catch (error) {
    console.error("Erro ao alterar status da maquininha:", error);
    cardMachinesError.value = "Erro de conexão ao alterar status da maquininha.";
  }
}

async function deleteCardMachine(cardMachine: CardMachine): Promise<void> {
  const ok = await confirm({
    title: "Excluir maquininha",
    message: `Tem certeza que deseja excluir permanentemente a maquininha "${cardMachine.name}"? Esta ação não pode ser desfeita.`,
    confirmLabel: "Excluir",
  });

  if (!ok) {
    return;
  }

  try {
    const response = await authenticatedFetch(`/api/card-machines/${cardMachine.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      cardMachinesError.value = data.message || "Não foi possível excluir a maquininha.";
      return;
    }

    await loadCardMachines();
    showSuccessToast("Maquininha excluída com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir maquininha:", error);
    cardMachinesError.value = "Erro de conexão ao excluir maquininha.";
  }
}

function openPasswordModal(): void {
  if (!validateForm()) {
    formErrors.value.submit = "Revise os campos destacados para continuar.";
    return;
  }

  formErrors.value.submit = undefined;
  confirmationPassword.value = "";
  passwordErrors.value = [];
  modalError.value = null;
  showPasswordModal.value = true;
}

function closePasswordModal(): void {
  showPasswordModal.value = false;
  confirmationPassword.value = "";
  passwordErrors.value = [];
  modalError.value = null;
}

useModalStack(
  [
    { isOpen: showCardMachineModal, close: closeCardMachineModal },
    { isOpen: showPasswordModal, close: closePasswordModal },
  ],
  { listenEscape: true },
);

function showSuccessToast(message: string): void {
  toast(message);
}

async function confirmSavePixSettings(): Promise<void> {
  if (!validateForm()) {
    modalError.value = "Revise os campos destacados antes de confirmar.";
    return;
  }

  passwordErrors.value = [];
  modalError.value = null;
  loadingSubmit.value = true;

  try {
    const response = await authenticatedFetch("/api/settings/pix", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pix_key_type: formData.value.pix_key_type,
        pix_key: sanitizePixKeyInput(formData.value.pix_key_type, pixKeyInput.value),
        merchant_name: formData.value.merchant_name.trim(),
        merchant_city: formData.value.merchant_city.trim(),
        password: confirmationPassword.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errors = (data.errors || {}) as Record<string, string[]>;

      formErrors.value = {
        ...formErrors.value,
        pix_key_type: errors.pix_key_type || formErrors.value.pix_key_type,
        pix_key: errors.pix_key || formErrors.value.pix_key,
        merchant_name: errors.merchant_name || formErrors.value.merchant_name,
        merchant_city: errors.merchant_city || formErrors.value.merchant_city,
      };
      passwordErrors.value = errors.password || [];

      if (passwordErrors.value.length > 0) {
        modalError.value = data.message || "Confirme sua senha para continuar.";
        return;
      }

      modalError.value = data.message || "Não foi possível salvar as configurações do Pix.";
      return;
    }

    closePasswordModal();
    await loadPixSettings();
    showSuccessToast("Configurações do Pix salvas com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar configurações do Pix:", error);
    modalError.value = "Erro de conexão ao salvar configurações do Pix.";
  } finally {
    loadingSubmit.value = false;
  }
}

function changeMainTab(tab: MainTabKey): void {
  activeMainTab.value = tab;

  if (tab === "payment-methods") {
    activePaymentTab.value = "pix";
    return;
  }
}

function changePaymentTab(tab: PaymentTabKey): void {
  activePaymentTab.value = tab;
}
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">


        <div class="mt-6 overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <div class="flex gap-1 min-w-max border-b border-gray-200">
            <button
              type="button"
              :class="[
                'min-h-11 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold transition',
                activeMainTab === 'settings'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
              @click="changeMainTab('settings')"
            >
              Info. Comércio
            </button>
            <button
              type="button"
              :class="[
                'min-h-11 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold transition',
                activeMainTab === 'payment-methods'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
              @click="changeMainTab('payment-methods')"
            >
              Meios de Pagamento
            </button>
            <button
              type="button"
              :class="[
                'min-h-11 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold transition',
                activeMainTab === 'alerts'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
              @click="changeMainTab('alerts')"
            >
              Alertas e Notificações
            </button>
          </div>
        </div>

        <section v-if="activeMainTab === 'payment-methods'" class="mt-4">
          <div class="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 bg-surface/70">
            <div class="flex gap-1 min-w-max border-b border-gray-200 px-1">
              <button
                type="button"
                :class="[
                  'min-h-11 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition',
                  activePaymentTab === 'pix'
                    ? 'border-primary bg-white text-primary'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
                ]"
                @click="changePaymentTab('pix')"
              >
                Pix
              </button>
              <button
                type="button"
                :class="[
                  'min-h-11 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition',
                  activePaymentTab === 'card-machines'
                    ? 'border-primary bg-white text-primary'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
                ]"
                @click="changePaymentTab('card-machines')"
              >
                Taxas Maquineta
              </button>
              <button
                type="button"
                :class="[
                  'min-h-11 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition',
                  activePaymentTab === 'fiado'
                    ? 'border-primary bg-white text-primary'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
                ]"
                @click="changePaymentTab('fiado')"
              >
                Fiado
              </button>
              <button
                type="button"
                :class="[
                  'min-h-11 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition',
                  activePaymentTab === 'whatsapp'
                    ? 'border-primary bg-white text-primary'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
                ]"
                @click="changePaymentTab('whatsapp')"
              >
                Mensagens WhatsApp
              </button>
              <button
                type="button"
                :class="[
                  'min-h-11 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition',
                  activePaymentTab === 'change-discount'
                    ? 'border-primary bg-white text-primary'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
                ]"
                @click="changePaymentTab('change-discount')"
              >
                Desconto de Troco
              </button>
            </div>
          </div>
        </section>

        <section
          v-if="activeMainTab === 'settings'"
          class="mt-6"
        >
          <div v-if="generalSettingsLoading" class="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
            <div v-for="index in 5" :key="index" class="h-11 animate-pulse rounded bg-gray-100"></div>
          </div>

          <div v-else-if="generalSettingsError" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger" role="alert">
            <p>{{ generalSettingsError }}</p>
            <button
              type="button"
              class="mt-3 rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
              @click="loadGeneralSettings"
            >
              Tentar novamente
            </button>
          </div>

          <div v-else class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-2xl font-bold text-gray-900">Configurações do Sistema</h2>
            <p class="mt-1 text-sm text-gray-600">Dados gerais da loja e limites de desconto operacional.</p>

            <p v-if="systemSubmitError" class="mt-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
              {{ systemSubmitError }}
            </p>

            <form class="mt-6 space-y-6" @submit.prevent="saveSystemSettings">
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label for="store_name" class="mb-1 block text-sm font-medium text-gray-700">Nome da Loja</label>
                  <input
                    id="store_name"
                    v-model="systemForm.store_name"
                    type="text"
                    maxlength="120"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label for="store_cnpj" class="mb-1 block text-sm font-medium text-gray-700">CNPJ</label>
                  <input
                    id="store_cnpj"
                    :value="systemForm.store_cnpj"
                    type="text"
                    inputmode="numeric"
                    placeholder="00.000.000/0000-00"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handleStoreCnpjInput"
                  />
                </div>

                <div class="md:col-span-2">
                  <label for="store_address" class="mb-1 block text-sm font-medium text-gray-700">Endereço</label>
                  <input
                    id="store_address"
                    v-model="systemForm.store_address"
                    type="text"
                    maxlength="180"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label for="store_phone" class="mb-1 block text-sm font-medium text-gray-700">Telefone</label>
                  <input
                    id="store_phone"
                    :value="systemForm.store_phone"
                    type="text"
                    inputmode="numeric"
                    placeholder="(81) 9 9999-9999"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handleStorePhoneInput"
                  />
                </div>

                <div>
                  <label for="receipt_footer" class="mb-1 block text-sm font-medium text-gray-700">Rodapé do Recibo</label>
                  <input
                    id="receipt_footer"
                    v-model="systemForm.receipt_footer"
                    type="text"
                    maxlength="255"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  type="submit"
                  class="w-full sm:w-auto min-h-11 inline-flex items-center justify-center rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                  :disabled="generalSettingsSaving"
                >
                  {{ generalSettingsSaving ? "Salvando..." : "Salvar Configurações" }}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section
          v-if="activeMainTab === 'payment-methods' && activePaymentTab === 'change-discount'"
          class="mt-6"
        >
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-2xl font-bold text-gray-900">Desconto de Troco</h2>
            <p class="mt-1 text-sm text-gray-600">Configure os limites de desconto operacional por período.</p>

            <p v-if="systemSubmitError" class="mt-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
              {{ systemSubmitError }}
            </p>

            <form class="mt-6 space-y-6" @submit.prevent="saveSystemSettings">
              <div class="rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-semibold text-gray-800">Limites de Desconto</h3>
                <div class="mt-3 grid gap-4 md:grid-cols-3">
                  <div>
                    <label for="discount_limit_daily" class="mb-1 block text-sm font-medium text-gray-700">Diário</label>
                    <input
                      id="discount_limit_daily"
                      :value="systemForm.discount_limit_daily"
                      type="text"
                      inputmode="numeric"
                      placeholder="R$ 0,00"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="(event) => handleDiscountLimitInput(event, 'discount_limit_daily')"
                    />
                  </div>

                  <div>
                    <label for="discount_limit_weekly" class="mb-1 block text-sm font-medium text-gray-700">Semanal</label>
                    <input
                      id="discount_limit_weekly"
                      :value="systemForm.discount_limit_weekly"
                      type="text"
                      inputmode="numeric"
                      placeholder="R$ 0,00"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="(event) => handleDiscountLimitInput(event, 'discount_limit_weekly')"
                    />
                  </div>

                  <div>
                    <label for="discount_limit_monthly" class="mb-1 block text-sm font-medium text-gray-700">Mensal</label>
                    <input
                      id="discount_limit_monthly"
                      :value="systemForm.discount_limit_monthly"
                      type="text"
                      inputmode="numeric"
                      placeholder="R$ 0,00"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="(event) => handleDiscountLimitInput(event, 'discount_limit_monthly')"
                    />
                  </div>
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  type="submit"
                  class="w-full sm:w-auto min-h-11 inline-flex items-center justify-center rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                  :disabled="generalSettingsSaving"
                >
                  {{ generalSettingsSaving ? "Salvando..." : "Salvar Configurações" }}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section
          v-if="activeMainTab === 'payment-methods' && activePaymentTab === 'pix'"
          class="mt-6"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 class="text-3xl font-bold text-gray-900">Configurações do Pix</h2>
              <p class="mt-1 text-sm text-gray-600">
                Defina a chave usada no QR Code do caixa. As alterações serão confirmadas com a senha de
                {{ currentAdminName }}.
              </p>
            </div>

            <button
              type="button"
              class="rounded border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
              :disabled="loadingSettings || loadingSubmit"
              @click="loadPixSettings"
            >
              Recarregar
            </button>
          </div>

          <div v-if="loadingSettings" class="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6">
            <div v-for="index in 5" :key="index" class="h-12 animate-pulse rounded bg-gray-100"></div>
          </div>

          <div
            v-else-if="fetchError"
            class="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
            role="alert"
          >
            <p>{{ fetchError }}</p>
            <button
              type="button"
              class="mt-3 rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
              @click="loadPixSettings"
            >
              Tentar novamente
            </button>
          </div>

          <div v-else class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div class="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              <p class="font-medium">Dados usados no QR Code Pix estático</p>
              <p class="mt-1 text-blue-800">
                A chave é salva sem máscara. Nome e cidade devem seguir os limites definidos pelo padrão do Banco
                Central.
              </p>
            </div>

            <div v-if="formErrors.submit" class="mt-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
              {{ formErrors.submit }}
            </div>

            <form class="mt-6 space-y-6" novalidate @submit.prevent="openPasswordModal">
              <div class="grid gap-6 lg:grid-cols-2">
                <div class="lg:col-span-2">
                  <label for="pix_key_type" class="mb-1 block text-sm font-medium text-gray-700">
                    Tipo de Chave Pix *
                  </label>
                  <select
                    id="pix_key_type"
                    v-model="formData.pix_key_type"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @change="handlePixKeyTypeChange"
                  >
                    <option value="" disabled>Selecione o tipo de chave</option>
                    <option v-for="option in pixKeyTypeOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <div v-if="formErrors.pix_key_type" class="mt-1 text-xs text-danger" role="alert">
                    {{ formErrors.pix_key_type[0] }}
                  </div>
                </div>

                <div class="lg:col-span-2">
                  <label for="pix_key" class="mb-1 block text-sm font-medium text-gray-700">Chave Pix *</label>
                  <input
                    id="pix_key"
                    :value="pixKeyInput"
                    type="text"
                    :inputmode="pixKeyInputMode"
                    :placeholder="pixKeyPlaceholder"
                    :disabled="!formData.pix_key_type"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm disabled:cursor-not-allowed disabled:bg-gray-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handlePixKeyInput"
                  />
                  <p class="mt-1 text-xs text-gray-500">{{ pixKeyStorageHint }}</p>
                  <div v-if="formErrors.pix_key" class="mt-1 text-xs text-danger" role="alert">
                    {{ formErrors.pix_key[0] }}
                  </div>
                </div>

                <div>
                  <label for="merchant_name" class="mb-1 block text-sm font-medium text-gray-700">
                    Nome do Recebedor *
                  </label>
                  <input
                    id="merchant_name"
                    v-model="formData.merchant_name"
                    type="text"
                    maxlength="25"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p class="mt-1 text-xs text-gray-500">Máximo de 25 caracteres.</p>
                  <div v-if="formErrors.merchant_name" class="mt-1 text-xs text-danger" role="alert">
                    {{ formErrors.merchant_name[0] }}
                  </div>
                </div>

                <div>
                  <label for="merchant_city" class="mb-1 block text-sm font-medium text-gray-700">Cidade *</label>
                  <input
                    id="merchant_city"
                    v-model="formData.merchant_city"
                    type="text"
                    maxlength="15"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p class="mt-1 text-xs text-gray-500">Máximo de 15 caracteres.</p>
                  <div v-if="formErrors.merchant_city" class="mt-1 text-xs text-danger" role="alert">
                    {{ formErrors.merchant_city[0] }}
                  </div>
                </div>
              </div>

              <div class="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  :disabled="loadingSubmit"
                  @click="loadPixSettings"
                >
                  Restaurar dados
                </button>
                <button
                  type="submit"
                  class="w-full sm:w-auto min-h-11 inline-flex items-center justify-center rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="loadingSubmit"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </section>

        <section
          v-if="activeMainTab === 'payment-methods' && isCardMachinesTab"
          class="mt-6"
        >
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-lg font-semibold text-gray-900 sm:text-xl">Taxas Maquineta</h2>
            <button
              type="button"
              class="w-full sm:w-auto min-h-11 inline-flex items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-dark"
              @click="openCreateCardMachineModal"
            >
              + Nova Máquina
            </button>
          </div>

          <div v-if="loadingCardMachines" class="mt-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div v-for="index in 4" :key="index" class="h-12 animate-pulse rounded bg-gray-100"></div>
          </div>

          <div
            v-else-if="cardMachinesError"
            class="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
            role="alert"
          >
            <p>{{ cardMachinesError }}</p>
            <button
              type="button"
              class="mt-3 rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
              @click="loadCardMachines"
            >
              Tentar novamente
            </button>
          </div>

          <div v-else class="mt-6">
            <!-- TABELA — apenas md+ -->
            <div class="hidden md:block overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table class="w-full min-w-[1100px]">
                <caption class="sr-only">Lista de maquininhas de cartao cadastradas</caption>
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                    <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comportamento da Taxa</th>
                    <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Taxa Débito</th>
                    <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Taxa Crédito (base)</th>
                    <th scope="col" class="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="machine in cardMachines" :key="machine.id" class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-900">{{ machine.name }}</td>
                    <td class="px-4 py-3">
                      <span
                        :class="[
                          'inline-block rounded-full px-3 py-1 text-xs font-semibold',
                          machine.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700',
                        ]"
                      >
                        {{ machine.is_active ? "Ativa" : "Inativa" }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700">
                      {{ machine.absorb_fee ? "Absorver" : "Repassar ao cliente" }}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-800">
                      {{ `${machine.rates[0]?.debit_rate ?? 0}%` }}
                    </td>
                    <td class="px-4 py-3 text-sm font-medium text-primary">
                      {{ `${machine.rates[0]?.credit_base_rate ?? 0}%` }}
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          class="rounded p-2 text-primary transition hover:bg-primary/10"
                          title="Editar maquininha"
                          :aria-label="`Editar maquininha ${machine.name}`"
                          @click="openEditCardMachineModal(machine)"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          :class="[
                            'rounded px-2 py-1 text-xs font-medium transition',
                            machine.is_active
                              ? 'border border-amber-300 text-amber-700 hover:bg-amber-50'
                              : 'border border-green-300 text-green-700 hover:bg-green-50',
                          ]"
                          :title="machine.is_active ? 'Desativar maquininha' : 'Ativar maquininha'"
                          @click="toggleCardMachineActive(machine)"
                        >
                          {{ machine.is_active ? "Desativar" : "Ativar" }}
                        </button>
                        <button
                          v-if="authStore.user?.role === 'admin'"
                          type="button"
                          class="min-h-11 min-w-11 flex items-center justify-center rounded p-2 text-danger transition hover:bg-red-50"
                          title="Excluir maquininha permanentemente"
                          :aria-label="`Excluir maquininha ${machine.name}`"
                          @click="deleteCardMachine(machine)"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="cardMachines.length === 0">
                    <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">
                      Nenhuma maquininha cadastrada até o momento.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- CARDS MOBILE — apenas < md -->
            <ul class="md:hidden space-y-2">
              <li
                v-for="machine in cardMachines"
                :key="machine.id"
                class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <!-- Linha 1: Nome + badge de status -->
                <div class="flex items-start justify-between gap-2 mb-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-base font-semibold text-gray-900 truncate">{{ machine.name }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">
                      {{ machine.absorb_fee ? 'Absorve a taxa' : 'Repassa ao cliente' }}
                    </p>
                  </div>
                  <span
                    :class="[
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                      machine.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700',
                    ]"
                  >
                    {{ machine.is_active ? 'Ativa' : 'Inativa' }}
                  </span>
                </div>

                <!-- Linha 2: Taxas -->
                <div class="grid grid-cols-2 gap-2 text-center mb-3">
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Taxa débito</p>
                    <p class="text-sm font-bold text-gray-800">
                      {{ machine.rates[0]?.debit_rate ?? 0 }}%
                    </p>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Taxa crédito (base)</p>
                    <p class="text-sm font-bold text-primary">
                      {{ machine.rates[0]?.credit_base_rate ?? 0 }}%
                    </p>
                  </div>
                </div>

                <!-- Linha 3: Botões de ação -->
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="min-h-11 flex-1 inline-flex items-center justify-center rounded-lg border border-gray-200 text-sm font-medium text-primary transition hover:bg-primary/5"
                    :aria-label="`Editar maquininha ${machine.name}`"
                    @click="openEditCardMachineModal(machine)"
                  >
                    ✏️ Editar
                  </button>

                  <button
                    type="button"
                    :class="[
                      'min-h-11 flex-1 inline-flex items-center justify-center rounded-lg text-sm font-medium transition',
                      machine.is_active
                        ? 'border border-amber-200 text-amber-700 hover:bg-amber-50'
                        : 'border border-green-200 text-green-700 hover:bg-green-50',
                    ]"
                    @click="toggleCardMachineActive(machine)"
                  >
                    {{ machine.is_active ? 'Desativar' : 'Ativar' }}
                  </button>

                  <button
                    v-if="authStore.user?.role === 'admin'"
                    type="button"
                    class="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-red-100 text-danger transition hover:bg-red-50"
                    :aria-label="`Excluir maquininha ${machine.name}`"
                    @click="deleteCardMachine(machine)"
                  >
                    🗑️
                  </button>
                </div>
              </li>

              <li
                v-if="cardMachines.length === 0"
                class="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400"
              >
                Nenhuma maquininha cadastrada até o momento.
              </li>
            </ul>
          </div>
        </section>

        <section
          v-if="
            activeMainTab === 'payment-methods' &&
            activePaymentTab === 'fiado'
          "
          class="mt-6"
        >
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-2xl font-bold text-gray-900">Configurações de Fiado</h2>
            <p class="mt-1 text-sm text-gray-600">Parâmetros para controle de crédito e bloqueio de novos lançamentos.</p>

            <p v-if="fiadoSubmitError" class="mt-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
              {{ fiadoSubmitError }}
            </p>

            <form class="mt-6 space-y-6" @submit.prevent="saveFiadoSettings">
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label for="fiado_max_days" class="mb-1 block text-sm font-medium text-gray-700">
                    Prazo máximo para cobrança (dias)
                  </label>
                  <input
                    id="fiado_max_days"
                    :value="fiadoForm.fiado_max_days"
                    type="text"
                    inputmode="numeric"
                    placeholder="Ex: 30"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handleFiadoMaxDaysInput"
                  />
                </div>

                <div class="flex items-end">
                  <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      v-model="fiadoForm.fiado_allow_inactive"
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                    Permitir fiado para clientes inativos
                  </label>
                </div>

                <div class="md:col-span-2">
                  <label for="fiado_blocked_message" class="mb-1 block text-sm font-medium text-gray-700">
                    Mensagem para cliente bloqueado
                  </label>
                  <textarea
                    id="fiado_blocked_message"
                    v-model="fiadoForm.fiado_blocked_message"
                    rows="3"
                    maxlength="255"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ex: Cliente com fiado bloqueado até regularização do débito."
                  ></textarea>
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  type="submit"
                  class="w-full sm:w-auto min-h-11 inline-flex items-center justify-center rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                  :disabled="generalSettingsSaving"
                >
                  {{ generalSettingsSaving ? "Salvando..." : "Salvar Configurações de Fiado" }}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section
          v-if="
            activeMainTab === 'payment-methods' &&
            activePaymentTab === 'whatsapp'
          "
          class="mt-6"
        >
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-2xl font-bold text-gray-900">Mensagens WhatsApp</h2>
            <p class="mt-1 text-sm text-gray-600">Personalize os modelos usados nas cobranças automáticas de fiado.</p>

            <p v-if="whatsappSubmitError" class="mt-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
              {{ whatsappSubmitError }}
            </p>

            <form class="mt-6 space-y-6" @submit.prevent="saveWhatsappSettings">
              <!-- Tabs WhatsApp -->
              <div class="flex flex-wrap gap-2 border-b border-gray-200">
                <button
                  type="button"
                  :class="[
                    'px-4 py-2 text-sm font-semibold transition border-b-2',
                    activeWhatsappTemplate === 'whatsapp_message_fiado_vencido'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  ]"
                  @click="activeWhatsappTemplate = 'whatsapp_message_fiado_vencido'"
                >
                  Vencido (Total)
                </button>
                <button
                  type="button"
                  :class="[
                    'px-4 py-2 text-sm font-semibold transition border-b-2',
                    activeWhatsappTemplate === 'whatsapp_message_fiado_a_vencer'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  ]"
                  @click="activeWhatsappTemplate = 'whatsapp_message_fiado_a_vencer'"
                >
                  A Vencer (Total)
                </button>
                <button
                  type="button"
                  :class="[
                    'px-4 py-2 text-sm font-semibold transition border-b-2',
                    activeWhatsappTemplate === 'whatsapp_overdue_partial_message'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  ]"
                  @click="activeWhatsappTemplate = 'whatsapp_overdue_partial_message'"
                >
                  Vencido (Parcial)
                </button>
                <button
                  type="button"
                  :class="[
                    'px-4 py-2 text-sm font-semibold transition border-b-2',
                    activeWhatsappTemplate === 'whatsapp_due_partial_message'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  ]"
                  @click="activeWhatsappTemplate = 'whatsapp_due_partial_message'"
                >
                  A Vencer (Parcial)
                </button>
              </div>

              <div class="grid gap-4">
                <div v-show="activeWhatsappTemplate === 'whatsapp_message_fiado_vencido'">
                  <div class="mb-1 flex items-center justify-between gap-3">
                    <label for="whatsapp_message_fiado_vencido" class="block text-sm font-medium text-gray-700">
                      Mensagem para fiado vencido
                    </label>
                    <span class="text-xs font-medium text-gray-500">
                      {{ getWhatsappMessageLength('whatsapp_message_fiado_vencido') }}/2000 caracteres
                    </span>
                  </div>
                  <p class="mb-2 text-xs text-gray-500">
                    Clique nos botões acima para incluir informações que o sistema preenche sozinho.
                  </p>
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      v-for="button in whatsappTokenButtons"
                      :key="`vencido-${button.token}`"
                      type="button"
                      class="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100"
                      @click="insertWhatsappToken('whatsapp_message_fiado_vencido', button.token)"
                    >
                      {{ button.label }}
                    </button>
                    <button
                      type="button"
                      class="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                      @click="restoreWhatsappDefault('whatsapp_message_fiado_vencido')"
                    >
                      Restaurar modelo padrão
                    </button>
                  </div>
                  <textarea
                    id="whatsapp_message_fiado_vencido"
                    ref="whatsappVencidoTextarea"
                    v-model="whatsappForm.whatsapp_message_fiado_vencido"
                    rows="5"
                    maxlength="2000"
                    class="w-full rounded border border-red-300 px-3 py-2 text-base md:text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Olá [NOME], notamos que o seu fiado de [TOTAL] venceu em [VENCIMENTO]. Como podemos te ajudar a regularizar?"
                    @blur="ensureWhatsappMessageDefault('whatsapp_message_fiado_vencido')"
                  ></textarea>
                </div>

                <div v-show="activeWhatsappTemplate === 'whatsapp_message_fiado_a_vencer'">
                  <div class="mb-1 flex items-center justify-between gap-3">
                    <label for="whatsapp_message_fiado_a_vencer" class="block text-sm font-medium text-gray-700">
                      Mensagem para fiado a vencer
                    </label>
                    <span class="text-xs font-medium text-gray-500">
                      {{ getWhatsappMessageLength('whatsapp_message_fiado_a_vencer') }}/2000 caracteres
                    </span>
                  </div>
                  <p class="mb-2 text-xs text-gray-500">
                    Clique nos botões acima para incluir informações que o sistema preenche sozinho.
                  </p>
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      v-for="button in whatsappTokenButtons"
                      :key="`a-vencer-${button.token}`"
                      type="button"
                      class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                      @click="insertWhatsappToken('whatsapp_message_fiado_a_vencer', button.token)"
                    >
                      {{ button.label }}
                    </button>
                    <button
                      type="button"
                      class="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                      @click="restoreWhatsappDefault('whatsapp_message_fiado_a_vencer')"
                    >
                      Restaurar modelo padrão
                    </button>
                  </div>
                  <textarea
                    id="whatsapp_message_fiado_a_vencer"
                    ref="whatsappAVencerTextarea"
                    v-model="whatsappForm.whatsapp_message_fiado_a_vencer"
                    rows="5"
                    maxlength="2000"
                    class="w-full rounded border border-amber-300 px-3 py-2 text-base md:text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="Olá [NOME], passando para lembrar que o seu fiado de [TOTAL] vence em [VENCIMENTO]. Se precisar, estamos à disposição."
                    @blur="ensureWhatsappMessageDefault('whatsapp_message_fiado_a_vencer')"
                  ></textarea>
                </div>

                <div v-show="activeWhatsappTemplate === 'whatsapp_due_partial_message'">
                  <div class="mb-1 flex items-center justify-between gap-3">
                    <label for="whatsapp_due_partial_message" class="block text-sm font-medium text-gray-700">
                      Mensagem para fiado a vencer (Cobrança Parcial)
                    </label>
                    <span class="text-xs font-medium text-gray-500">
                      {{ getWhatsappMessageLength('whatsapp_due_partial_message') }}/2000 caracteres
                    </span>
                  </div>
                  <p class="mb-2 text-xs text-gray-500">
                    Clique nos botões acima para incluir informações que o sistema preenche sozinho.
                  </p>
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      v-for="button in whatsappTokenButtons"
                      :key="`due-partial-${button.token}`"
                      type="button"
                      class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                      @click="insertWhatsappToken('whatsapp_due_partial_message', button.token)"
                    >
                      {{ button.label }}
                    </button>
                    <button
                      type="button"
                      class="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                      @click="restoreWhatsappDefault('whatsapp_due_partial_message')"
                    >
                      Restaurar modelo padrão
                    </button>
                  </div>
                  <textarea
                    id="whatsapp_due_partial_message"
                    ref="whatsappDuePartialTextarea"
                    v-model="whatsappForm.whatsapp_due_partial_message"
                    rows="5"
                    maxlength="2000"
                    class="w-full rounded border border-blue-300 px-3 py-2 text-base md:text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Olá [NOME], passando para lembrar que o seu fiado de [TOTAL] vence em [VENCIMENTO]. Sua cobrança atual é de [COBRANCA]. Se precisar, estamos à disposição."
                    @blur="ensureWhatsappMessageDefault('whatsapp_due_partial_message')"
                  ></textarea>
                </div>

                <div v-show="activeWhatsappTemplate === 'whatsapp_overdue_partial_message'">
                  <div class="mb-1 flex items-center justify-between gap-3">
                    <label for="whatsapp_overdue_partial_message" class="block text-sm font-medium text-gray-700">
                      Mensagem para fiado vencido (Cobrança Parcial)
                    </label>
                    <span class="text-xs font-medium text-gray-500">
                      {{ getWhatsappMessageLength('whatsapp_overdue_partial_message') }}/2000 caracteres
                    </span>
                  </div>
                  <p class="mb-2 text-xs text-gray-500">
                    Clique nos botões acima para incluir informações que o sistema preenche sozinho.
                  </p>
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      v-for="button in whatsappTokenButtons"
                      :key="`overdue-partial-${button.token}`"
                      type="button"
                      class="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-100"
                      @click="insertWhatsappToken('whatsapp_overdue_partial_message', button.token)"
                    >
                      {{ button.label }}
                    </button>
                    <button
                      type="button"
                      class="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                      @click="restoreWhatsappDefault('whatsapp_overdue_partial_message')"
                    >
                      Restaurar modelo padrão
                    </button>
                  </div>
                  <textarea
                    id="whatsapp_overdue_partial_message"
                    ref="whatsappOverduePartialTextarea"
                    v-model="whatsappForm.whatsapp_overdue_partial_message"
                    rows="5"
                    maxlength="2000"
                    class="w-full rounded border border-purple-300 px-3 py-2 text-base md:text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    placeholder="Olá [NOME], notamos que o seu fiado de [TOTAL] venceu em [VENCIMENTO]. Falta um pagamento de [COBRANCA]. Como podemos te ajudar a regularizar?"
                    @blur="ensureWhatsappMessageDefault('whatsapp_overdue_partial_message')"
                  ></textarea>
                </div>

                <div class="rounded-2xl border border-green-200 bg-[#e7f7eb] p-4">
                  <div class="mb-3 flex items-center gap-2 text-sm font-medium text-green-900">
                    <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">W</span>
                    Simulação de preview
                  </div>

                  <div class="space-y-4 rounded-2xl bg-[#d8f3dc] p-4">
                    <div v-show="activeWhatsappTemplate === 'whatsapp_message_fiado_vencido'" class="flex justify-end">
                      <div class="max-w-[92%] rounded-2xl rounded-tr-md bg-[#dcf8c6] px-4 py-3 text-sm text-gray-800 shadow-sm">
                        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Fiado vencido</p>
                        <p class="whitespace-pre-line">{{ whatsappPreviewVencido }}</p>
                        <p class="mt-2 text-right text-[11px] text-gray-500">09:41</p>
                      </div>
                    </div>

                    <div v-show="activeWhatsappTemplate === 'whatsapp_message_fiado_a_vencer'" class="flex justify-end">
                      <div class="max-w-[92%] rounded-2xl rounded-tr-md bg-[#dcf8c6] px-4 py-3 text-sm text-gray-800 shadow-sm">
                        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Fiado a vencer</p>
                        <p class="whitespace-pre-line">{{ whatsappPreviewAVencer }}</p>
                        <p class="mt-2 text-right text-[11px] text-gray-500">09:42</p>
                      </div>
                    </div>

                    <div v-show="activeWhatsappTemplate === 'whatsapp_overdue_partial_message'" class="flex justify-end">
                      <div class="max-w-[92%] rounded-2xl rounded-tr-md bg-[#dcf8c6] px-4 py-3 text-sm text-gray-800 shadow-sm">
                        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-purple-700">Fiado vencido (Parcial)</p>
                        <p class="whitespace-pre-line">{{ whatsappPreviewOverduePartial }}</p>
                        <p class="mt-2 text-right text-[11px] text-gray-500">09:43</p>
                      </div>
                    </div>

                    <div v-show="activeWhatsappTemplate === 'whatsapp_due_partial_message'" class="flex justify-end">
                      <div class="max-w-[92%] rounded-2xl rounded-tr-md bg-[#dcf8c6] px-4 py-3 text-sm text-gray-800 shadow-sm">
                        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Fiado a vencer (Parcial)</p>
                        <p class="whitespace-pre-line">{{ whatsappPreviewDuePartial }}</p>
                        <p class="mt-2 text-right text-[11px] text-gray-500">09:44</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  type="submit"
                  class="w-full sm:w-auto min-h-11 inline-flex items-center justify-center rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                  :disabled="generalSettingsSaving"
                >
                  {{ generalSettingsSaving ? "Salvando..." : "Salvar Mensagens" }}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section
          v-if="activeMainTab === 'alerts'"
          class="mt-6"
        >
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-2xl font-bold text-gray-900">Alertas e Notificações</h2>
            <p class="mt-1 text-sm text-gray-600">Limites que disparam alertas automáticos para a equipe.</p>

            <p v-if="alertsSubmitError" class="mt-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
              {{ alertsSubmitError }}
            </p>

            <form class="mt-6 space-y-6" @submit.prevent="saveAlertsSettings">
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label for="stock_alert_min_units" class="mb-1 block text-sm font-medium text-gray-700">
                    Estoque mínimo - produtos unitários
                  </label>
                  <input
                    id="stock_alert_min_units"
                    :value="alertsForm.stock_alert_min_units"
                    type="text"
                    inputmode="numeric"
                    placeholder="Ex: 5"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handleAlertStockMinUnitsInput"
                  />
                  <p class="mt-1 text-xs text-gray-500">
                    Quantidade abaixo da qual um alerta de estoque baixo é gerado (fallback global).
                  </p>
                </div>

                <div>
                  <label for="stock_alert_min_bulk_kg" class="mb-1 block text-sm font-medium text-gray-700">
                    Estoque mínimo - produtos a granel (kg)
                  </label>
                  <input
                    id="stock_alert_min_bulk_kg"
                    :value="alertsForm.stock_alert_min_bulk_kg"
                    type="text"
                    inputmode="numeric"
                    placeholder="0,000"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handleAlertStockMinBulkKgInput"
                  />
                  <p class="mt-1 text-xs text-gray-500">
                    Limite global para produtos a granel com precisão de 3 casas decimais.
                  </p>
                </div>

                <div>
                  <label for="cash_register_alert_amount_cents" class="mb-1 block text-sm font-medium text-gray-700">
                    Alerta de caixa (valor em R$)
                  </label>
                  <input
                    id="cash_register_alert_amount_cents"
                    :value="alertsForm.cash_register_alert_amount_cents"
                    type="text"
                    inputmode="numeric"
                    placeholder="R$ 0,00"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handleAlertCashRegisterInput"
                  />
                  <p class="mt-1 text-xs text-gray-500">
                    Saldo do caixa abaixo deste valor dispara alerta para o gerente.
                  </p>
                </div>

                <div>
                  <label for="refund_alert_limit_cents" class="mb-1 block text-sm font-medium text-gray-700">
                    Limite para alerta de estorno (R$)
                  </label>
                  <input
                    id="refund_alert_limit_cents"
                    :value="alertsForm.refund_alert_limit_cents"
                    type="text"
                    inputmode="numeric"
                    placeholder="R$ 500,00"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @input="handleAlertRefundLimitInput"
                  />
                  <p class="mt-1 text-xs text-gray-500">
                    Estornos acima deste valor geram notificação crítica no dashboard gerencial.
                  </p>
                </div>
              </div>

              <div class="rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-semibold text-gray-800">Alertas por Tipo de Produto</h3>
                <p class="mt-1 text-xs text-gray-500">
                  Defina limites acumulados por tipo. A unidade é definida automaticamente com base no cadastro atual.
                </p>

                <div class="mt-4 hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                  <table class="w-full min-w-[640px]">
                    <thead>
                      <tr class="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th class="cursor-pointer select-none px-2 py-2" @click="toggleAlertTypesSort('name')">
                          Tipo
                          <span :class="alertTypesSortColumn === 'name' ? 'text-primary' : 'text-gray-500'">
                            {{ alertTypesSortColumn === 'name' ? (alertTypesSortOrder === 'asc' ? '↑' : '↓') : '↕' }}
                          </span>
                        </th>
                        <th class="cursor-pointer select-none px-2 py-2" @click="toggleAlertTypesSort('limit_qty')">
                          Limite mín. qtd.
                          <span :class="alertTypesSortColumn === 'limit_qty' ? 'text-primary' : 'text-gray-500'">
                            {{ alertTypesSortColumn === 'limit_qty' ? (alertTypesSortOrder === 'asc' ? '↑' : '↓') : '↕' }}
                          </span>
                        </th>
                        <th class="cursor-pointer select-none px-2 py-2" @click="toggleAlertTypesSort('limit_pct')">
                          Limite mín. %
                          <span :class="alertTypesSortColumn === 'limit_pct' ? 'text-primary' : 'text-gray-500'">
                            {{ alertTypesSortColumn === 'limit_pct' ? (alertTypesSortOrder === 'asc' ? '↑' : '↓') : '↕' }}
                          </span>
                        </th>
                        <th class="px-2 py-2">Unidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="productType in paginatedAlertProductTypes"
                        :key="productType.id"
                        class="border-b border-gray-100"
                      >
                        <td class="px-2 py-2 text-sm text-gray-800">{{ productType.name }}</td>
                        <td class="px-2 py-2">
                          <input
                            :id="`stock_alert_type_${productType.id}`"
                            :value="alertTypeLimitForm[productType.id] || ''"
                            type="text"
                            inputmode="numeric"
                            :placeholder="getTypeUnit(productType.id) === 'kg' ? '0,000' : '0'"
                            class="w-28 rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            @input="(event) => handleTypeLimitInput(productType.id, getTypeUnit(productType.id), event)"
                          />
                        </td>
                        <td class="px-2 py-2">
                          <div class="flex items-center gap-1">
                            <input
                              :id="`stock_alert_type_pct_${productType.id}`"
                              :value="alertTypePctLimitForm[productType.id] || ''"
                              type="text"
                              inputmode="numeric"
                              placeholder="0"
                              class="w-16 rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              @input="(event) => handleTypePctInput(productType.id, event)"
                            />
                            <span class="text-sm text-gray-500">%</span>
                          </div>
                        </td>
                        <td class="px-2 py-2 text-sm text-gray-600">{{ getTypeUnit(productType.id) }}</td>
                      </tr>
                      <tr v-if="paginatedAlertProductTypes.length === 0">
                        <td colspan="4" class="px-2 py-3 text-sm text-gray-500">
                          Nenhum tipo de produto cadastrado.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <ul class="mt-4 space-y-2 md:hidden">
                  <li
                    v-for="productType in paginatedAlertProductTypes"
                    :key="productType.id"
                    class="rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <div class="mb-3 flex items-center justify-between gap-2">
                      <p class="text-sm font-semibold text-gray-900">{{ productType.name }}</p>
                      <span class="rounded-full bg-surface px-2 py-0.5 text-xs text-gray-400">
                        {{ getTypeUnit(productType.id) }}
                      </span>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="mb-1 block text-xs font-medium text-gray-500">
                          Limite mín. qtd.
                        </label>
                        <input
                          :id="`stock_alert_type_mobile_${productType.id}`"
                          :value="alertTypeLimitForm[productType.id] || ''"
                          type="text"
                          inputmode="numeric"
                          :placeholder="getTypeUnit(productType.id) === 'kg' ? '0,000' : '0'"
                          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          @input="(event) => handleTypeLimitInput(productType.id, getTypeUnit(productType.id), event)"
                        />
                      </div>
                      <div>
                        <label class="mb-1 block text-xs font-medium text-gray-500">
                          Limite mín. %
                        </label>
                        <div class="relative">
                          <input
                            :id="`stock_alert_type_pct_mobile_${productType.id}`"
                            :value="alertTypePctLimitForm[productType.id] || ''"
                            type="text"
                            inputmode="numeric"
                            placeholder="0"
                            maxlength="3"
                            class="w-full rounded-lg border border-gray-200 px-3 py-2 pr-7 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            @input="(event) => handleTypePctInput(productType.id, event)"
                          />
                          <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                      </div>
                    </div>
                  </li>

                  <li
                    v-if="paginatedAlertProductTypes.length === 0"
                    class="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500"
                  >
                    Nenhum tipo de produto cadastrado.
                  </li>
                </ul>

                <div v-if="totalAlertTypePages > 1" class="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    class="min-h-11 rounded-lg border border-gray-300 px-4 text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="alertTypesCurrentPage === 1"
                    @click="alertTypesCurrentPage--"
                  >
                    ← Anterior
                  </button>
                  <span class="text-sm text-gray-500">{{ alertTypesCurrentPage }} / {{ totalAlertTypePages }}</span>
                  <button
                    type="button"
                    class="min-h-11 rounded-lg border border-gray-300 px-4 text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="alertTypesCurrentPage >= totalAlertTypePages"
                    @click="alertTypesCurrentPage++"
                  >
                    Próxima →
                  </button>
                </div>
              </div>

              <div class="rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-semibold text-gray-800">Alertas de Fiado por Cliente</h3>
                <div class="mt-3 grid gap-3 md:grid-cols-2">
                  <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      v-model="alertsForm.fiado_alert_at_90_percent"
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                    Alerta em 90% do limite de fiado
                  </label>

                  <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      v-model="alertsForm.fiado_alert_on_due_day"
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                    Alerta no dia do vencimento com saldo em aberto
                  </label>
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  type="submit"
                  class="w-full sm:w-auto min-h-11 inline-flex items-center justify-center rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                  :disabled="alertsSaving"
                >
                  {{ alertsSaving ? "Salvando..." : "Salvar Configurações de Alertas" }}
                </button>
              </div>
            </form>
          </div>
        </section>

        <div
          v-if="showCardMachineModal"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="card-machine-modal-title"
          @click.self="closeCardMachineModal"
        >
          <div class="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-3xl sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden" aria-hidden="true"></div>

            <div class="p-4 sm:p-6">
              <div class="mb-4 flex items-center justify-between">
                <h2 id="card-machine-modal-title" class="text-lg font-bold text-gray-900">
                  {{ isCardMachineEditMode ? "Editar Maquininha" : "Nova Máquina" }}
                </h2>
                <button
                  type="button"
                  class="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Fechar modal"
                  :disabled="cardMachineSubmitLoading"
                  @click="closeCardMachineModal"
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

              <form id="card-machine-form" class="space-y-6" @submit.prevent="submitCardMachineForm">
              <section class="space-y-4 rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-semibold text-gray-800">Informações da Máquina</h3>
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700">Nome da Máquina *</label>
                  <input
                    v-model="cardMachineFormData.name"
                    type="text"
                    autofocus
                    placeholder="Ex: Moderninha Branca, Stone Balcão"
                    maxlength="100"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p v-if="cardMachineFormErrors.name" class="mt-1 text-xs text-danger">
                    {{ cardMachineFormErrors.name[0] }}
                  </p>
                </div>

                <div class="flex items-center gap-3">
                  <span class="text-sm font-medium text-gray-700">Status</span>
                  <button
                    type="button"
                    class="rounded border border-gray-300 px-3 py-1.5 text-sm"
                    :class="cardMachineFormData.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'"
                    @click="cardMachineFormData.is_active = !cardMachineFormData.is_active"
                  >
                    {{ cardMachineFormData.is_active ? "Ativa" : "Inativa" }}
                  </button>
                </div>
              </section>

              <section class="space-y-4 rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-semibold text-gray-800">Configuração de Taxas</h3>

                <div class="grid gap-4 md:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700">Taxa de Débito (%)</label>
                    <input
                      :value="cardMachineFormData.rates.debit_rate"
                      type="text"
                      inputmode="decimal"
                      placeholder="Ex: 1.99"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="(event) => handleRateInput(event, 'debit_rate')"
                    />
                  </div>

                  <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700">Taxa de Crédito à Vista / Base (%)</label>
                    <input
                      :value="cardMachineFormData.rates.credit_base_rate"
                      type="text"
                      inputmode="decimal"
                      placeholder="Ex: 4.99"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="(event) => handleRateInput(event, 'credit_base_rate')"
                    />
                    <p class="mt-0.5 text-xs text-gray-500">Base para o cálculo progressivo de parcelas.</p>
                  </div>

                  <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700">Taxa Incremental por Parcela (%)</label>
                    <input
                      :value="cardMachineFormData.rates.credit_incremental_rate"
                      type="text"
                      inputmode="decimal"
                      placeholder="Ex: 1.50"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="(event) => handleRateInput(event, 'credit_incremental_rate')"
                    />
                    <p class="mt-0.5 text-xs text-gray-500">Percentual adicional por parcela além da primeira.</p>
                  </div>

                  <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700">Máximo de Parcelas Aceitas</label>
                    <select
                      v-model="cardMachineFormData.rates.max_installments"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option v-for="value in 12" :key="value" :value="String(value)">{{ value }}</option>
                    </select>
                  </div>
                </div>

                <div v-if="ratePreviewItems.length > 0" class="rounded-md bg-gray-50 p-3">
                  <p class="mb-2 text-xs font-semibold text-gray-700">Prévia das taxas:</p>
                  <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <li
                      v-for="item in ratePreviewItems"
                      :key="item.installments"
                      class="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700"
                    >
                      <span>{{ item.installments === 1 ? "1x (à vista)" : `${item.installments}x` }}</span>
                      <span class="font-medium text-primary">{{ item.rateLabel }}%</span>
                    </li>
                  </ul>
                </div>

                <p v-if="cardMachineFormErrors.rates" class="text-xs text-danger">
                  {{ cardMachineFormErrors.rates[0] }}
                </p>
              </section>

              <section class="space-y-3 rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-semibold text-gray-800">Comportamento da Taxa</h3>

                <label class="flex cursor-pointer items-start gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50">
                  <input
                    v-model="cardMachineFormData.absorb_fee"
                    type="radio"
                    :value="true"
                    class="mt-1 h-4 w-4"
                  />
                  <div>
                    <p class="text-sm font-medium text-gray-900">Absorver a taxa</p>
                    <p class="text-xs text-gray-600">
                      O preço cobrado do cliente é o preço final do produto. A taxa é deduzida internamente e
                      registrada nos relatórios para apuração do lucro real.
                    </p>
                  </div>
                </label>

                <label class="flex cursor-pointer items-start gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50">
                  <input
                    v-model="cardMachineFormData.absorb_fee"
                    type="radio"
                    :value="false"
                    class="mt-1 h-4 w-4"
                  />
                  <div>
                    <p class="text-sm font-medium text-gray-900">Repassar a taxa ao cliente</p>
                    <p class="text-xs text-gray-600">
                      O sistema acrescenta automaticamente o percentual da taxa operadora no total a ser pago pelo
                      cliente no momento do fechamento da venda.
                    </p>
                  </div>
                </label>
              </section>

              <div v-if="cardMachineFormErrors.submit" class="rounded bg-red-100 p-3 text-sm text-danger" role="alert">
                {{ cardMachineFormErrors.submit }}
              </div>

              <div class="mt-6 flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  class="w-full sm:w-auto min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  :disabled="cardMachineSubmitLoading"
                  @click="closeCardMachineModal"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="w-full sm:w-auto min-h-11 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="cardMachineSubmitLoading"
                >
                  {{ cardMachineSubmitLoading ? "Salvando..." : isCardMachineEditMode ? "Salvar alterações" : "Criar Máquina" }}
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>

        <!-- Modal de confirmação de exclusão permanente de maquininha gerenciado por ConfirmDialog -->

        <div
          v-if="showPasswordModal"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-password-modal-title"
          @click.self="closePasswordModal"
        >
          <div class="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden" aria-hidden="true"></div>

            <div class="p-4 sm:p-6">
              <div class="mb-4 flex items-center justify-between">
                <h2 id="settings-password-modal-title" class="text-lg font-bold text-gray-900">
                  Confirme sua senha para continuar
                </h2>
                <button
                  type="button"
                  class="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Fechar modal"
                  :disabled="loadingSubmit"
                  @click="closePasswordModal"
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

              <p class="text-sm text-gray-600">
                Por segurança, alterações na chave Pix exigem a confirmação da sua senha.
              </p>

              <div v-if="modalError" class="mt-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
                {{ modalError }}
              </div>

              <form class="mt-4 space-y-4" @submit.prevent="confirmSavePixSettings">
              <div>
                <label for="current_password" class="mb-1 block text-sm font-medium text-gray-700">
                  Senha do administrador *
                </label>
                <input
                  id="current_password"
                  v-model="confirmationPassword"
                  type="password"
                  autofocus
                  autocomplete="current-password"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div v-if="passwordErrors.length > 0" class="mt-1 text-xs text-danger" role="alert">
                  {{ passwordErrors[0] }}
                </div>
              </div>

              <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  class="w-full sm:w-auto min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  :disabled="loadingSubmit"
                  @click="closePasswordModal"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="loadingSubmit"
                  class="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
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
                  <span>{{ loadingSubmit ? "Confirmando..." : "Confirmar" }}</span>
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
