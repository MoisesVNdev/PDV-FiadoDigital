import { prisma } from "../config/database.js";
import type { Prisma } from "@prisma/client";
import type { CreateNotificationPayload } from "@pdv/shared";

export interface NotificationQueryParams {
  severity?: string;
  read?: boolean;
  search?: string;
  from_date?: Date;
  to_date?: Date;
  user_role?: string;
  page: number;
  per_page: number;
}

export interface NotificationExportParams {
  severity?: string;
  from_date?: Date;
  to_date?: Date;
  user_role?: string;
}

export interface NotificationDedupParams {
  type: string;
  customer_id: string;
}

export interface NotificationCleanupResult {
  scanned: number;
  duplicated: number;
  updated: number;
}

export class NotificationRepository {
  async create(payload: Omit<CreateNotificationPayload, "target_roles"> & { target_roles: string }) {
    return prisma.notification.create({
      data: {
        type: payload.type,
        severity: payload.severity,
        title: payload.title,
        message: payload.message,
        meta: payload.meta ?? null,
        target_roles: payload.target_roles,
      },
    });
  }

  async findAll(params: NotificationQueryParams) {
    const where: Prisma.NotificationWhereInput = {
      ...(params.user_role ? { target_roles: { contains: `"${params.user_role}"` } } : {}),
      ...(params.severity ? { severity: params.severity } : {}),
      ...(params.read === true ? { read_at: { not: null } } : {}),
      ...(params.read === false ? { read_at: null } : {}),
      ...(params.search
        ? { OR: [{ title: { contains: params.search } }, { message: { contains: params.search } }] }
        : {}),
      ...(params.from_date || params.to_date
        ? {
            created_at: {
              ...(params.from_date ? { gte: params.from_date } : {}),
              ...(params.to_date ? { lte: params.to_date } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: params.per_page,
        skip: (params.page - 1) * params.per_page,
      }),
    ]);

    return {
      data,
      pagination: {
        page: params.page,
        per_page: params.per_page,
        total,
        total_pages: Math.ceil(total / params.per_page),
      },
    };
  }

  async findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  }

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { read_at: new Date() },
    });
  }

  async markAllRead(userRole?: string) {
    return prisma.notification.updateMany({
      where: {
        read_at: null,
        ...(userRole ? { target_roles: { contains: `"${userRole}"` } } : {}),
      },
      data: { read_at: new Date() },
    });
  }

  async deleteRead(userRole?: string) {
    return prisma.notification.deleteMany({
      where: {
        read_at: { not: null },
        ...(userRole ? { target_roles: { contains: `"${userRole}"` } } : {}),
      },
    });
  }

  async acknowledge(id: string, userId: string) {
    return prisma.notification.update({
      where: { id },
      data: { acknowledged_by: userId },
    });
  }

  async countUnread(userRole?: string) {
    return prisma.notification.count({
      where: {
        read_at: null,
        ...(userRole ? { target_roles: { contains: `"${userRole}"` } } : {}),
      },
    });
  }

  async findForExport(params: NotificationExportParams) {
    return prisma.notification.findMany({
      where: {
        ...(params.user_role ? { target_roles: { contains: `"${params.user_role}"` } } : {}),
        ...(params.severity ? { severity: params.severity } : {}),
        ...(params.from_date || params.to_date
          ? {
              created_at: {
                ...(params.from_date ? { gte: params.from_date } : {}),
                ...(params.to_date ? { lte: params.to_date } : {}),
              },
            }
          : {}),
      },
      orderBy: { created_at: "desc" },
    });
  }

  async existsUnreadByTypeAndCustomer(params: NotificationDedupParams): Promise<boolean> {
    const count = await prisma.notification.count({
      where: {
        type: params.type,
        read_at: null,
        meta: {
          contains: `"customerId":"${params.customer_id}"`,
        },
      },
    });

    return count > 0;
  }

  async existsByTypeAndCustomerOnDate(
    params: NotificationDedupParams,
    date: Date,
  ): Promise<boolean> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await prisma.notification.count({
      where: {
        type: params.type,
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
        meta: {
          contains: `"customerId":"${params.customer_id}"`,
        },
      },
    });

    return count > 0;
  }

  async markOldUnreadDuplicatesAsReadByCustomerAndType(
    types?: readonly string[],
  ): Promise<NotificationCleanupResult> {
    const unread = await prisma.notification.findMany({
      where: {
        read_at: null,
        meta: { not: null },
        ...(types && types.length > 0 ? { type: { in: [...types] } } : {}),
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        meta: true,
      },
    });

    const seen = new Set<string>();
    const toMarkAsRead: string[] = [];

    for (const notification of unread) {
      const customerId = this.extractCustomerIdFromMeta(notification.meta);

      if (!customerId) {
        continue;
      }

      const dedupKey = `${notification.type}::${customerId}`;

      if (seen.has(dedupKey)) {
        toMarkAsRead.push(notification.id);
        continue;
      }

      seen.add(dedupKey);
    }

    if (toMarkAsRead.length === 0) {
      return {
        scanned: unread.length,
        duplicated: 0,
        updated: 0,
      };
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: toMarkAsRead },
        read_at: null,
      },
      data: {
        read_at: new Date(),
      },
    });

    return {
      scanned: unread.length,
      duplicated: toMarkAsRead.length,
      updated: result.count,
    };
  }

  private extractCustomerIdFromMeta(meta: string | null): string | null {
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
