import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  getPixKeyValidationMessage,
  isPixKeyValidByType,
  normalizePixKeyByType,
  PIX_KEY_TYPES,
  type PixKeyType,
} from "../utils/pix-key.js";

const updatePixSettingsSchema = z
  .object({
    pix_key_type: z.enum(PIX_KEY_TYPES, {
      message: "Selecione um tipo de chave Pix válido.",
    }),
    pix_key: z.string().trim().min(1, "Chave Pix é obrigatória."),
    merchant_name: z
      .string()
      .trim()
      .min(1, "Nome do recebedor é obrigatório.")
      .max(25, "Nome do recebedor deve ter no máximo 25 caracteres."),
    merchant_city: z
      .string()
      .trim()
      .min(1, "Cidade é obrigatória.")
      .max(15, "Cidade deve ter no máximo 15 caracteres."),
    password: z
      .string()
      .min(1, "Senha é obrigatória.")
      .max(128, "Senha inválida."),
  })
  .superRefine((data, context) => {
    const isValid = isPixKeyValidByType(data.pix_key_type, data.pix_key);

    if (isValid) {
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pix_key"],
      message: getPixKeyValidationMessage(data.pix_key_type),
    });
  })
  .transform((data) => ({
    ...data,
    pix_key: normalizePixKeyByType(data.pix_key_type as PixKeyType, data.pix_key),
    merchant_name: data.merchant_name.trim(),
    merchant_city: data.merchant_city.trim(),
    password: data.password,
  }));

export function validateUpdatePixSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = updatePixSettingsSchema.safeParse(req.body);

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