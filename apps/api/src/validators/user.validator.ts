import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { ROLES } from "@pdv/shared";

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(128),
  role: z.enum([ROLES.ADMIN, ROLES.MANAGER, ROLES.STOCKIST, ROLES.OPERATOR]),
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
