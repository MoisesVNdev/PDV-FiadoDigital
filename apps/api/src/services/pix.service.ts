import { config } from "../config/index.js";
import { SettingsService } from "./settings.service.js";
import { generatePixPayload, validatePixInput } from "./pix-payload.service.js";
import type { PixKeyType } from "../utils/pix-key.js";

type PixPaymentStatus = "pending" | "confirmed" | "failed" | "expired";

type PixTransaction = {
  tx_id: string;
  amount_cents: number;
  status: PixPaymentStatus;
  created_at: string;
  expires_at: string;
  paid_at?: string;
  paid_amount_cents?: number;
};

const PIX_QR_CODE_TTL_SECONDS = 300;
const pixTransactions = new Map<string, PixTransaction>();

export class PixService {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  async generateQRCode(txId: string | undefined, amountCents: number) {
    const normalizedTxId = txId?.trim() || `PDV${Date.now().toString(36).toUpperCase()}`;
    // Buscar configurações do banco (prioridade)
    const dbSettings = await this.settingsService.getPixSettings();

    // Fallback para variáveis de ambiente
    const pixKeyType = (dbSettings.pix_key_type || config.pix.keyType || "") as PixKeyType | "";
    const pixKey: string = (dbSettings.pix_key || config.pix.key ||  "") as string;
    const merchantName: string = (dbSettings.merchant_name || config.pix.merchantName || "") as string;
    const merchantCity: string = (dbSettings.merchant_city || config.pix.merchantCity || "") as string;

    if (!pixKey.trim()) {
      throw new Error("Chave Pix não configurada. Acesse Configurações > Pix para cadastrá-la.");
    }

    if (!pixKeyType) {
      throw new Error("Configuração inválida: Tipo de chave Pix é obrigatório.");
    }

    // Validar inputs
    const validation = validatePixInput({
      pixKeyType,
      pixKey,
      merchantName,
      merchantCity,
      amountCents,
    });

    if (!validation.valid) {
      throw new Error(`Configuração inválida: ${validation.error}`);
    }

    // Gerar payload EMVCo
    const payload = generatePixPayload({
      pixKeyType,
      pixKey,
      merchantName,
      merchantCity,
      amountCents,
    });

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + PIX_QR_CODE_TTL_SECONDS * 1000);

    pixTransactions.set(normalizedTxId, {
      tx_id: normalizedTxId,
      amount_cents: amountCents,
      status: "pending",
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    return {
      payload,
      amount_cents: amountCents,
      merchant_name: merchantName,
      qr_code_payload: payload,
      tx_id: normalizedTxId,
      expires_at: expiresAt.toISOString(),
    };
  }

  getPaymentStatus(txId: string) {
    const transaction = pixTransactions.get(txId);

    if (!transaction) {
      return {
        tx_id: txId,
        status: "not_found" as const,
      };
    }

    if (transaction.status === "pending" && new Date(transaction.expires_at).getTime() <= Date.now()) {
      transaction.status = "expired";
      pixTransactions.set(txId, transaction);
    }

    return {
      tx_id: transaction.tx_id,
      status: transaction.status,
      amount_cents: transaction.amount_cents,
      created_at: transaction.created_at,
      expires_at: transaction.expires_at,
      paid_at: transaction.paid_at,
      paid_amount_cents: transaction.paid_amount_cents,
    };
  }

  confirmPaymentFromWebhook(input: {
    tx_id: string;
    status: "confirmed" | "failed" | "expired";
    paid_amount_cents?: number;
    paid_at?: Date;
  }) {
    const transaction = pixTransactions.get(input.tx_id);

    if (!transaction) {
      return {
        tx_id: input.tx_id,
        status: "not_found" as const,
      };
    }

    if (transaction.status === "confirmed") {
      return {
        tx_id: transaction.tx_id,
        status: transaction.status,
        amount_cents: transaction.amount_cents,
        created_at: transaction.created_at,
        expires_at: transaction.expires_at,
        paid_at: transaction.paid_at,
        paid_amount_cents: transaction.paid_amount_cents,
      };
    }

    transaction.status = input.status;
    transaction.paid_at = input.paid_at?.toISOString() ?? new Date().toISOString();
    transaction.paid_amount_cents = input.paid_amount_cents ?? transaction.amount_cents;

    pixTransactions.set(input.tx_id, transaction);

    return {
      tx_id: transaction.tx_id,
      status: transaction.status,
      amount_cents: transaction.amount_cents,
      created_at: transaction.created_at,
      expires_at: transaction.expires_at,
      paid_at: transaction.paid_at,
      paid_amount_cents: transaction.paid_amount_cents,
    };
  }

  validateWebhookSecret(receivedSecret: string | undefined): void {
    const configuredSecret = config.pix.webhookSecret.trim();

    if (!configuredSecret) {
      throw new Error("PIX_WEBHOOK_SECRET não configurado no servidor.");
    }

    if (!receivedSecret || receivedSecret.trim() !== configuredSecret) {
      throw new Error("Assinatura de webhook Pix inválida.");
    }
  }
}
