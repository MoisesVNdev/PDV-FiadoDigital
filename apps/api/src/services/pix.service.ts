import { config } from "../config/index.js";
import { SettingsService } from "./settings.service.js";
import { generatePixPayload, validatePixInput } from "./pix-payload.service.js";
import type { PixKeyType } from "../utils/pix-key.js";
import {
  badRequest,
  forbidden,
  notFound,
  serviceUnavailable,
} from "../errors/domain-error.js";
import {
  PixTransactionRepository,
  type PersistedPixTransaction,
} from "../repositories/pix-transaction.repository.js";

const PIX_QR_CODE_TTL_SECONDS = 300;

export class PixService {
  private settingsService: SettingsService;
  private pixTransactionRepository: PixTransactionRepository;
  private initializePromise: Promise<void>;

  constructor() {
    this.settingsService = new SettingsService();
    this.pixTransactionRepository = new PixTransactionRepository();
    this.initializePromise = this.reconcilePendingTransactions();
  }

  async generateQRCode(txId: string | undefined, amountCents: number) {
    await this.initializePromise;

    const normalizedTxId = txId?.trim() || `PDV${Date.now().toString(36).toUpperCase()}`;
    // Buscar configurações do banco (prioridade)
    const dbSettings = await this.settingsService.getPixSettings();

    // Fallback para variáveis de ambiente
    const pixKeyType = (dbSettings.pix_key_type || config.pix.keyType || "") as PixKeyType | "";
    const pixKey: string = (dbSettings.pix_key || config.pix.key ||  "") as string;
    const merchantName: string = (dbSettings.merchant_name || config.pix.merchantName || "") as string;
    const merchantCity: string = (dbSettings.merchant_city || config.pix.merchantCity || "") as string;

    if (!pixKey.trim()) {
      throw badRequest("Chave Pix não configurada. Acesse Configurações > Pix para cadastrá-la.");
    }

    if (!pixKeyType) {
      throw badRequest("Configuração inválida: Tipo de chave Pix é obrigatório.");
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
      throw badRequest(`Configuração inválida: ${validation.error}`);
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

    await this.pixTransactionRepository.upsert({
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

  async getPaymentStatus(txId: string) {
    await this.initializePromise;

    const transaction = await this.pixTransactionRepository.findByTxId(txId);

    if (!transaction) {
      throw notFound("Transação Pix não encontrada.");
    }

    if (transaction.status === "pending" && new Date(transaction.expires_at).getTime() <= Date.now()) {
      transaction.status = "expired";
      await this.pixTransactionRepository.upsert(transaction);
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

  async confirmPaymentFromWebhook(input: {
    tx_id: string;
    status: "confirmed" | "failed" | "expired";
    paid_amount_cents?: number;
    paid_at?: Date;
  }) {
    await this.initializePromise;

    const transaction = await this.pixTransactionRepository.findByTxId(input.tx_id);

    if (!transaction) {
      throw notFound("Transação Pix não encontrada.");
    }

    if (transaction.status === "confirmed") {
      return transaction;
    }

    transaction.status = input.status;
    transaction.paid_at = input.paid_at?.toISOString() ?? new Date().toISOString();
    transaction.paid_amount_cents = input.paid_amount_cents ?? transaction.amount_cents;

    await this.pixTransactionRepository.upsert(transaction);

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
      throw serviceUnavailable("PIX_WEBHOOK_SECRET não configurado no servidor.");
    }

    if (!receivedSecret || receivedSecret.trim() !== configuredSecret) {
      throw forbidden("Assinatura de webhook Pix inválida.");
    }
  }

  private async reconcilePendingTransactions(): Promise<void> {
    const pendingTransactions = await this.pixTransactionRepository.findPending();

    for (const transaction of pendingTransactions) {
      const providerStatus = await this.queryProviderStatus(transaction);

      if (providerStatus) {
        await this.pixTransactionRepository.upsert(providerStatus);
        continue;
      }

      if (new Date(transaction.expires_at).getTime() <= Date.now()) {
        await this.pixTransactionRepository.upsert({
          ...transaction,
          status: "expired",
        });
      }
    }
  }

  private async queryProviderStatus(
    transaction: PersistedPixTransaction,
  ): Promise<PersistedPixTransaction | null> {
    // Placeholder de reconciliacao: integrar com o provedor Pix para consultar tx_id.
    // Enquanto nao ha cliente HTTP/provedor configurado, retornamos null.
    void transaction;
    return null;
  }
}
