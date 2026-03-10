import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { initDatabase } from "./config/database.js";
import { initWebSocket } from "./websocket/index.js";
import { startCustomerDebtCheckJob } from "./jobs/customer-debt-check.job.js";

async function bootstrap(): Promise<void> {
  await initDatabase();

  // Iniciar job de verificação de atraso de cliente
  await startCustomerDebtCheckJob();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(
      `[PDV API] Servidor rodando em http://localhost:${config.port}`,
    );
    console.log(`[PDV API] Ambiente: ${config.nodeEnv}`);
  });

  initWebSocket(server);

  const shutdown = (): void => {
    console.log("[PDV API] Encerrando servidor...");
    server.close(() => {
      console.log("[PDV API] Servidor encerrado.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error: unknown) => {
  console.error("[PDV API] Falha ao iniciar:", error);
  process.exit(1);
});
