import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CashRegisterService } from "../services/cash-register.service.js";

const cashRegisterService = new CashRegisterService();

const listCashRegisterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  terminal_id: z.string().min(1).optional(),
  status: z.enum(["open", "closed"]).optional(),
  operator_id: z.string().uuid().optional(),
});

const currentCashRegisterQuerySchema = z.object({
  terminal_id: z.string().min(1),
});

export class CashRegisterController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryResult = listCashRegisterQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          message: "Parâmetros de consulta inválidos",
          errors: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const query = queryResult.data;
      const terminalId = query.terminal_id;
      const status = query.status;

      if (terminalId && status === "open") {
        const register = await cashRegisterService.getCurrent(terminalId);
        const data = register ? [register] : [];
        res.json({ success: true, data });
        return;
      }

      const statusFilter = query.status && query.status !== "open" ? query.status : undefined;

      const result = await cashRegisterService.list({
        page: query.page,
        per_page: query.per_page,
        from_date: query.from_date,
        to_date: query.to_date,
        status: statusFilter,
        operator_id: query.operator_id,
      });
      res.json({ success: true, data: result.data, pagination: result.pagination });
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
      const queryResult = currentCashRegisterQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          message: "Parâmetros de consulta inválidos",
          errors: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const query = queryResult.data;
      const register = await cashRegisterService.getCurrent(query.terminal_id);
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
      const payload = {
        id: req.body.id as string,
        closing_balance_cents: Number(req.body.closing_balance_cents),
        operator_id: req.user?.sub as string,
      };
      const register = await cashRegisterService.close(payload);
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
