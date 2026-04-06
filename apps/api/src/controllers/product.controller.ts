import type { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/product.service.js";
import { listProductsQuerySchema } from "../validators/product.validator.js";

const productService = new ProductService();

export class ProductController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listProductsQuerySchema.parse(req.query);

      const result = await productService.list(query);
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
      const product = await productService.getById(req.params.id as string);
      res.json({ success: true, data: product });
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
      const product = await productService.create(req.body);
      res.status(201).json({ success: true, data: product });
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
      const product = await productService.update(
        req.params.id as string,
        req.body,
        req.user?.sub,
      );
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdatePrice(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await productService.bulkUpdatePrice(req.body);
      res.json({ success: true, data: result });
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
      await productService.deactivate(req.params.id as string);
      res.json({ success: true, message: "Produto desativado" });
    } catch (error) {
      next(error);
    }
  }
}
