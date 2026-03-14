<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useAuth } from "@/composables/use-auth.js";

const route = useRoute();
const { login } = useAuth();

const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function handleLogin(): Promise<void> {
  error.value = "";
  loading.value = true;

  try {
    await login(username.value, password.value);
  } catch (caughtError) {
    if (caughtError instanceof Error && caughtError.message.trim()) {
      error.value = caughtError.message;
      return;
    }

    error.value = "Servidor indisponível. Aguarde o retorno da conexão.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (route.query.logout === "failed") {
    error.value = "Não foi possível concluir o logout no servidor. Você foi desconectado localmente.";
  }
});
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-surface p-4">
    <form
      class="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg"
      @submit.prevent="handleLogin"
    >
      <h1 class="mb-6 text-center text-2xl font-bold text-primary">
        PDV FiadoDigital
      </h1>

      <div v-if="error" class="mb-4 rounded bg-red-100 p-3 text-sm text-danger" role="alert">
        {{ error }}
      </div>

      <label for="username" class="mb-1 block text-sm font-medium text-gray-700">
        Usuário
      </label>
      <input
        id="username"
        v-model="username"
        type="text"
        autocomplete="username"
        required
        class="mb-4 w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
      />

      <label for="password" class="mb-1 block text-sm font-medium text-gray-700">
        Senha
      </label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        class="mb-6 w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
      />

      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded bg-primary py-2 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {{ loading ? "Entrando..." : "Entrar" }}
      </button>
    </form>
  </main>
</template>
