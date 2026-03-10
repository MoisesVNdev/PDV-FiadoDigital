import type { Request, Response, NextFunction } from "express";
import { CustomerService } from "../services/customer.service.js";

const customerService = new CustomerService();

export class CustomerController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const onlyActive = req.query.only_active === "true";
      const page = typeof req.query.page === "string" ? Number.parseInt(req.query.page, 10) : 1;
      const perPage = typeof req.query.per_page === "string" ? Number.parseInt(req.query.per_page, 10) : 10;
      const sortBy = (typeof req.query.sort_by === "string" ? req.query.sort_by : "name") as any;
      const sortOrder = (typeof req.query.sort_order === "string" ? req.query.sort_order : "asc") as any;

      const result = await customerService.list({
        search,
        onlyActive,
        page,
        perPage,
        sortBy,
        sortOrder,
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
