import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "@pdv/shared";

export const useAuthStore = defineStore("auth", () => {
  const accessToken = ref<string | null>(null);
  const user = ref<User | null>(null);
  const isRestoringSession = ref(false);

  const isAuthenticated = computed(() => !!accessToken.value);

  function setAuth(token: string, userData: User): void {
    accessToken.value = token;
    user.value = userData;
  }

  function clearAuth(): void {
    accessToken.value = null;
    user.value = null;
  }

  async function tryRestoreAuth(): Promise<boolean> {
    if (isRestoringSession.value) {
      return false;
    }

    isRestoringSession.value = true;

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        clearAuth();
        return false;
      }

      const data = await response.json();
      
      if (data.data?.accessToken && data.data?.user) {
        setAuth(data.data.accessToken, data.data.user);
        return true;
      }

      clearAuth();
      return false;
    } catch {
      clearAuth();
      return false;
    } finally {
      isRestoringSession.value = false;
    }
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    isRestoringSession,
    setAuth,
    clearAuth,
    tryRestoreAuth,
  };
});
