import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const createStockAdjustmentSchema = z.object({
  product_id: z.string().uuid("Produto inválido"),
  quantity: z.number().refine((value) => value !== 0, {
    message: "Quantidade de ajuste deve ser diferente de zero",
  }),
  unit_cost_cents: z.number().int().nonnegative(),
  description: z.string().trim().min(3, "Descrição é obrigatória"),
});

export const stockSummaryQuerySchema = z.object({
  product_type_id: z.string().trim().min(1).optional(),
  brand_id: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().default(20),
  sort_by: z.enum(["name", "type", "brand", "stock", "average_cost", "stock_value"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
});

export const dateRangeQuerySchema = z.object({
  start_date: z.string().trim().min(1).optional(),
  end_date: z.string().trim().min(1).optional(),
});

export function validateCreateStockAdjustment(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = createStockAdjustmentSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Dados inválidos",
      errors: result.error.flatten().fieldErrors,
    });
    return;
  }

  req.body = result.data;
  next();
}
