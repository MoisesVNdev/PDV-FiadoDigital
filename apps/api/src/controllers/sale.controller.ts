import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { SaleService } from "../services/sale.service.js";

const saleService = new SaleService();

const saleListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  status: z.enum(["completed", "cancelled", "refunded"]).optional(),
  terminal_id: z.string().uuid().optional(),
  operator_id: z.string().uuid().optional(),
});

export class SaleController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryResult = saleListQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          message: "Parâmetros de consulta inválidos",
          errors: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const query = queryResult.data;

      const result = await saleService.list({
        page: query.page,
        per_page: query.per_page,
        from_date: query.from_date,
        to_date: query.to_date,
        status: query.status,
        terminal_id: query.terminal_id,
        operator_id: query.operator_id,
      });

      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const sale = await saleService.getById(req.params.id as string);
      res.json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  }

  async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const sale = await saleService.create(req.body);
      res.status(201).json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  }

  async cancel(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { manager_pin } = req.body as { manager_pin: string };
      const operatorId = req.user?.sub as string;
      await saleService.cancel(req.params.id as string, manager_pin, operatorId);
      res.json({ success: true, message: "Venda cancelada" });
    } catch (error) {
      next(error);
    }
  }

  async refund(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { manager_pin } = req.body as { manager_pin: string };
      const operatorId = req.user?.sub as string;
      await saleService.refund(req.params.id as string, manager_pin, operatorId);
      res.json({ success: true, message: "Estorno realizado" });
    } catch (error) {
      next(error);
    }
  }
}
