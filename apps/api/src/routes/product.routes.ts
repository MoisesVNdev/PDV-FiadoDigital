import { Router } from "express";
import { ProductController } from "../controllers/product.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

export const productRouter = Router();
const controller = new ProductController();

productRouter.use(authenticate);

productRouter.get("/", controller.list);
productRouter.get("/:id", controller.getById);
productRouter.post(
  "/",
  authorize("admin", "manager", "stockist"),
  controller.create,
);
productRouter.put(
  "/:id",
  authorize("admin", "manager", "stockist"),
  controller.update,
);
productRouter.delete(
  "/:id",
  authorize("admin", "manager", "stockist"),
  controller.deactivate,
);
