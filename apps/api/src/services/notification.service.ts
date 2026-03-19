import {
  NotificationRepository,
  type NotificationQueryParams,
  type NotificationExportParams,
} from "../repositories/notification.repository.js";
import { broadcast } from "../websocket/index.js";
import type { CreateNotificationPayload } from "@pdv/shared";

const notificationRepository = new NotificationRepository();

export class NotificationService {
  async create(payload: CreateNotificationPayload) {
    const notification = await notificationRepository.create({
      ...payload,
      target_roles: JSON.stringify(payload.target_roles),
    });

    broadcast({ type: "notification.new", payload: notification });

    return notification;
  }

  async createFiadoNotificationOncePerDay(payload: CreateNotificationPayload) {
    const customerId = this.extractCustomerId(payload.meta);

    if (!customerId) {
      return this.create(payload);
    }

    const dedupParams = {
      type: payload.type,
      customer_id: customerId,
    };

    const [hasUnreadOpen, alreadyCreatedToday] = await Promise.all([
      notificationRepository.existsUnreadByTypeAndCustomer(dedupParams),
      notificationRepository.existsByTypeAndCustomerOnDate(dedupParams, new Date()),
    ]);

    if (hasUnreadOpen || alreadyCreatedToday) {
      return null;
    }

    return this.create(payload);
  }

  async list(params: NotificationQueryParams) {
    return notificationRepository.findAll(params);
  }

  async markAsRead(id: string) {
    const notification = await notificationRepository.findById(id);

    if (!notification) {
      throw new Error("Notificação não encontrada");
    }

    return notificationRepository.markAsRead(id);
  }

  async markAllRead(userRole?: string) {
    return notificationRepository.markAllRead(userRole);
  }

  async deleteRead(userRole?: string) {
    return notificationRepository.deleteRead(userRole);
  }

  async acknowledge(id: string, userId: string) {
    const notification = await notificationRepository.findById(id);

    if (!notification) {
      throw new Error("Notificação não encontrada");
    }

    return notificationRepository.acknowledge(id, userId);
  }

  async getUnreadCount(userRole?: string) {
    const count = await notificationRepository.countUnread(userRole);
    return { count };
  }

  async exportCsv(params: NotificationExportParams): Promise<string> {
    const notifications = await notificationRepository.findForExport(params);

    const header = "id,type,severity,title,message,created_at,read_at,acknowledged_by\n";
    const rows = notifications
      .map((n) =>
        [
          n.id,
          n.type,
          n.severity,
          `"${n.title.replace(/"/g, '""')}"`,
          `"${n.message.replace(/"/g, '""')}"`,
          n.created_at.toISOString(),
          n.read_at?.toISOString() ?? "",
          n.acknowledged_by ?? "",
        ].join(","),
      )
      .join("\n");

    return header + rows;
  }

  async cleanupUnreadDuplicatesByCustomerAndType(types?: readonly string[]) {
    return notificationRepository.markOldUnreadDuplicatesAsReadByCustomerAndType(types);
  }

  private extractCustomerId(meta: string | undefined): string | null {
    if (!meta) {
      return null;
    }

    try {
      const parsed = JSON.parse(meta) as { customerId?: unknown };

      if (typeof parsed.customerId !== "string" || !parsed.customerId.trim()) {
        return null;
      }

      return parsed.customerId;
    } catch {
      return null;
    }
  }
}
