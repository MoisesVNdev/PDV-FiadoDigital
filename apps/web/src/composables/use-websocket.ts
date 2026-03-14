import { ref, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth.store.js";

type WsMessage = {
  type: string;
  payload: unknown;
};

export function useWebSocket() {
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 30000;

  const authStore = useAuthStore();

  if (!(globalThis as Record<string, unknown>).__pdvWsState) {
    (globalThis as Record<string, unknown>).__pdvWsState = {
      isConnected: ref(false),
      isOnline: ref(false),
      connectionWarning: ref<string | null>(null),
      lastMessage: ref<WsMessage | null>(null),
      socket: null as WebSocket | null,
      retryTimeout: null as ReturnType<typeof setTimeout> | null,
      retryCount: 0,
      shouldReconnect: true,
      subscribers: 0,
    };
  }

  const sharedState = (globalThis as Record<string, unknown>).__pdvWsState as {
    isConnected: ReturnType<typeof ref<boolean>>;
    isOnline: ReturnType<typeof ref<boolean>>;
    connectionWarning: ReturnType<typeof ref<string | null>>;
    lastMessage: ReturnType<typeof ref<WsMessage | null>>;
    socket: WebSocket | null;
    retryTimeout: ReturnType<typeof setTimeout> | null;
    retryCount: number;
    shouldReconnect: boolean;
    subscribers: number;
  };

  function clearRetryTimeout(): void {
    if (!sharedState.retryTimeout) {
      return;
    }

    clearTimeout(sharedState.retryTimeout);
    sharedState.retryTimeout = null;
  }

  function connect(): void {
    if (!sharedState.shouldReconnect) {
      return;
    }

    const token = authStore.accessToken;

    if (!token) {
      sharedState.isConnected.value = false;
      sharedState.isOnline.value = false;
      scheduleReconnect();
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    sharedState.socket = new WebSocket(url);

    sharedState.socket.onopen = () => {
      sharedState.isConnected.value = true;
      sharedState.isOnline.value = true;
      sharedState.connectionWarning.value = null;
      sharedState.retryCount = 0;
      clearRetryTimeout();
    };

    sharedState.socket.onmessage = (event: MessageEvent) => {
      try {
        sharedState.lastMessage.value = JSON.parse(event.data as string) as WsMessage;
      } catch {
        // Ignora mensagens mal formatadas
      }
    };

    sharedState.socket.onclose = () => {
      sharedState.isConnected.value = false;
      sharedState.isOnline.value = false;
      scheduleReconnect();
    };

    sharedState.socket.onerror = () => {
      sharedState.isOnline.value = false;
      sharedState.socket?.close();
    };
  }

  function scheduleReconnect(): void {
    if (!sharedState.shouldReconnect || sharedState.retryTimeout) {
      return;
    }

    if (sharedState.retryCount >= MAX_RETRIES) {
      sharedState.connectionWarning.value = "Conexão com o servidor perdida. Verifique a rede.";
      sharedState.isOnline.value = false;
      return;
    }

    const exponentialDelay = Math.min(BASE_DELAY_MS * (2 ** sharedState.retryCount), MAX_DELAY_MS);
    const jitter = Math.floor(Math.random() * 1000);
    const retryDelay = exponentialDelay + jitter;

    sharedState.retryCount += 1;

    sharedState.retryTimeout = setTimeout(() => {
      sharedState.retryTimeout = null;
      connect();
    }, retryDelay);
  }

  function disconnect(): void {
    sharedState.shouldReconnect = false;
    clearRetryTimeout();
    sharedState.retryCount = 0;
    sharedState.socket?.close();
    sharedState.socket = null;
    sharedState.isConnected.value = false;
    sharedState.isOnline.value = false;
  }

  onMounted(() => {
    sharedState.subscribers += 1;
    sharedState.shouldReconnect = true;
    connect();
  });

  onUnmounted(() => {
    sharedState.subscribers = Math.max(0, sharedState.subscribers - 1);

    if (sharedState.subscribers > 0) {
      return;
    }

    disconnect();
  });

  return {
    isConnected: sharedState.isConnected,
    isOnline: sharedState.isOnline,
    connectionWarning: sharedState.connectionWarning,
    lastMessage: sharedState.lastMessage,
  };
}
