import type { Request, Response, NextFunction } from "express";
import { CustomerService } from "../services/customer.service.js";

const customerService = new CustomerService();

export class CustomerController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const customers = await customerService.list(search);
      res.json({ success: true, data: customers });
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
}
