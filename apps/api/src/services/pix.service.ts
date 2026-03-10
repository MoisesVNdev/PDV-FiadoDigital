import { config } from "../config/index.js";
import { SettingsService } from "./settings.service.js";
import { generatePixPayload, validatePixInput } from "./pix-payload.service.js";
import type { PixKeyType } from "../utils/pix-key.js";

export class PixService {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  async generateQRCode(txId: string, amountCents: number) {
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

    return {
      payload,
      amount_cents: amountCents,
      merchant_name: merchantName,
      qr_code_payload: payload,
      tx_id: txId,
    };
  }
}
