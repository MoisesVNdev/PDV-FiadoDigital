import { Router } from "express";
import { PixController } from "../controllers/pix.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
	validateGenerateQRCode,
	validatePixStatusParams,
	validatePixWebhook,
} from "../validators/pix.validator.js";

export const pixRouter = Router();
const controller = new PixController();

// POST /api/pix/qrcode - Gera QR Code Pix
pixRouter.post("/qrcode", authenticate, validateGenerateQRCode, controller.generateQRCode);

// GET /api/pix/status/:tx_id - Consulta status de pagamento Pix
pixRouter.get("/status/:tx_id", authenticate, validatePixStatusParams, controller.getPaymentStatus);

// POST /api/pix/webhook - Atualização de status recebida do provedor Pix
pixRouter.post("/webhook", validatePixWebhook, controller.webhookStatus);
