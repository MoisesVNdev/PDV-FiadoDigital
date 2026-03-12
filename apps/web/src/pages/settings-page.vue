<script setup lang="ts">
import type { CardMachine } from "@pdv/shared";
import { computed, onMounted, onUnmounted, ref } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import { useApi } from "@/composables/use-api.js";
import { useAuthStore } from "@/stores/auth.store.js";

type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";
type MainTabKey = "settings" | "payment-methods";
type PaymentTabKey = "pix" | "card-machines" | "fiado";

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

const { authenticatedFetch } = useApi();
const authStore = useAuthStore();
const activeMainTab = ref<MainTabKey>("settings");
const activePaymentTab = ref<PaymentTabKey>("pix");

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

const showPasswordModal = ref(false);
const confirmationPassword = ref("");
const passwordErrors = ref<string[]>([]);
const modalError = ref<string | null>(null);

const showToast = ref(false);
const toastMessage = ref("");

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

const showDeleteConfirmModal = ref(false);
const pendingDeleteMachineId = ref<string | null>(null);
const pendingDeleteMachineName = ref("");

const currentAdminName = computed(() => authStore.user?.name?.trim() || "Administrador");

const isCardMachinesTab = computed(() => activePaymentTab.value === "card-machines");

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
  await loadPixSettings();
  await loadCardMachines();
  window.addEventListener("keydown", handleEscapeKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleEscapeKey);
});

