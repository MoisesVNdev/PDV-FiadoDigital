import type { NextFunction, Request, Response } from "express";
import { CardMachineService } from "../services/card-machine.service.js";

const cardMachineService = new CardMachineService();

export class CardMachineController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const onlyActive = req.query.only_active === "true";
      const cardMachines = await cardMachineService.list(onlyActive);
      res.json({ success: true, data: cardMachines });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cardMachine = await cardMachineService.create(req.body);
      res.status(201).json({ success: true, data: cardMachine });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cardMachine = await cardMachineService.update(req.params.id as string, req.body);
      res.json({ success: true, data: cardMachine });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await cardMachineService.deactivate(req.params.id as string);
      res.json({ success: true, message: "Maquininha desativada" });
    } catch (error) {
      next(error);
    }
  }
}
