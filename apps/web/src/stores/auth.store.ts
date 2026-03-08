import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "@pdv/shared";

export const useAuthStore = defineStore("auth", () => {
  const accessToken = ref<string | null>(null);
  const user = ref<User | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value);

  function setAuth(token: string, userData: User): void {
    accessToken.value = token;
    user.value = userData;
  }

  function clearAuth(): void {
    accessToken.value = null;
    user.value = null;
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    setAuth,
    clearAuth,
  };
});
