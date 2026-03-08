import type { Request, Response, NextFunction } from "express";
import { SaleService } from "../services/sale.service.js";

const saleService = new SaleService();

export class SaleController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sales = await saleService.list();
      res.json({ success: true, data: sales });
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
      await saleService.cancel(req.params.id as string);
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
      await saleService.refund(req.params.id as string);
      res.json({ success: true, message: "Estorno realizado" });
    } catch (error) {
      next(error);
    }
  }
}
