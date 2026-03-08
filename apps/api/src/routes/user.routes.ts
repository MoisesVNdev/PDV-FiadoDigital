import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

export const userRouter = Router();
const controller = new UserController();

userRouter.use(authenticate);

userRouter.get("/", authorize("admin", "manager"), controller.list);
userRouter.get("/:id", authorize("admin", "manager"), controller.getById);
userRouter.post("/", authorize("admin"), controller.create);
userRouter.put("/:id", authorize("admin"), controller.update);
userRouter.delete("/:id", authorize("admin"), controller.deactivate);
