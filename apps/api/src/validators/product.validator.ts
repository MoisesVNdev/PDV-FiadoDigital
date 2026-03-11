import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const weightUnitSchema = z.enum(["kg", "g", "L", "ml", "un"]);

const productBaseSchema = z.object({
  name: z.string().min(2).max(100),
  brand_id: z.string().uuid().optional(),
  barcode: z
    .string()
    .regex(/^(\d{8}|\d{13})$/, "Código de barras deve conter 8 ou 13 dígitos numéricos")
    .optional(),
  description: z.string().max(255).optional(),
  weight_value: z.number().nonnegative().optional(),
  weight_unit: weightUnitSchema.optional(),
  product_type_id: z.string().uuid().optional(),
  profit_margin: z.number().gt(0).lt(1).optional(),
  price_cents: z.number().int().positive().optional(),
  cost_price_cents: z.number().int().nonnegative(),
  stock_quantity: z.number().nonnegative(),
  min_stock_alert: z.number().int().nonnegative(),
  is_bulk: z.boolean().optional().default(false),
  is_active: z.boolean().optional(),
});

const createProductSchema = productBaseSchema.superRefine((value, ctx) => {
  if (typeof value.weight_value === "number" && !value.weight_unit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weight_unit"],
      message: "Unidade de gramagem é obrigatória quando o valor é informado",
    });
  }

  if (value.weight_unit === "un" && typeof value.weight_value === "number" && !Number.isInteger(value.weight_value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weight_value"],
      message: "Quando unidade for 'un', o valor deve ser inteiro positivo",
    });
  }

  if (value.weight_unit === "un" && typeof value.weight_value === "number" && value.weight_value < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weight_value"],
      message: "Quando unidade for 'un', o valor deve ser inteiro não-negativo",
    });
  }

  if (value.weight_unit !== "un" && typeof value.weight_value === "number" && value.weight_value <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weight_value"],
      message: "Gramagem deve ser um número positivo",
    });
  }
});

const updateProductSchema = productBaseSchema.partial().superRefine((value, ctx) => {
  if (typeof value.weight_value === "number" && !value.weight_unit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weight_unit"],
      message: "Unidade de gramagem é obrigatória quando o valor é informado",
    });
  }

  if (value.weight_unit === "un" && typeof value.weight_value === "number" && !Number.isInteger(value.weight_value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weight_value"],
      message: "Quando unidade for 'un', o valor deve ser inteiro positivo",
    });
  }

  if (value.weight_unit === "un" && typeof value.weight_value === "number" && value.weight_value < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weight_value"],
      message: "Quando unidade for 'un', o valor deve ser inteiro não-negativo",
    });
  }

  if (value.weight_unit !== "un" && typeof value.weight_value === "number" && value.weight_value <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weight_value"],
      message: "Gramagem deve ser um número positivo",
    });
  }
});

const bulkUpdatePriceSchema = z.object({
  product_type_id: z.string().uuid(),
  brand_id: z.string().uuid().optional(),
  profit_margin_percentage: z.number().int().min(1).max(99),
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

export function validateUpdateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = updateProductSchema.safeParse(req.body);

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

export function validateBulkUpdatePrice(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = bulkUpdatePriceSchema.safeParse(req.body);

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
