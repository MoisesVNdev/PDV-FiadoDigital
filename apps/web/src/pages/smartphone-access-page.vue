<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import { useToast } from "@/composables/use-toast.js";

const { showToast, toastMessage, toastType, toast } = useToast();

const loading = ref(true);
const fetchError = ref<string | null>(null);
const accessUrl = ref<string | null>(null);
const qrDataUrl = ref<string | null>(null);

async function generateQR(url: string) {
  try {
    qrDataUrl.value = await QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
    });
  } catch {
    fetchError.value = "Erro ao gerar o QR Code de acesso.";
  }
}

watch(accessUrl, async (newUrl: string | null) => {
  if (newUrl) {
    await generateQR(newUrl);
  }
});

async function loadAccessInfo(): Promise<void> {
  loading.value = true;
  fetchError.value = null;
  try {
    let { hostname } = window.location;
    const { port, protocol } = window.location;
    const resolvedPort = port || (protocol === "https:" ? "443" : "80");

    // Se o usuário estiver acessando via localhost no PC, tenta buscar o IP real da rede via API
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      try {
        const response = await fetch("/api/network/ip");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.ip) {
            hostname = data.ip; // Substitui 'localhost' pelo IP retornado (ex: 192.168.1.95)
          }
        }
      } catch (err) {
        console.warn("Não foi possível detectar o IP local automaticamente.", err);
      }
    }

    const url = `${protocol}//${hostname}:${resolvedPort}`;
    accessUrl.value = url;
    
    // O watcher criado anteriormente já cuidará de gerar o QR Code quando accessUrl mudar
  } catch {
    fetchError.value = "Erro ao carregar informações de rede.";
  } finally {
    loading.value = false;
  }
}

async function copyToClipboard(): Promise<void> {
  if (!accessUrl.value) return;
  try {
    await navigator.clipboard.writeText(accessUrl.value);
    toast("Endereço copiado para a área de transferência!", "success");
  } catch {
    toast("Não foi possível copiar o endereço.", "error");
  }
}

onMounted(loadAccessInfo);
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex flex-1 flex-col items-center justify-start p-6">

        <!-- Skeleton de carregamento -->
        <div v-if="loading" class="mt-10 flex flex-col items-center gap-4">
          <div class="skeleton h-[280px] w-[280px] rounded-2xl" aria-hidden="true"></div>
          <div class="skeleton h-6 w-64 rounded" aria-hidden="true"></div>
        </div>

        <!-- Erro -->
        <div
          v-else-if="fetchError"
          role="alert"
          class="mt-10 max-w-md rounded-xl border border-danger/30 bg-danger/10 px-6 py-4 text-center text-sm text-danger"
        >
          {{ fetchError }}
          <button
            type="button"
            class="mt-3 block w-full rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            @click="loadAccessInfo"
          >
            Tentar novamente
          </button>
        </div>

        <!-- Conteúdo principal -->
        <div v-else class="mt-6 flex w-full max-w-sm flex-col items-center gap-6">

          <div class="rounded-2xl bg-white p-5 shadow-md ring-1 ring-gray-200">
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              alt="QR Code de acesso ao PDV"
              class="h-[280px] w-[280px] rounded-lg"
            />
          </div>

          <div class="flex w-full flex-col gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-center shadow-sm">
            <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Endereço de Acesso
            </p>
            <input
              type="text"
              v-model="accessUrl"
              class="w-full rounded-lg border border-gray-300 p-3 text-center text-lg font-medium text-gray-800 transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: http://192.168.1.95:5173"
            />

            <!-- Aviso de IP Docker/Localhost -->
            <div
              v-if="accessUrl?.includes('localhost') || accessUrl?.includes('172.') || accessUrl?.includes('10.') || accessUrl?.includes('127.')"
              class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left shadow-sm"
            >
              <p class="text-xs leading-relaxed text-amber-800">
                <span class="font-bold">Atenção:</span> O endereço atual parece ser interno da máquina (localhost) ou do Docker (172.x). Para acessar pelo smartphone na mesma rede Wi-Fi, substitua o IP acima pelo <strong>Endereço IP local</strong> do seu PC (ex: 192.168.1.95). <br/>Descubra seu IP no terminal com: <code class="rounded bg-amber-100 px-1 font-mono text-amber-900 leading-none">ip auth</code> ou <code class="rounded bg-amber-100 px-1 font-mono text-amber-900 leading-none">ipconfig</code>.
              </p>
            </div>
          </div>

          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-primary-dark active:scale-95"
            @click="copyToClipboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 10h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copiar Endereço
          </button>

          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            @click="loadAccessInfo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>

        </div>
      </main>
    </div>
  </div>

  <!-- Toast -->
  <div
    v-if="showToast"
    :role="toastType === 'error' ? 'alert' : 'status'"
    :aria-live="toastType === 'error' ? 'assertive' : 'polite'"
    aria-atomic="true"
    :class="[
      'fixed bottom-4 right-4 z-50 rounded-lg px-6 py-3 text-white shadow-lg',
      toastType === 'error' ? 'bg-danger' : toastType === 'warning' ? 'bg-warning' : 'bg-success',
    ]"
  >
    {{ toastMessage }}
  </div>
</template>
