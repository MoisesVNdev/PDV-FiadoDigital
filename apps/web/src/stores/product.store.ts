import { defineStore } from "pinia";
import { ref } from "vue";
import type { Product } from "@pdv/shared";

type AuthenticatedFetch = (url: string, options?: RequestInit) => Promise<Response>;

export const useProductStore = defineStore("product", () => {
  const products = ref<Product[]>([]);
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
      const response = await authenticatedFetch("/api/products");
      const data = await response.json();

      if (!response.ok) {
        error.value = data.message || "Não foi possível carregar produtos.";
        return;
      }

      products.value = data.data as Product[];
      lastFetchedAt.value = new Date();
    } catch {
      error.value = "Erro de conexão ao carregar produtos.";
    } finally {
      loading.value = false;
    }
  }

  function invalidate(): void {
    lastFetchedAt.value = null;
  }

  return {
    products,
    loading,
    error,
    fetchIfStale,
    invalidate,
  };
});
