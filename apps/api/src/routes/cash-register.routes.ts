import { Router } from "express";
import { CashRegisterController } from "../controllers/cash-register.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

export const cashRegisterRouter = Router();
const controller = new CashRegisterController();

cashRegisterRouter.use(authenticate);

cashRegisterRouter.get(
  "/",
  authorize("admin", "manager"),
  controller.list,
);
cashRegisterRouter.get(
  "/current",
  authorize("admin", "manager", "operator"),
  controller.getCurrent,
);
cashRegisterRouter.post(
  "/open",
  authorize("admin", "manager", "operator"),
  controller.open,
);
cashRegisterRouter.post(
  "/close",
  authorize("admin", "manager", "operator"),
  controller.close,
);
cashRegisterRouter.post(
  "/cash-out",
  authorize("admin", "manager"),
  controller.cashOut,
);
