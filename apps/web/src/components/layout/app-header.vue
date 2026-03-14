<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "@/stores/auth.store.js";
import { useWebSocket } from "@/composables/use-websocket.js";
import { useLayoutState } from "@/composables/use-layout-state.js";
import { useAuth } from "@/composables/use-auth.js";

const auth = useAuthStore();
const { logout } = useAuth();
const loggingOut = ref(false);
const { isOnline } = useWebSocket();
const { openMobileMenu } = useLayoutState();

async function handleLogout(): Promise<void> {
  loggingOut.value = true;

  try {
    await logout();
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 shadow-sm md:px-6">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 transition hover:bg-gray-50 md:hidden"
        aria-label="Abrir menu de navegação"
        @click="openMobileMenu"
      >
        ☰
      </button>
      <span class="text-lg font-semibold text-primary">PDV FiadoDigital</span>
    </div>

    <div class="flex items-center gap-3 md:gap-4">
      <div
        v-if="!isOnline"
        role="status"
        aria-live="polite"
        class="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-warning md:text-sm"
      >
        <span>⚠️</span>
        <span>Servidor indisponível</span>
      </div>

      <span class="text-sm text-gray-600">
        {{ auth.user?.name }} ({{ auth.user?.role }})
      </span>
      <button
        type="button"
        :disabled="loggingOut"
        class="rounded bg-gray-200 px-3 py-1 text-sm transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
        @click="handleLogout"
      >
        {{ loggingOut ? "Saindo..." : "Sair" }}
      </button>
    </div>
  </header>
</template>
