<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import ConfirmDialog from "@/components/layout/confirm-dialog.vue";
import { useApi } from "@/composables/use-api.js";
import { useConfirm } from "@/composables/use-confirm.js";
import { useToast } from "@/composables/use-toast.js";
import { useAuthStore } from "@/stores/auth.store.js";

const { authenticatedFetch } = useApi();
const authStore = useAuthStore();

interface Employee {
  id: string;
  name: string;
  username: string;
  role: "stockist" | "operator";
  can_view_cost_price: boolean;
  is_active: boolean;
}

interface FormData {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: "stockist" | "operator";
  can_view_cost_price: boolean;
  is_active: boolean;
}

interface FormErrors {
  name?: string[];
  username?: string[];
  password?: string[];
  confirmPassword?: string[];
  role?: string[];
  submit?: string;
}

const employees = ref<Employee[]>([]);
const showModal = ref(false);
const { showToast, toastMessage, toastType, toast } = useToast();
const { showConfirm, confirmTitle, confirmMessage, confirmLabel, confirm, onConfirm, onCancel } = useConfirm();
const modalRef = ref<HTMLElement | null>(null);
const lastFocusedElement = ref<HTMLElement | null>(null);
const isEditMode = ref(false);
const editingId = ref<string | null>(null);
const loading = ref(false);
const canManageCostVisibility = computed(() => {
  const role = authStore.user?.role;
  return role === "admin" || role === "manager";
});

const formData = ref<FormData>({
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  role: "operator",
  can_view_cost_price: false,
  is_active: true,
});

const formErrors = ref<FormErrors>({});

const roleOptions = [
  { label: "Estoquista", value: "stockist" },
  { label: "Caixa", value: "operator" },
];

onMounted(async () => {
  await loadEmployees();
});

async function loadEmployees(): Promise<void> {
  try {
    const response = await authenticatedFetch("/api/users");

    if (!response.ok) {
      console.error("Erro ao carregar funcionários");
      return;
    }

    const data = await response.json();
    employees.value = data.data.filter((user: Employee) =>
      ["stockist", "operator"].includes(user.role)
    );
  } catch (error) {
    console.error("Erro ao carregar funcionários:", error);
  }
}

function validateForm(): boolean {
  formErrors.value = {};

  if (!formData.value.name.trim()) {
    formErrors.value.name = ["Nome é obrigatório"];
  } else if (formData.value.name.length > 50) {
    formErrors.value.name = ["Nome deve ter no máximo 50 caracteres"];
  }

  if (!formData.value.username.trim()) {
    formErrors.value.username = ["Usuário é obrigatório"];
  } else if (formData.value.username.length < 3 || formData.value.username.length > 50) {
    formErrors.value.username = ["Usuário deve ter entre 3 e 50 caracteres"];
  }

  if (!isEditMode.value) {
    if (!formData.value.password) {
      formErrors.value.password = ["Senha é obrigatória"];
    } else if (!/^\d{6}$/.test(formData.value.password)) {
      formErrors.value.password = ["Senha deve conter exatamente 6 dígitos numéricos"];
    }

    if (formData.value.password !== formData.value.confirmPassword) {
      formErrors.value.confirmPassword = ["Senhas não conferem"];
    }
  }

  return Object.keys(formErrors.value).length === 0;
}

function openCreateModal(): void {
  lastFocusedElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  isEditMode.value = false;
  editingId.value = null;
  formData.value = {
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "operator",
    can_view_cost_price: false,
    is_active: true,
  };
  formErrors.value = {};
  showModal.value = true;
  focusFirstModalField();
}

function openEditModal(employee: Employee): void {
  lastFocusedElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  isEditMode.value = true;
  editingId.value = employee.id;
  formData.value = {
    name: employee.name,
    username: employee.username,
    password: "",
    confirmPassword: "",
    role: employee.role,
    can_view_cost_price: employee.can_view_cost_price,
    is_active: employee.is_active,
  };
  formErrors.value = {};
  showModal.value = true;
  focusFirstModalField();
}

