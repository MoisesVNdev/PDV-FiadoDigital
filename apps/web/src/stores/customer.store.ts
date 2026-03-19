import { defineStore } from "pinia";
import { ref } from "vue";

type AuthenticatedFetch = (url: string, options?: RequestInit) => Promise<Response>;

type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  credit_limit_cents: number;
  current_debt_cents: number;
  payment_due_day: number | null;
  is_active: boolean;
};

export const useCustomerStore = defineStore("customer", () => {
  const customers = ref<CustomerListItem[]>([]);
  const lastFetchedAt = ref<Date | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const CACHE_TTL_MS = 60_000;

  async function fetchIfStale(authenticatedFetch: AuthenticatedFetch, force = false): Promise<void> {
    const now = Date.now();
    const isStale =
      force ||
      !lastFetchedAt.value ||
      now - lastFetchedAt.value.getTime() > CACHE_TTL_MS;

    if (!isStale || loading.value) {
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await authenticatedFetch("/api/customers?only_active=false&page=1&per_page=1000");
      const data = await response.json();

      if (!response.ok) {
        error.value = data.message || "Não foi possível carregar clientes.";
        return;
      }

      customers.value = data.data as CustomerListItem[];
      lastFetchedAt.value = new Date();
    } catch {
      error.value = "Erro de conexão ao carregar clientes.";
    } finally {
      loading.value = false;
    }
  }

  function invalidate(): void {
    lastFetchedAt.value = null;
  }

  return {
    customers,
    loading,
    error,
    fetchIfStale,
    invalidate,
  };
});
