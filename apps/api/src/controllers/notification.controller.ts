import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { NotificationService } from "../services/notification.service.js";
import type { NotificationQueryParams } from "../repositories/notification.repository.js";

const notificationService = new NotificationService();

const notificationListQuerySchema = z.object({
  severity: z.enum(["critical", "high", "medium", "info"]).optional(),
  read: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => {
      if (value === true || value === "true") {
        return true;
      }

      if (value === false || value === "false") {
        return false;
      }

      return undefined;
    })
    .optional(),
  search: z.string().max(100).optional(),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

const notificationExportQuerySchema = z.object({
  severity: z.enum(["critical", "high", "medium", "info"]).optional(),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
});

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryResult = notificationListQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          message: "Parâmetros de consulta inválidos",
          errors: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const query = queryResult.data;

      const params: NotificationQueryParams = {
        page: query.page,
        per_page: query.per_page,
        severity: query.severity,
        user_role: req.user?.role,
        read: query.read,
        search: query.search,
        from_date: query.from_date,
        to_date: query.to_date,
      };

      const result = await notificationService.list(params);

      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notification = await notificationService.markAsRead(req.params.id as string);
      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  async acknowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.sub as string;
      const notification = await notificationService.acknowledge(req.params.id as string, userId);
      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAllRead(req.user?.role);
      res.json({ success: true, message: "Todas as notificações foram marcadas como lidas" });
    } catch (error) {
      next(error);
    }
  }

  async deleteRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.deleteRead(req.user?.role);
      res.json({
        success: true,
        message: "Notificações lidas removidas com sucesso",
        data: { deleted_count: result.count },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.getUnreadCount(req.user?.role);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryResult = notificationExportQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          message: "Parâmetros de consulta inválidos",
          errors: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const query = queryResult.data;

      const csv = await notificationService.exportCsv({
        severity: query.severity,
        from_date: query.from_date,
        to_date: query.to_date,
        user_role: req.user?.role,
      });

      const filename = `notificacoes-${new Date().toISOString().split("T")[0]}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}