function closeModal(): void {
  showModal.value = false;
  formData.value = {
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "operator",
    can_view_cost_price: false,
    is_active: true,
  };
  formErrors.value = {};
  lastFocusedElement.value?.focus();
}

async function focusFirstModalField(): Promise<void> {
  await nextTick();
  const firstFocusable = modalRef.value?.querySelector<HTMLElement>(
    "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
  );
  firstFocusable?.focus();
}

function handleModalKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeModal();
    return;
  }

  if (event.key !== "Tab" || !modalRef.value) {
    return;
  }

  const focusableElements = Array.from(
    modalRef.value.querySelectorAll<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));

  if (focusableElements.length === 0) {
    return;
  }

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function showSuccessToast(message: string): void {
  toast(message);
}

async function submitForm(): Promise<void> {
  if (!validateForm()) {
    return;
  }

  loading.value = true;
  formErrors.value.submit = undefined;

  try {
    const payload = {
      name: formData.value.name,
      username: formData.value.username,
      ...(formData.value.password && { password: formData.value.password }),
      role: formData.value.role,
      can_view_cost_price: formData.value.can_view_cost_price,
    };

    const url = isEditMode.value ? `/api/users/${editingId.value}` : "/api/users";
    const method = isEditMode.value ? "PUT" : "POST";

    const response = await authenticatedFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.errors) {
        formErrors.value = { ...formErrors.value, ...data.errors };
      } else {
        formErrors.value.submit = data.message || "Erro ao salvar funcionário";
      }
      return;
    }

    closeModal();
    await loadEmployees();
    showSuccessToast(
      isEditMode.value
        ? "Funcionário atualizado com sucesso!"
        : "Funcionário cadastrado com sucesso!"
    );
  } catch (error) {
    formErrors.value.submit = "Erro de conexão com o servidor";
    console.error("Erro ao salvar funcionário:", error);
  } finally {
    loading.value = false;
  }
}

