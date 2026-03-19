import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { ROLES } from "@pdv/shared";

const createUserSchema = z.object({
  name: z.string().min(2).max(50),
  username: z.string().min(3).max(50),
  password: z.string().regex(/^\d{6}$/, "Senha deve conter exatamente 6 dígitos numéricos"),
  role: z.enum([ROLES.ADMIN, ROLES.MANAGER, ROLES.STOCKIST, ROLES.OPERATOR]),
  can_view_cost_price: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

const updateUserSchema = createUserSchema
  .partial()
  .extend({
    password: z
      .string()
      .regex(/^\d{6}$/, "Senha deve conter exatamente 6 dígitos numéricos")
      .optional(),
  });

export function validateCreateUser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = createUserSchema.safeParse(req.body);

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

export function validateUpdateUser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = updateUserSchema.safeParse(req.body);

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
