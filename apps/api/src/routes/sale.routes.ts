import { Router } from "express";
import { SaleController } from "../controllers/sale.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

export const saleRouter = Router();
const controller = new SaleController();

saleRouter.use(authenticate);

saleRouter.get("/", authorize("admin", "manager", "operator"), controller.list);
saleRouter.get(
  "/:id",
  authorize("admin", "manager", "operator"),
  controller.getById,
);
saleRouter.post(
  "/",
  authorize("admin", "manager", "operator"),
  controller.create,
);
saleRouter.post(
  "/:id/cancel",
  authorize("admin", "manager", "operator"),
  controller.cancel,
);
saleRouter.post(
  "/:id/refund",
  authorize("admin", "manager", "operator"),
  controller.refund,
);