async function toggleStatus(employee: Employee): Promise<void> {
  if (employee.is_active) {
    const ok = await confirm({
      title: "Desativar funcionário",
      message: `Tem certeza que deseja desativar \"${employee.name}\"? Ele perderá acesso ao sistema.`,
      confirmLabel: "Desativar",
    });

    if (!ok) {
      return;
    }
  }

  try {
    const response = await authenticatedFetch(`/api/users/${employee.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: employee.name,
        username: employee.username,
        role: employee.role,
        can_view_cost_price: employee.can_view_cost_price,
        is_active: !employee.is_active,
      }),
    });

    if (!response.ok) {
      console.error("Erro ao atualizar status");
      return;
    }

    await loadEmployees();
    showSuccessToast(
      employee.is_active
        ? "Funcionário desativado com sucesso!"
        : "Funcionário ativado com sucesso!"
    );
  } catch (error) {
    console.error("Erro ao atualizar funcionário:", error);
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold text-gray-900">Funcionários</h1>
          <button
            @click="openCreateModal"
            class="rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark"
          >
            + Novo Funcionário
          </button>
        </div>

        <!-- Listagem -->
        <div class="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table class="w-full">
            <caption class="sr-only">Lista de funcionarios cadastrados</caption>
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Usuário</th>
                <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Cargo</th>
                <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th scope="col" class="px-6 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="employee in employees" :key="employee.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm text-gray-900">{{ employee.name }}</td>
                <td class="px-6 py-4 text-sm text-gray-600">{{ employee.username }}</td>
                <td class="px-6 py-4 text-sm text-gray-600">
                  {{ employee.role === "stockist" ? "Estoquista" : "Caixa" }}
                </td>
                <td class="px-6 py-4">
                  <span
                    :class="[
                      'inline-block rounded-full px-3 py-1 text-xs font-semibold',
                      employee.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800',
                    ]"
                  >
                    {{ employee.is_active ? "Ativo" : "Inativo" }}
                  </span>
                </td>
                <td class="flex items-center justify-center gap-2 px-6 py-4">
                  <button
                    @click="openEditModal(employee)"
                    class="rounded px-3 py-1 text-sm text-primary transition hover:bg-gray-100"
                  >
                    Editar
                  </button>
                  <button
                    @click="toggleStatus(employee)"
                    :class="[
                      'rounded px-3 py-1 text-sm transition',
                      employee.is_active
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-green-600 hover:bg-green-50',
                    ]"
                  >
                    {{ employee.is_active ? "Desativar" : "Ativar" }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Modal -->
        <div
          v-if="showModal"
          ref="modalRef"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-modal-title"
          @click.self="closeModal"
          @keydown="handleModalKeydown"
        >
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <!-- Cabeçalho -->
            <div class="mb-4 flex items-center justify-between">
              <h2 id="employee-modal-title" class="text-xl font-bold text-gray-900">
                {{ isEditMode ? "Editar Funcionário" : "Novo Funcionário" }}
              </h2>
              <button
                type="button"
                @click="closeModal"
                class="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar modal"
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

            <div v-if="formErrors.submit" class="mb-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
              {{ formErrors.submit }}
            </div>

            <form @submit.prevent="submitForm" class="space-y-4">
              <!-- Nome -->
              <div>
                <label for="name" class="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
                <input
                  id="name"
                  v-model="formData.name"
                  type="text"
                  maxlength="50"
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div v-if="formErrors.name" class="mt-1 text-xs text-danger">
                  {{ formErrors.name[0] }}
                </div>
              </div>

              <!-- Usuário -->
              <div>
                <label for="username" class="mb-1 block text-sm font-medium text-gray-700">Usuário *</label>
                <input
                  id="username"
                  v-model="formData.username"
                  type="text"
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div v-if="formErrors.username" class="mt-1 text-xs text-danger">
                  {{ formErrors.username[0] }}
                </div>
              </div>

              <!-- Senha -->
              <div v-if="!isEditMode">
                <label for="password" class="mb-1 block text-sm font-medium text-gray-700">
                  Senha (6 dígitos) *
                </label>
                <input
                  id="password"
                  v-model="formData.password"
                  type="password"
                  maxlength="6"
                  inputmode="numeric"
                  placeholder="000000"
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div v-if="formErrors.password" class="mt-1 text-xs text-danger">
                  {{ formErrors.password[0] }}
                </div>
              </div>

              <!-- Confirmar Senha -->
              <div v-if="!isEditMode">
                <label for="confirmPassword" class="mb-1 block text-sm font-medium text-gray-700">
                  Confirmar Senha *
                </label>
                <input
                  id="confirmPassword"
                  v-model="formData.confirmPassword"
                  type="password"
                  maxlength="6"
                  inputmode="numeric"
                  placeholder="000000"
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div v-if="formErrors.confirmPassword" class="mt-1 text-xs text-danger">
                  {{ formErrors.confirmPassword[0] }}
                </div>
              </div>

              <!-- Cargo -->
              <div>
                <label for="role" class="mb-1 block text-sm font-medium text-gray-700">Cargo *</label>
                <select
                  id="role"
                  v-model="formData.role"
                  class="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <div v-if="formErrors.role" class="mt-1 text-xs text-danger">
                  {{ formErrors.role[0] }}
                </div>
              </div>

              <div v-if="canManageCostVisibility" class="flex items-center gap-2">
                <input
                  id="can_view_cost_price"
                  v-model="formData.can_view_cost_price"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
                />
                <label for="can_view_cost_price" class="text-sm font-medium text-gray-700">
                  Permitir visualizar preço de custo
                </label>
              </div>

              <!-- Situação -->
              <div class="flex items-center gap-2">
                <input
                  id="is_active"
                  v-model="formData.is_active"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
                />
                <label for="is_active" class="text-sm font-medium text-gray-700">Ativo</label>
              </div>

              <!-- Botões -->
              <div class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  @click="closeModal"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="loading"
                  class="flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    v-if="loading"
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
                  <span>{{ loading ? "Salvando..." : isEditMode ? "Atualizar" : "Cadastrar" }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Toast de Sucesso -->
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
