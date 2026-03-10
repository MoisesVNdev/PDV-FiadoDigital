<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import { useApi } from "@/composables/use-api.js";
import { useAuthStore } from "@/stores/auth.store.js";

type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

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

const currentAdminName = computed(() => authStore.user?.name?.trim() || "Administrador");

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
  window.addEventListener("keydown", handleEscapeKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleEscapeKey);
});

function handleEscapeKey(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
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
      .reduce((sum, digit, index) => sum + Number(digit) * factors[index], 0);
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
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Configurações do Pix</h1>
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
              A chave é salva sem máscara. Nome e cidade devem seguir os limites definidos pelo padrão do Banco Central.
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
