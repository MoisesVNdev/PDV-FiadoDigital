import { Router } from "express";
import { PixController } from "../controllers/pix.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export const pixRouter = Router();
const controller = new PixController();

pixRouter.use(authenticate);

// POST /api/pix/qrcode - Gera QR Code Pix
pixRouter.post("/qrcode", controller.generateQRCode);
