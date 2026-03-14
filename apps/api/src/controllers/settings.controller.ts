import type { NextFunction, Request, Response } from "express";
import { SettingsService } from "../services/settings.service.js";

const settingsService = new SettingsService();

export class SettingsController {
  async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getGeneralSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.updateGeneralSettings({
        discount_limit_daily: req.body.discount_limit_daily,
        discount_limit_weekly: req.body.discount_limit_weekly,
        discount_limit_monthly: req.body.discount_limit_monthly,
        store_name: req.body.store_name,
        store_cnpj: req.body.store_cnpj,
        store_address: req.body.store_address,
        store_phone: req.body.store_phone,
        receipt_footer: req.body.receipt_footer,
        fiado_max_days: req.body.fiado_max_days,
        fiado_allow_inactive: req.body.fiado_allow_inactive,
        fiado_blocked_message: req.body.fiado_blocked_message,
      });

      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

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
