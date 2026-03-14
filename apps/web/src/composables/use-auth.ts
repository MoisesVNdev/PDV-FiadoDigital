import { useAuthStore } from "@/stores/auth.store.js";
import { useRouter } from "vue-router";
import { ROLES } from "@pdv/shared";
import type { Role } from "@pdv/shared";

function getDefaultRouteByRole(role: Role): string {
  const roleRoutes: Record<Role, string> = {
    [ROLES.ADMIN]: "dashboard",
    [ROLES.MANAGER]: "dashboard",
    [ROLES.STOCKIST]: "products",
    [ROLES.OPERATOR]: "sales",
  };
  return roleRoutes[role] || "dashboard";
}

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

    // Redirecionar ao cargo do usuário
    const defaultRoute = getDefaultRouteByRole(data.data.user.role);
    router.push({ name: defaultRoute });
  }

  async function logout(): Promise<void> {
    let hasRemoteFailure = false;

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        hasRemoteFailure = true;
      }
    } catch {
      hasRemoteFailure = true;
    } finally {
      auth.clearAuth();
      await router.push({
        name: "login",
        ...(hasRemoteFailure ? { query: { logout: "failed" } } : {}),
      });
    }
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

    if (data.data?.accessToken && auth.user) {
      auth.setAuth(data.data.accessToken, auth.user);
    }
  }

  return { login, logout, refreshToken };
}
