import { Router } from "express";
import { PrintController } from "../controllers/print.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

export const printRouter = Router();
const controller = new PrintController();

printRouter.get(
  "/receipt",
  authenticate,
  authorize("admin", "manager", "operator"),
  controller.requestReceiptPrint,
);

printRouter.post(
  "/receipt",
  authenticate,
  authorize("admin", "manager", "operator"),
  controller.requestReceiptPrint,
);
