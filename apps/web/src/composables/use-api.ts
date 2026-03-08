import { useAuthStore } from "@/stores/auth.store.js";
import { useRouter } from "vue-router";

export function useApi() {
  const auth = useAuthStore();
  const router = useRouter();

  async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Garantir que temos um token válido
    if (!auth.accessToken) {
      // Tentar restaurar sessão
      const restored = await auth.tryRestoreAuth();
      if (!restored) {
        router.push({ name: "login" });
        throw new Error("Sessão expirada");
      }
    }

    // Adicionar Authorization header
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${auth.accessToken}`);

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    // Se receber 401, tentar refresh uma vez
    if (response.status === 401) {
      const restored = await auth.tryRestoreAuth();
      if (restored) {
        // Retry com novo token
        headers.set("Authorization", `Bearer ${auth.accessToken}`);
        return fetch(url, {
          ...options,
          headers,
          credentials: "include",
        });
      } else {
        auth.clearAuth();
        router.push({ name: "login" });
        throw new Error("Sessão expirada");
      }
    }

    return response;
  }

  return { authenticatedFetch };
}
