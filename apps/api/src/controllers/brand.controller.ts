import type { NextFunction, Request, Response } from "express";
import { BrandService } from "../services/brand.service.js";

const brandService = new BrandService();

export class BrandController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productTypeId =
        typeof req.query.product_type_id === "string"
          ? req.query.product_type_id.trim()
          : undefined;
      const brands = await brandService.list(productTypeId || undefined);
      res.json({ success: true, data: brands });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brand = await brandService.create(req.body);
      res.status(201).json({ success: true, data: brand });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brand = await brandService.update(req.params.id as string, req.body);
      res.json({ success: true, data: brand });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await brandService.deactivate(req.params.id as string);
      res.json({ success: true, message: "Marca desativada" });
    } catch (error) {
      next(error);
    }
  }
}