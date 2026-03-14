import type { NextFunction, Request, Response } from "express";
import { PixService } from "../services/pix.service.js";

const pixService = new PixService();

export class PixController {
  async generateQRCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tx_id, amount_cents } = req.body as { tx_id?: string; amount_cents: number };
      const result = await pixService.generateQRCode(tx_id, amount_cents);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const txId = req.params.tx_id as string;
      const result = pixService.getPaymentStatus(txId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async webhookStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.header("x-pix-webhook-secret");
      pixService.validateWebhookSecret(signature);

      const { tx_id, status, paid_amount_cents, paid_at } = req.body as {
        tx_id: string;
        status: "confirmed" | "failed" | "expired";
        paid_amount_cents?: number;
        paid_at?: Date;
      };

      const result = pixService.confirmPaymentFromWebhook({
        tx_id,
        status,
        paid_amount_cents,
        paid_at,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
