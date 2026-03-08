import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { userRouter } from "./user.routes.js";
import { productRouter } from "./product.routes.js";
import { saleRouter } from "./sale.routes.js";
import { customerRouter } from "./customer.routes.js";
import { cashRegisterRouter } from "./cash-register.routes.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/products", productRouter);
router.use("/sales", saleRouter);
router.use("/customers", customerRouter);
router.use("/cash-registers", cashRegisterRouter);
