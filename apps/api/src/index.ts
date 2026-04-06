import { createApp } from "./app.js";
import { assertRequiredSecrets, config } from "./config/index.js";
import { initDatabase } from "./config/database.js";
import { initWebSocket } from "./websocket/index.js";
import { startCustomerDebtCheckJob } from "./jobs/customer-debt-check.job.js";
import { startBackupJob } from "./jobs/backup.job.js";
import { logInfo, logError } from "./utils/logger.js";

async function bootstrap(): Promise<void> {
  assertRequiredSecrets();


  await initDatabase();

  await startCustomerDebtCheckJob();
  
  await startBackupJob();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logInfo("Servidor rodando", { port: config.port, url: `http://localhost:${config.port}` });
    logInfo("Ambiente atual", { environment: config.nodeEnv });
  });

  initWebSocket(server);

  const shutdown = (): void => {
    logInfo("Encerrando servidor...");
    server.close(() => {
      logInfo("Servidor encerrado.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error: unknown) => {
  logError("Falha ao iniciar", error);
  process.exit(1);
});
