import type { Request, Response, NextFunction } from "express";
import { DomainError } from "../errors/domain-error.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("[PDV API] Erro:", err.message);

  const statusCode = err instanceof DomainError ? err.statusCode : 500;
  const message =
    process.env.NODE_ENV === "production" ? "Erro interno" : err.message;

  res.status(statusCode).json({ success: false, message });
}
