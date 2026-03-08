import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("[PDV API] Erro:", err.message);

  const statusCode = getStatusCode(err);
  const message =
    process.env.NODE_ENV === "production" ? "Erro interno" : err.message;

  res.status(statusCode).json({ success: false, message });
}

function getStatusCode(err: Error): number {
  if (err.message.includes("não encontrad")) return 404;
  if (err.message.includes("inválid")) return 400;
  if (err.message.includes("já existe")) return 409;
  if (err.message.includes("Acesso negado")) return 403;
  return 500;
}