function handleEscapeKey(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  if (showDeleteConfirmModal.value) {
    closeDeleteConfirmModal();
    return;
  }

  if (showCardMachineModal.value && !cardMachineSubmitLoading.value) {
    closeCardMachineModal();
    return;
  }

  if (!showPasswordModal.value || loadingSubmit.value) {
    return;
  }

  closePasswordModal();
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCpfForInput(value: string): string {
  const digits = normalizeDigits(value).slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCnpjForInput(value: string): string {
  const digits = normalizeDigits(value).slice(0, 14);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatPhoneForInput(value: string): string {
  const digits = normalizeDigits(value).slice(0, 11);

  if (!digits) {
    return "";
  }

  if (digits.length < 3) {
    return `(${digits}`;
  }

  const areaCode = digits.slice(0, 2);
  const firstDigit = digits.slice(2, 3);
  const middle = digits.slice(3, 7);
  const ending = digits.slice(7, 11);

  if (!middle) {
    return `(${areaCode}) ${firstDigit}`;
  }

  if (!ending) {
    return `(${areaCode}) ${firstDigit} ${middle}`;
  }

  return `(${areaCode}) ${firstDigit} ${middle}-${ending}`;
}

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

function sanitizePixKeyInput(type: PixKeyType | "", value: string): string {
  const trimmedValue = value.trim();

  if (type === "cpf" || type === "cnpj" || type === "phone") {
    return normalizeDigits(trimmedValue);
  }

  return trimmedValue;
}

function isValidCpf(value: string): boolean {
  const digits = normalizeDigits(value);

  if (!/^\d{11}$/.test(digits)) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  let sum = 0;

  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }

  const firstDigit = (sum * 10) % 11;

  if ((firstDigit === 10 ? 0 : firstDigit) !== Number(digits[9])) {
    return false;
  }

  sum = 0;

  for (let index = 0; index < 10; index += 1) {
    sum += Number(digits[index]) * (11 - index);
  }

  const secondDigit = (sum * 10) % 11;

  return (secondDigit === 10 ? 0 : secondDigit) === Number(digits[10]);
}

function isValidCnpj(value: string): boolean {
  const digits = normalizeDigits(value);

  if (!/^\d{14}$/.test(digits)) {
    return false;
  }

  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base: string, factors: number[]): number => {
    const total = base
      .split("")
      .reduce((sum, digit, index) => sum + Number(digit) * (factors[index] ?? 0), 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  if (firstDigit !== Number(digits[12])) {
    return false;
  }

  const secondDigit = calculateDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return secondDigit === Number(digits[13]);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function validatePixKey(type: PixKeyType | "", rawValue: string): string[] | undefined {
  if (!type) {
    return ["Selecione o tipo de chave Pix."];
  }

  const normalizedValue = sanitizePixKeyInput(type, rawValue);

  if (!normalizedValue) {
    return ["Chave Pix é obrigatória."];
  }

  if (type === "cpf" && !isValidCpf(normalizedValue)) {
    return ["Informe um CPF válido com 11 dígitos."];
  }

  if (type === "cnpj" && !isValidCnpj(normalizedValue)) {
    return ["Informe um CNPJ válido com 14 dígitos."];
  }

  if (type === "email" && !isValidEmail(normalizedValue)) {
    return ["Informe um e-mail válido."];
  }

  if (type === "phone" && !/^\d{11}$/.test(normalizedValue)) {
    return ["Informe um telefone válido com DDD e 9 dígitos."];
  }

  if (type === "random" && !isValidUuidV4(normalizedValue)) {
    return ["Informe uma chave aleatória válida no formato UUID v4."];
  }

  return undefined;
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

function parseRateInput(value: string): number | null {
  const normalized = value.replace(",", ".").trim();

  if (!normalized) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return parsed;
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

function openDeleteConfirmModal(cardMachine: CardMachine): void {
  pendingDeleteMachineId.value = cardMachine.id;
  pendingDeleteMachineName.value = cardMachine.name;
  showDeleteConfirmModal.value = true;
}

function closeDeleteConfirmModal(): void {
  showDeleteConfirmModal.value = false;
  pendingDeleteMachineId.value = null;
  pendingDeleteMachineName.value = "";
}

async function confirmDeleteCardMachine(): Promise<void> {
  if (!pendingDeleteMachineId.value) {
    return;
  }

  try {
    const response = await authenticatedFetch(`/api/card-machines/${pendingDeleteMachineId.value}`, {
      method: "DELETE",
    });
    const data = await response.json();
    closeDeleteConfirmModal();

    if (!response.ok) {
      cardMachinesError.value = data.message || "Não foi possível excluir a maquininha.";
      return;
    }

    await loadCardMachines();
    showSuccessToast("Maquininha excluída com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir maquininha:", error);
    cardMachinesError.value = "Erro de conexão ao excluir maquininha.";
    closeDeleteConfirmModal();
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

function showSuccessToast(message: string): void {
  toastMessage.value = message;
  showToast.value = true;

  setTimeout(() => {
    showToast.value = false;
  }, 3000);
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
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-3xl font-bold text-gray-900">Configurações</h1>
        </div>

        <div class="mt-6 flex items-center gap-2 border-b border-gray-200">
          <button
            type="button"
            :class="[
              'rounded-t-lg px-4 py-2 text-sm font-semibold transition',
              activeMainTab === 'settings'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ]"
            @click="changeMainTab('settings')"
          >
            Configurações do Sistema
          </button>
          <button
            type="button"
            :class="[
              'rounded-t-lg px-4 py-2 text-sm font-semibold transition',
              activeMainTab === 'payment-methods'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ]"
            @click="changeMainTab('payment-methods')"
          >
            Meios de Pagamento
          </button>
        </div>

        <section v-if="activeMainTab === 'payment-methods'" class="mt-4">
          <div class="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-surface/70 px-1">
            <button
              type="button"
              :class="[
                'rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition',
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
                'rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition',
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
                'rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition',
                activePaymentTab === 'fiado'
                  ? 'border-primary bg-white text-primary'
                  : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
              ]"
              @click="changePaymentTab('fiado')"
            >
              Fiado
            </button>
          </div>
        </section>

        <section
          v-if="activeMainTab === 'settings'"
          class="mt-6"
        >
          <div class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm">
            <p class="text-base font-semibold text-gray-700">🚧 Em desenvolvimento</p>
            <p class="mt-3 text-sm text-gray-600">
              As configurações gerais do sistema serão implementadas em uma próxima atualização.
            </p>
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
                    class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    class="w-full rounded border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  class="rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
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
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">Configuração de Maquininhas</h2>
              <p class="mt-1 text-sm text-gray-600">
                Cadastre as maquininhas e configure taxas para apuração correta de lucro e valor final da venda.
              </p>
            </div>

            <button
              type="button"
              class="rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark"
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

          <div v-else class="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table class="w-full min-w-[1100px]">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comportamento da Taxa</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Taxa Débito</th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Taxa Crédito (base)</th>
                  <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
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
                        class="rounded p-2 text-danger transition hover:bg-red-50"
                        title="Excluir maquininha permanentemente"
                        @click="openDeleteConfirmModal(machine)"
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
        </section>

        <section
          v-if="
            activeMainTab === 'payment-methods' &&
            activePaymentTab === 'fiado'
          "
          class="mt-6"
        >
          <div class="rounded-lg border border-gray-200 bg-surface p-6 shadow-sm">
            <p class="text-base font-semibold text-gray-700">🚧 Em desenvolvimento</p>
            <p class="mt-3 text-sm text-gray-600">
              As configurações de Fiado serão implementadas em uma próxima atualização do sistema.
            </p>
          </div>
        </section>

        <div
          v-if="showCardMachineModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="closeCardMachineModal"
        >
          <div class="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900">
                {{ isCardMachineEditMode ? "Editar Máquina" : "Nova Máquina" }}
              </h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
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

            <form class="space-y-6" @submit.prevent="submitCardMachineForm">
              <section class="space-y-4 rounded-lg border border-gray-200 p-4">
                <h3 class="text-sm font-semibold text-gray-800">Informações da Máquina</h3>
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700">Nome da Máquina *</label>
                  <input
                    v-model="cardMachineFormData.name"
                    type="text"
                    placeholder="Ex: Moderninha Branca, Stone Balcão"
                    maxlength="100"
                    class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                      class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                      class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                      class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="(event) => handleRateInput(event, 'credit_incremental_rate')"
                    />
                    <p class="mt-0.5 text-xs text-gray-500">Percentual adicional por parcela além da primeira.</p>
                  </div>

                  <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700">Máximo de Parcelas Aceitas</label>
                    <select
                      v-model="cardMachineFormData.rates.max_installments"
                      class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option v-for="value in 12" :key="value" :value="String(value)">{{ value }}</option>
                    </select>
                  </div>
                </div>

                <div v-if="ratePreviewItems.length > 0" class="rounded-md bg-gray-50 p-3">
                  <p class="mb-2 text-xs font-semibold text-gray-700">Prévia das taxas:</p>
                  <ul class="space-y-1">
                    <li
                      v-for="item in ratePreviewItems"
                      :key="item.installments"
                      class="flex items-center justify-between text-xs text-gray-700"
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

              <div class="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  :disabled="cardMachineSubmitLoading"
                  @click="closeCardMachineModal"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="cardMachineSubmitLoading"
                >
                  {{ cardMachineSubmitLoading ? "Salvando..." : "Salvar" }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Modal de confirmação de exclusão permanente de maquininha -->
        <div
          v-if="showDeleteConfirmModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="closeDeleteConfirmModal"
        >
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-danger"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 class="text-lg font-bold text-gray-900">Excluir maquininha?</h2>
                <p class="text-sm text-gray-600">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <p class="mb-6 text-sm text-gray-700">
              Tem certeza que deseja excluir permanentemente a maquininha
              <strong class="font-semibold">"{{ pendingDeleteMachineName }}"</strong>?
            </p>

            <div class="flex justify-end gap-3">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                @click="closeDeleteConfirmModal"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger/80"
                @click="confirmDeleteCardMachine"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="showPasswordModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="closePasswordModal"
        >
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900">Confirme sua senha para continuar</h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
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
                  autocomplete="current-password"
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div v-if="passwordErrors.length > 0" class="mt-1 text-xs text-danger" role="alert">
                  {{ passwordErrors[0] }}
                </div>
              </div>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  :disabled="loadingSubmit"
                  @click="closePasswordModal"
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
                  <span>{{ loadingSubmit ? "Confirmando..." : "Confirmar" }}</span>
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
