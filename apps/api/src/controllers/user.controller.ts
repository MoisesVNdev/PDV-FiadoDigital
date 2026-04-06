import type { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service.js";

const userService = new UserService();

export class UserController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.list();
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await userService.getById(req.params.id as string);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await userService.create(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const changedById = req.user?.sub as string;
      const user = await userService.update(req.params.id as string, req.body, changedById);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const changedById = req.user?.sub as string;
      await userService.deactivate(req.params.id as string, changedById);
      res.json({ success: true, message: "Usuário desativado" });
    } catch (error) {
      next(error);
    }
  }
}
