import type { NextFunction, Request, Response } from "express";
import { PrintService } from "../services/print.service.js";

const printService = new PrintService();

export class PrintController {
  async requestReceiptPrint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = printService.enqueueReceiptPrint({
        ...(req.method === "GET" ? (req.query as Record<string, unknown>) : req.body),
        requested_by: req.user?.sub,
      });

      res.status(202).json({
        success: true,
        message: "Solicitacao de impressao recebida.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
