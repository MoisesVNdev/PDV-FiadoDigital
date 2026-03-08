<script setup lang="ts">
import { useAuthStore } from "@/stores/auth.store.js";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

async function handleLogout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  auth.clearAuth();
  router.push({ name: "login" });
}
</script>

<template>
  <header class="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
    <span class="text-lg font-semibold text-primary">PDV FiadoDigital</span>
    <div class="flex items-center gap-4">
      <span class="text-sm text-gray-600">
        {{ auth.user?.name }} ({{ auth.user?.role }})
      </span>
      <button
        type="button"
        class="rounded bg-gray-200 px-3 py-1 text-sm transition hover:bg-gray-300"
        @click="handleLogout"
      >
        Sair
      </button>
    </div>
  </header>
</template>
