import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const createCustomerSchema = z.object({
  name: z.string().min(2).max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(200).optional(),
  credit_limit_cents: z.number().int().nonnegative(),
});

export function validateCreateCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = createCustomerSchema.safeParse(req.body);

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
