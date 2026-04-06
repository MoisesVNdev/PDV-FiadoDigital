import type { NextFunction, Request, Response } from "express";
import { DashboardService } from "../services/dashboard.service.js";

const dashboardService = new DashboardService();

export class DashboardController {
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = typeof req.query["start_date"] === "string" ? req.query["start_date"] : undefined;
      const endDate = typeof req.query["end_date"] === "string" ? req.query["end_date"] : undefined;

      const data = await dashboardService.getSummary(startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
