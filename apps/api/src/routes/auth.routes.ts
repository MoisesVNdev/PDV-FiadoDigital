import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authLimiter } from "../middlewares/rate-limiter.middleware.js";
import { validateBody } from "../validators/auth.validator.js";

export const authRouter = Router();
const controller = new AuthController();

authRouter.post("/login", authLimiter, validateBody, controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
