import { ref, watch, onMounted } from "vue";
import { useWebSocket } from "@/composables/use-websocket.js";
import { useApi } from "@/composables/use-api.js";
import type { CreateSalePayload } from "@pdv/shared";

interface QueuedSale {
  uuid: string;
  payload: CreateSalePayload;
  timestamp: number;
}

const STORAGE_KEY = "pdv-offline-sales-queue";

export function useOfflineQueue() {
  const { isOnline } = useWebSocket();
  const { authenticatedFetch } = useApi();
  
  const queue = ref<QueuedSale[]>([]);
  const isSyncing = ref(false);
  const queueLength = ref(0);

  function loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        queue.value = JSON.parse(stored);
        queueLength.value = queue.value.length;
      }
    } catch (e) {
      console.error("Erro ao carregar fila offline:", e);
      queue.value = [];
    }
  }

  function saveQueue() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.value));
    queueLength.value = queue.value.length;
  }

  function enqueue(payload: CreateSalePayload) {
    const sale: QueuedSale = {
      uuid: payload.uuid || crypto.randomUUID(), // Fallback UUID
      payload,
      timestamp: Date.now(),
    };
    
    queue.value.push(sale);
    saveQueue();
    return sale.uuid;
  }

  async function flushQueue() {
    if (isSyncing.value || queue.value.length === 0 || !isOnline.value) {
      return;
    }

    isSyncing.value = true;

    const remainingSales: QueuedSale[] = [];
    const salesToProcess = [...queue.value];

    for (const sale of salesToProcess) {
      try {
        const response = await authenticatedFetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sale.payload),
        });

        if (response.ok || response.status === 409) {
          // Status 409 indica que o UUID já foi processado (idempotência)
          continue;
        } else {
          // Se for outro erro, mantém na fila para tentar depois
          remainingSales.push(sale);
        }
      } catch (e) {
        console.error(`Falha ao sincronizar venda ${sale.uuid}:`, e);
        remainingSales.push(sale);
      }
    }

    queue.value = remainingSales;
    saveQueue();
    isSyncing.value = false;
  }

  // Monitora volta da conexão para rodar Replay
  watch(isOnline, (online) => {
    if (online && queue.value.length > 0) {
      void flushQueue();
    }
  });

  onMounted(() => {
    loadQueue();
    if (isOnline.value && queue.value.length > 0) {
      void flushQueue();
    }
  });

  return {
    queueLength,
    isSyncing,
    enqueue,
    flushQueue,
  };
}
