import { z } from "zod";
import type { NextFunction, Request, Response } from "express";

const productTypeBaseSchema = z.object({
  name: z.string().min(1).max(50),
  profit_margin: z.number().min(0).max(99).optional().nullable(),
});

const createProductTypeSchema = productTypeBaseSchema;
const updateProductTypeSchema = productTypeBaseSchema.partial();

export function validateCreateProductType(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = createProductTypeSchema.safeParse(req.body);

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

export function validateUpdateProductType(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = updateProductTypeSchema.safeParse(req.body);

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
