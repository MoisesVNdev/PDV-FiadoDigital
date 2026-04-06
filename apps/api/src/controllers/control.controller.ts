import type { NextFunction, Request, Response } from "express";
import { ControlService } from "../services/control.service.js";
import { dateRangeQuerySchema, stockSummaryQuerySchema } from "../validators/control.validator.js";

const controlService = new ControlService();

export class ControlController {
  async getStockSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = stockSummaryQuerySchema.parse(req.query);
      const data = await controlService.getStockSummary(query);

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getCashSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = dateRangeQuerySchema.parse(req.query);
      const data = await controlService.getCashSummary(query.start_date, query.end_date);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getDiscountSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = dateRangeQuerySchema.parse(req.query);
      const data = await controlService.getDiscountSummary(query.start_date, query.end_date);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getCancellations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = dateRangeQuerySchema.parse(req.query);
      const data = await controlService.getCancellations(query.start_date, query.end_date);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
