import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const loginSchema = z.object({
  username: z
    .string()
    .min(3, "Usuário deve ter no mínimo 3 caracteres")
    .max(50),
  password: z
    .string()
    .min(6, "Senha deve ter no mínimo 6 caracteres")
    .max(128),
});

const validatePinSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{4,6}$/, "PIN deve conter entre 4 e 6 dígitos numéricos"),
});

export function validateBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = loginSchema.safeParse(req.body);

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

export function validatePinBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = validatePinSchema.safeParse(req.body);

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
