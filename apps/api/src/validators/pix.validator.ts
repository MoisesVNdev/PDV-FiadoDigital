import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const generateQRCodeSchema = z.object({
  amount_cents: z.number().int().positive(),
  tx_id: z.string().max(25).optional(),
});

const pixStatusParamsSchema = z.object({
  tx_id: z.string().trim().min(4).max(64),
});

const pixWebhookSchema = z.object({
  tx_id: z.string().trim().min(4).max(64),
  status: z.enum(["confirmed", "failed", "expired"]),
  paid_amount_cents: z.number().int().positive().optional(),
  paid_at: z.coerce.date().optional(),
});

export function validateGenerateQRCode(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = generateQRCodeSchema.safeParse(req.body);

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

export function validatePixStatusParams(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = pixStatusParamsSchema.safeParse(req.params);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Parâmetros inválidos",
      errors: result.error.flatten().fieldErrors,
    });
    return;
  }

  req.params = result.data;
  next();
}

export function validatePixWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = pixWebhookSchema.safeParse(req.body);

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
