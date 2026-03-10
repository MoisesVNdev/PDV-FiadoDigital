import type { NextFunction, Request, Response } from "express";
import { PixService } from "../services/pix.service.js";

const pixService = new PixService();

export class PixController {
  async generateQRCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tx_id, amount_cents } = req.body;

      if (!tx_id || typeof tx_id !== "string") {
        res.status(400).json({
          success: false,
          message: "Dados inválidos: tx_id é obrigatório",
        });
        return;
      }

      if (!amount_cents || typeof amount_cents !== "number" || amount_cents <= 0) {
        res.status(400).json({
          success: false,
          message: "Dados inválidos: amount_cents deve ser um número positivo",
        });
        return;
      }

      const result = await pixService.generateQRCode(tx_id, amount_cents);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
