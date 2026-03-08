import { ref, onMounted, onUnmounted } from "vue";

type WsMessage = {
  type: string;
  payload: unknown;
};

export function useWebSocket() {
  const isConnected = ref(false);
  const lastMessage = ref<WsMessage | null>(null);
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

    socket = new WebSocket(url);

    socket.onopen = () => {
      isConnected.value = true;
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        lastMessage.value = JSON.parse(event.data as string) as WsMessage;
      } catch {
        // Ignora mensagens mal formatadas
      }
    };

    socket.onclose = () => {
      isConnected.value = false;
      scheduleReconnect();
    };

    socket.onerror = () => {
      socket?.close();
    };
  }

  function scheduleReconnect(): void {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 3000);
  }

  function disconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket?.close();
    socket = null;
  }

  onMounted(connect);
  onUnmounted(disconnect);

  return { isConnected, lastMessage };
}
