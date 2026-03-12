import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const cardMachineRateSchema = z.object({
  debit_rate: z.number().min(0).max(100),
  credit_base_rate: z.number().min(0).max(100),
  credit_incremental_rate: z.number().min(0).max(100),
  max_installments: z.number().int().min(1).max(12),
});

const cardMachineBaseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  is_active: z.boolean(),
  absorb_fee: z.boolean(),
  rates: cardMachineRateSchema,
});

const createCardMachineSchema = cardMachineBaseSchema;
const updateCardMachineSchema = cardMachineBaseSchema.partial();

export function validateCreateCardMachine(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = createCardMachineSchema.safeParse(req.body);

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

export function validateUpdateCardMachine(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = updateCardMachineSchema.safeParse(req.body);

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
