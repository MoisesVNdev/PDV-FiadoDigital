import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  barcode: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  price_cents: z.number().int().positive(),
  cost_price_cents: z.number().int().nonnegative(),
  stock_quantity: z.number().int().nonnegative(),
  min_stock_alert: z.number().int().nonnegative(),
});

export function validateCreateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = createProductSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Dados inválidos",
      errors: result.error.flatten().fieldErrors,
    });
    return;
  }

  next();
}
