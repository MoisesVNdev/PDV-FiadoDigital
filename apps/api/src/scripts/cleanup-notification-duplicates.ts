import { NOTIFICATION_TYPES } from "@pdv/shared";
import { initDatabase, prisma } from "../config/database.js";
import { NotificationService } from "../services/notification.service.js";

async function run(): Promise<void> {
  await initDatabase();

  const notificationService = new NotificationService();

  const result = await notificationService.cleanupUnreadDuplicatesByCustomerAndType([
    NOTIFICATION_TYPES.FIADO_OVERDUE,
    NOTIFICATION_TYPES.FIADO_DUE_DAY_DEBT_OPEN,
  ]);

  console.log("[NotificationCleanup] Finalizado", result);
}

run()
  .catch((error: unknown) => {
    console.error("[NotificationCleanup] Falha:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
