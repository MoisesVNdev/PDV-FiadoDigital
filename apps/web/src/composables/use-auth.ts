import { useAuthStore } from "@/stores/auth.store.js";
import { useRouter } from "vue-router";

export function useAuth() {
  const auth = useAuthStore();
  const router = useRouter();

  async function login(username: string, password: string): Promise<void> {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message ?? "Erro ao fazer login");
    }

    auth.setAuth(data.data.accessToken, data.data.user);
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    auth.clearAuth();
    router.push({ name: "login" });
  }

  async function refreshToken(): Promise<void> {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      auth.clearAuth();
      router.push({ name: "login" });
      return;
    }

    auth.accessToken = data.data.accessToken;
  }

  return { login, logout, refreshToken };
}
