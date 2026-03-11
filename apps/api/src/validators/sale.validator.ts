import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { PAYMENT_METHODS } from "@pdv/shared";

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
