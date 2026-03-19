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
      isConnecting: false,
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
    isConnecting: boolean;
  };

  function clearRetryTimeout(): void {
    if (!sharedState.retryTimeout) {
      return;
    }

    clearTimeout(sharedState.retryTimeout);
    sharedState.retryTimeout = null;
  }

  async function requestWsToken(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch("/api/auth/ws-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const wsToken = payload?.data?.ws_token;

      if (typeof wsToken !== "string" || !wsToken.trim()) {
        return null;
      }

      return wsToken;
    } catch {
      return null;
    }
  }

  async function connect(): Promise<void> {
    if (!sharedState.shouldReconnect || sharedState.isConnecting) {
      return;
    }

    if (sharedState.socket && sharedState.socket.readyState === WebSocket.OPEN) {
      return;
    }

    sharedState.isConnecting = true;

    let accessToken = authStore.accessToken;

    if (!accessToken) {
      const restored = await authStore.tryRestoreAuth();

      if (restored) {
        accessToken = authStore.accessToken;
      }
    }

    if (!accessToken) {
      sharedState.isConnected.value = false;
      sharedState.isOnline.value = false;
      sharedState.isConnecting = false;
      scheduleReconnect();
      return;
    }

    const wsToken = await requestWsToken(accessToken);

    if (!wsToken) {
      sharedState.isConnected.value = false;
      sharedState.isOnline.value = false;
      sharedState.isConnecting = false;
      scheduleReconnect();
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?ws_token=${encodeURIComponent(wsToken)}`;

    sharedState.socket = new WebSocket(url);

    sharedState.socket.onopen = () => {
      sharedState.isConnecting = false;
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
      sharedState.isConnecting = false;
      sharedState.isConnected.value = false;
      sharedState.isOnline.value = false;
      sharedState.socket = null;
      scheduleReconnect();
    };

    sharedState.socket.onerror = () => {
      sharedState.isConnecting = false;
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
      void connect();
    }, retryDelay);
  }

  function disconnect(): void {
    sharedState.shouldReconnect = false;
    clearRetryTimeout();
    sharedState.retryCount = 0;
    sharedState.isConnecting = false;
    sharedState.socket?.close();
    sharedState.socket = null;
    sharedState.isConnected.value = false;
    sharedState.isOnline.value = false;
  }

  onMounted(() => {
    sharedState.subscribers += 1;
    sharedState.shouldReconnect = true;
    void connect();
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
