import type { NextFunction, Request, Response } from "express";
import { SettingsService } from "../services/settings.service.js";

const settingsService = new SettingsService();

export class SettingsController {
  async getPixSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getPixSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updatePixSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.sub) {
        res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
        return;
      }

      await settingsService.updatePixSettings({
        user_id: req.user.sub,
        password: req.body.password,
        pix_key_type: req.body.pix_key_type,
        pix_key: req.body.pix_key,
        merchant_name: req.body.merchant_name,
        merchant_city: req.body.merchant_city,
      });

      res.json({ success: true, message: "Configurações do Pix salvas com sucesso" });
    } catch (error) {
      next(error);
    }
  }
}
