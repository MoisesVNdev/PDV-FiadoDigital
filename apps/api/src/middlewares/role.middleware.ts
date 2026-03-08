import type { Request, Response, NextFunction } from "express";
import type { Role } from "@pdv/shared";

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as Role | undefined;

    if (!userRole) {
      res.status(401).json({ success: false, message: "Não autenticado" });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ success: false, message: "Acesso negado" });
      return;
    }

    next();
  };
}
