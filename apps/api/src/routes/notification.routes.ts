import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import {
  validateListNotifications,
  validateExportNotifications,
} from "../validators/notification.validator.js";

export const notificationRouter = Router();
const controller = new NotificationController();

notificationRouter.get(
  "/",
  authenticate,
  authorize("admin", "manager", "operator"),
  validateListNotifications,
  controller.list,
);

notificationRouter.get(
  "/unread-count",
  authenticate,
  controller.getUnreadCount,
);

notificationRouter.get(
  "/export",
  authenticate,
  authorize("admin", "manager"),
  validateExportNotifications,
  controller.exportCsv,
);

notificationRouter.patch(
  "/read-all",
  authenticate,
  controller.markAllRead,
);

// Remover notificações já lidas (apenas para administradores/gerentes)
notificationRouter.delete(
  "/read",
  authenticate,
  authorize("admin", "manager"),
  controller.deleteRead,
);

notificationRouter.patch(
  "/:id/read",
  authenticate,
  controller.markAsRead,
);

notificationRouter.patch(
  "/:id/acknowledge",
  authenticate,
  authorize("admin", "manager"),
  controller.acknowledge,
);
