import { Router } from "express";
import { CardMachineController } from "../controllers/card-machine.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import {
  validateCreateCardMachine,
  validateUpdateCardMachine,
} from "../validators/card-machine.validator.js";

export const cardMachineRouter = Router();
const controller = new CardMachineController();

cardMachineRouter.use(authenticate);

cardMachineRouter.get("/", authorize("admin", "manager", "operator"), controller.list);
cardMachineRouter.post("/", authorize("admin"), validateCreateCardMachine, controller.create);
cardMachineRouter.put("/:id", authorize("admin"), validateUpdateCardMachine, controller.update);
cardMachineRouter.delete("/:id", authorize("admin"), controller.deactivate);
