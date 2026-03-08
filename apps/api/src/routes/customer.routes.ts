import { Router } from "express";
import { CustomerController } from "../controllers/customer.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import {
  validateCreateCustomer,
  validateUpdateCustomer,
} from "../validators/customer.validator.js";

export const customerRouter = Router();
const controller = new CustomerController();

customerRouter.use(authenticate);

customerRouter.get("/", controller.list);
customerRouter.get("/:id", controller.getById);
customerRouter.post(
  "/",
  authorize("admin", "manager"),
  validateCreateCustomer,
  controller.create,
);
customerRouter.put(
  "/:id",
  authorize("admin", "manager"),
  validateUpdateCustomer,
  controller.update,
);
customerRouter.delete(
  "/:id",
  authorize("admin", "manager"),
  controller.deactivate,
);
