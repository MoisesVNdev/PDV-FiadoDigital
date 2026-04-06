import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authLimiter, pinRateLimiter, userLoginLimiter } from "../middlewares/rate-limiter.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateBody, validatePinBody } from "../validators/auth.validator.js";

export const authRouter = Router();
const controller = new AuthController();

authRouter.post("/login", authLimiter, userLoginLimiter, validateBody, controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
authRouter.post("/validate-pin", pinRateLimiter, authenticate, validatePinBody, controller.validatePin);
authRouter.post("/ws-token", authenticate, controller.issueWsToken);
