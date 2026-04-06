import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const customerBaseSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(200).optional(),
  credit_limit_cents: z.number().int().nonnegative(),
  payment_due_day: z.number().int().min(1).max(31).optional(),
  is_active: z.boolean().optional(),
});

const createCustomerSchema = customerBaseSchema;
const updateCustomerSchema = customerBaseSchema.partial();

export const listCustomersQuerySchema = z.object({
  search: z.string().optional(),
  only_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(1000).default(10),
  sort_by: z
    .enum(["name", "credit_limit_cents", "current_debt_cents", "payment_due_day", "is_active"])
    .optional(),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(1000).default(10),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(9999).optional(),
});

const payDebtSchema = z.object({
  amount_cents: z.number().int().positive("Valor do pagamento deve ser maior que zero"),
  pin: z.string().regex(/^\d{4,6}$/, "PIN deve conter entre 4 e 6 dígitos numéricos"),
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

export function validateListCustomers(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = listCustomersQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Parâmetros de busca inválidos",
      errors: result.error.flatten().fieldErrors,
    });
    return;
  }

  next();
}

export function validateUpdateCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = updateCustomerSchema.safeParse(req.body);

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

export function validatePayDebt(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = payDebtSchema.safeParse(req.body);

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
