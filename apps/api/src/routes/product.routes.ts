import { Router } from "express";
import { ProductController } from "../controllers/product.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import {
  validateCreateProduct,
  validateBulkUpdatePrice,
  validateUpdateProduct,
} from "../validators/product.validator.js";

export const productRouter = Router();
const controller = new ProductController();

productRouter.use(authenticate);

productRouter.get("/", authorize("admin", "manager", "stockist", "operator"), controller.list);
productRouter.get("/:id", authorize("admin", "manager", "stockist", "operator"), controller.getById);
productRouter.post(
  "/",
  authorize("admin", "manager", "stockist"),
  validateCreateProduct,
  controller.create,
);
productRouter.put(
  "/:id",
  authorize("admin", "manager", "stockist"),
  validateUpdateProduct,
  controller.update,
);
productRouter.patch(
  "/bulk-price",
  authorize("admin"),
  validateBulkUpdatePrice,
  controller.bulkUpdatePrice,
);
productRouter.delete(
  "/:id",
  authorize("admin", "manager", "stockist"),
  controller.deactivate,
);
