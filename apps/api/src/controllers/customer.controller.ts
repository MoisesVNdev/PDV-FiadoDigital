import type { Request, Response, NextFunction } from "express";
import { CustomerService } from "../services/customer.service.js";
import { listCustomersQuerySchema, historyQuerySchema } from "../validators/customer.validator.js";

const customerService = new CustomerService();

export class CustomerController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listCustomersQuerySchema.parse(req.query);

      const result = await customerService.list({
        search: query.search,
        only_active: query.only_active,
        page: query.page,
        per_page: query.per_page,
        sort_by: query.sort_by,
        sort_order: query.sort_order,
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
      const customer = await customerService.getById(req.params.id as string);
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }

  async getFiadoHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.params.id as string;
      const query = historyQuerySchema.parse(req.query);

      const result = await customerService.getFiadoHistory(customerId, query.page, query.per_page, {
        month: query.month,
        year: query.year,
      });
      res.json({ success: true, data: result.data, pagination: result.pagination, summary: result.summary });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.params.id as string;
      const query = historyQuerySchema.parse(req.query);

      const result = await customerService.getPaymentHistory(customerId, query.page, query.per_page, {
        month: query.month,
        year: query.year,
      });

      res.json({ success: true, data: result.data, pagination: result.pagination, summary: result.summary });
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
      const customer = await customerService.create(req.body);
      res.status(201).json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const customer = await customerService.update(req.params.id as string, req.body);
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await customerService.deactivate(req.params.id as string);
      res.json({ success: true, message: "Cliente desativado" });
    } catch (error) {
      next(error);
    }
  }

  async payDebt(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { amount_cents, pin } = req.body;
      const customerId = req.params.id as string;
      const operatorId = req.user?.sub;

      if (!operatorId) {
        res.status(401).json({ success: false, message: "Usuário não autenticado" });
        return;
      }

      const customer = await customerService.payDebt(customerId, amount_cents, pin, operatorId);
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
}
