import type { Request, Response, NextFunction } from "express";
import { CashRegisterService } from "../services/cash-register.service.js";

const cashRegisterService = new CashRegisterService();

export class CashRegisterController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registers = await cashRegisterService.list();
      res.json({ success: true, data: registers });
    } catch (error) {
      next(error);
    }
  }

  async getCurrent(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const register = await cashRegisterService.getCurrent(
        req.query.terminal_id as string,
      );
      res.json({ success: true, data: register });
    } catch (error) {
      next(error);
    }
  }

  async open(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const register = await cashRegisterService.open(req.body);
      res.status(201).json({ success: true, data: register });
    } catch (error) {
      next(error);
    }
  }

  async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const register = await cashRegisterService.close(req.body);
      res.json({ success: true, data: register });
    } catch (error) {
      next(error);
    }
  }

  async cashOut(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await cashRegisterService.cashOut(req.body);
      res.json({ success: true, message: "Sangria registrada" });
    } catch (error) {
      next(error);
    }
  }
}
