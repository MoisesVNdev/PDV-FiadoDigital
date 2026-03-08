import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "http";

type WsMessage = {
  type: string;
  payload: unknown;
};

const clients = new Set<WebSocket>();

export function initWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(
      `[PDV WS] Cliente conectado. Total: ${clients.size}`,
    );

    ws.on("close", () => {
      clients.delete(ws);
      console.log(
        `[PDV WS] Cliente desconectado. Total: ${clients.size}`,
      );
    });

    ws.on("error", (error) => {
      console.error("[PDV WS] Erro:", error.message);
      clients.delete(ws);
    });
  });

  console.log("[PDV WS] WebSocket inicializado em /ws");
}

export function broadcast(message: WsMessage): void {
  const data = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}
