import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { PAYMENT_METHODS } from "@pdv/shared";

const listSalesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
    from_date: z.coerce.date().optional(),
    to_date: z.coerce.date().optional(),
    status: z.enum(["completed", "cancelled", "refunded"]).optional(),
    terminal_id: z.string().uuid().optional(),
    operator_id: z.string().uuid().optional(),
  })
  .refine(
    (value) => !value.from_date || !value.to_date || value.from_date <= value.to_date,
    {
      message: "from_date deve ser menor ou igual a to_date.",
      path: ["from_date"],
    },
  );

export function validateListSales(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = listSalesQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Dados inválidos",
      errors: result.error.flatten().fieldErrors,
    });
    return;
  }

  req.query = result.data as unknown as Request["query"];
  next();
}

const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price_cents: z.number().int().positive(),
  discount_cents: z
    .number()
    .int()
    .nonnegative()
    .max(99, "Desconto de troco não pode exceder R$ 0,99."),
  is_bulk: z.boolean().optional(),
});

const salePaymentSchema = z.object({
  method: z.enum([
    PAYMENT_METHODS.CASH,
    PAYMENT_METHODS.PIX,
    PAYMENT_METHODS.CREDIT_CARD,
    PAYMENT_METHODS.DEBIT_CARD,
    PAYMENT_METHODS.FIADO,
  ]),
  amount_cents: z.number().int().positive(),
  installments: z.number().int().min(1).max(12).optional(),
  applied_rate: z.number().min(0).max(100).optional(),
});

const createSaleSchema = z.object({
  uuid: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  terminal_id: z.string().min(1).max(50),
  payment_method: z.enum([
    PAYMENT_METHODS.CASH,
    PAYMENT_METHODS.PIX,
    PAYMENT_METHODS.CREDIT_CARD,
    PAYMENT_METHODS.DEBIT_CARD,
    PAYMENT_METHODS.FIADO,
    PAYMENT_METHODS.MIXED,
  ]),
  discount_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().positive().optional(),
  payments: z.array(salePaymentSchema).min(1),
  items: z.array(saleItemSchema).min(1),
});

export function validateCreateSale(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = createSaleSchema.safeParse(req.body);

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

const cancelSaleSchema = z.object({
  manager_pin: z.string().min(4, "PIN de gerente obrigatório.").max(8),
});

const refundSaleSchema = z.object({
  manager_pin: z.string().min(4, "PIN de gerente obrigatório.").max(8),
});

export function validateCancelSale(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = cancelSaleSchema.safeParse(req.body);

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

export function validateRefundSale(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = refundSaleSchema.safeParse(req.body);

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
