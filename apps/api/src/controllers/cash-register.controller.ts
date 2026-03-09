import type { Request, Response, NextFunction } from "express";
import { CashRegisterService } from "../services/cash-register.service.js";

const cashRegisterService = new CashRegisterService();

export class CashRegisterController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const terminalId =
        typeof req.query.terminal_id === "string"
          ? req.query.terminal_id
          : undefined;
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;

      if (terminalId && status === "open") {
        const register = await cashRegisterService.getCurrent(terminalId);
        const data = register ? [register] : [];
        res.json({ success: true, data });
        return;
      }

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
      const payload = {
        terminal_id: req.body.terminal_id as string,
        opening_balance_cents: Number(req.body.opening_balance_cents),
        operator_id: req.user?.sub as string,
      };

      const register = await cashRegisterService.open(payload);
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
      const payload = {
        cash_register_id: req.body.cash_register_id as string,
        amount_cents: Number(req.body.amount_cents),
        description: (req.body.description as string) || "",
        operator_id: req.user?.sub as string,
      };

      await cashRegisterService.cashOut(payload);
      res.json({ success: true, message: "Sangria registrada" });
    } catch (error) {
      next(error);
    }
  }

  async cashOutById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const payload = {
        cash_register_id: req.params.id as string,
        amount_cents: Number(req.body.amount_cents),
        description: (req.body.description as string) || "",
        operator_id: req.user?.sub as string,
      };

      await cashRegisterService.cashOut(payload);
      res.json({ success: true, message: "Sangria registrada" });
    } catch (error) {
      next(error);
    }
  }

  async cashInById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const payload = {
        cash_register_id: req.params.id as string,
        amount_cents: Number(req.body.amount_cents),
        description: (req.body.description as string) || "Suprimento",
        operator_id: req.user?.sub as string,
      };

      await cashRegisterService.cashIn(payload);
      res.json({ success: true, message: "Suprimento registrado" });
    } catch (error) {
      next(error);
    }
  }
}
