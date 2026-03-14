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
  if (err.message.includes("PIN inválido ou não configurado.")) return 403;
  if (err.message.includes("PIN de gerente inválido")) return 403;
  if (err.message.includes("Cancelamento permitido apenas no dia")) return 422;
  if (err.message.includes("Estorno permitido somente até")) return 422;
  if (err.message.includes("Apenas vendas concluídas")) return 422;
  if (err.message.includes("Senha incorreta. Alteração não autorizada.")) return 403;
  if (err.message.includes("Saldo de crédito insuficiente")) return 422;
  if (err.message.includes("Chave Pix não configurada")) return 422;
  if (err.message.includes("Assinatura de webhook Pix inválida")) return 403;
  if (err.message.includes("PIX_WEBHOOK_SECRET não configurado")) return 503;
  if (err.message.includes("Estoque insuficiente")) return 422;
  if (err.message.includes("inválid")) return 400;
  if (err.message.includes("Não é possível registrar uma venda para um cliente inativo")) return 400;
  if (err.message.includes("já existe")) return 409;
  if (err.message.includes("Acesso negado")) return 403;
  return 500;
}
