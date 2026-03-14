import bcrypt from "bcryptjs";
import { config } from "../config/index.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import type { PixKeyType } from "../utils/pix-key.js";

const PIX_KEY_SETTING = "pix.key";
const PIX_KEY_TYPE_SETTING = "pix.key_type";
const PIX_MERCHANT_NAME_SETTING = "pix.merchant_name";
const PIX_MERCHANT_CITY_SETTING = "pix.merchant_city";
const DISCOUNT_LIMIT_DAILY_SETTING = "discount_limit_daily";
const DISCOUNT_LIMIT_WEEKLY_SETTING = "discount_limit_weekly";
const DISCOUNT_LIMIT_MONTHLY_SETTING = "discount_limit_monthly";
const STORE_NAME_SETTING = "store_name";
const STORE_CNPJ_SETTING = "store_cnpj";
const STORE_ADDRESS_SETTING = "store_address";
const STORE_PHONE_SETTING = "store_phone";
const RECEIPT_FOOTER_SETTING = "receipt_footer";
const FIADO_MAX_DAYS_SETTING = "fiado_max_days";
const FIADO_ALLOW_INACTIVE_SETTING = "fiado_allow_inactive";
const FIADO_BLOCKED_MESSAGE_SETTING = "fiado_blocked_message";

export class SettingsService {
  private settingsRepository: SettingsRepository;
  private userRepository: UserRepository;
  private auditLogRepository: AuditLogRepository;

  constructor() {
    this.settingsRepository = new SettingsRepository();
    this.userRepository = new UserRepository();
    this.auditLogRepository = new AuditLogRepository();
  }

  async getPixSettings(): Promise<{
    pix_key_type: PixKeyType | "";
    pix_key: string;
    merchant_name: string;
    merchant_city: string;
  }> {
    const keys = [
      PIX_KEY_SETTING,
      PIX_KEY_TYPE_SETTING,
      PIX_MERCHANT_NAME_SETTING,
      PIX_MERCHANT_CITY_SETTING,
    ];
    const settings = await this.settingsRepository.findMany(keys);

    const settingsMap = new Map(
      settings.map((s: { key: string; value: string }) => [s.key, s.value]),
    );

    return {
      pix_key_type: (settingsMap.get(PIX_KEY_TYPE_SETTING) || config.pix.keyType || "") as PixKeyType | "",
      pix_key: (settingsMap.get(PIX_KEY_SETTING) || config.pix.key || "") as string,
      merchant_name: (settingsMap.get(PIX_MERCHANT_NAME_SETTING) || config.pix.merchantName || "") as string,
      merchant_city: (settingsMap.get(PIX_MERCHANT_CITY_SETTING) || config.pix.merchantCity || "") as string,
    };
  }

  async updatePixSettings(data: {
    user_id: string;
    password: string;
    pix_key_type: PixKeyType;
    pix_key: string;
    merchant_name: string;
    merchant_city: string;
  }) {
    const user = await this.userRepository.findById(data.user_id);

    if (!user || !user.is_active) {
      throw new Error("Acesso negado");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error("Senha incorreta. Alteração não autorizada.");
    }

    await Promise.all([
      this.settingsRepository.upsert(PIX_KEY_SETTING, data.pix_key),
      this.settingsRepository.upsert(PIX_KEY_TYPE_SETTING, data.pix_key_type),
      this.settingsRepository.upsert(PIX_MERCHANT_NAME_SETTING, data.merchant_name),
      this.settingsRepository.upsert(PIX_MERCHANT_CITY_SETTING, data.merchant_city),
    ]);

    await this.auditLogRepository.create({
      action: "pix_key_changed",
      actor_id: data.user_id,
      entity_type: "settings",
      entity_id: PIX_KEY_SETTING,
      details: { user_id: data.user_id },
    });

    return { success: true };
  }

  async getGeneralSettings(): Promise<{
    discount_limit_daily: number;
    discount_limit_weekly: number;
    discount_limit_monthly: number;
    store_name: string;
    store_cnpj: string;
    store_address: string;
    store_phone: string;
    receipt_footer: string;
    fiado_max_days: number;
    fiado_allow_inactive: boolean;
    fiado_blocked_message: string;
  }> {
    const keys = [
      DISCOUNT_LIMIT_DAILY_SETTING,
      DISCOUNT_LIMIT_WEEKLY_SETTING,
      DISCOUNT_LIMIT_MONTHLY_SETTING,
      STORE_NAME_SETTING,
      STORE_CNPJ_SETTING,
      STORE_ADDRESS_SETTING,
      STORE_PHONE_SETTING,
      RECEIPT_FOOTER_SETTING,
      FIADO_MAX_DAYS_SETTING,
      FIADO_ALLOW_INACTIVE_SETTING,
      FIADO_BLOCKED_MESSAGE_SETTING,
    ];

    const settings = await this.settingsRepository.findMany(keys);
    const map = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      discount_limit_daily: Number.parseInt(map.get(DISCOUNT_LIMIT_DAILY_SETTING) ?? "0", 10) || 0,
      discount_limit_weekly: Number.parseInt(map.get(DISCOUNT_LIMIT_WEEKLY_SETTING) ?? "0", 10) || 0,
      discount_limit_monthly: Number.parseInt(map.get(DISCOUNT_LIMIT_MONTHLY_SETTING) ?? "0", 10) || 0,
      store_name: map.get(STORE_NAME_SETTING) ?? "",
      store_cnpj: map.get(STORE_CNPJ_SETTING) ?? "",
      store_address: map.get(STORE_ADDRESS_SETTING) ?? "",
      store_phone: map.get(STORE_PHONE_SETTING) ?? "",
      receipt_footer: map.get(RECEIPT_FOOTER_SETTING) ?? "",
      fiado_max_days: Number.parseInt(map.get(FIADO_MAX_DAYS_SETTING) ?? "0", 10) || 0,
      fiado_allow_inactive: map.get(FIADO_ALLOW_INACTIVE_SETTING) === "true",
      fiado_blocked_message: map.get(FIADO_BLOCKED_MESSAGE_SETTING) ?? "",
    };
  }

  async updateGeneralSettings(data: {
    discount_limit_daily?: number;
    discount_limit_weekly?: number;
    discount_limit_monthly?: number;
    store_name?: string;
    store_cnpj?: string;
    store_address?: string;
    store_phone?: string;
    receipt_footer?: string;
    fiado_max_days?: number;
    fiado_allow_inactive?: boolean;
    fiado_blocked_message?: string;
  }) {
    const operations: Promise<unknown>[] = [];

    if (data.discount_limit_daily !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          DISCOUNT_LIMIT_DAILY_SETTING,
          String(data.discount_limit_daily),
        ),
      );
    }

    if (data.discount_limit_weekly !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          DISCOUNT_LIMIT_WEEKLY_SETTING,
          String(data.discount_limit_weekly),
        ),
      );
    }

    if (data.discount_limit_monthly !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          DISCOUNT_LIMIT_MONTHLY_SETTING,
          String(data.discount_limit_monthly),
        ),
      );
    }

    if (data.store_name !== undefined) {
      operations.push(this.settingsRepository.upsert(STORE_NAME_SETTING, data.store_name));
    }

    if (data.store_cnpj !== undefined) {
      operations.push(this.settingsRepository.upsert(STORE_CNPJ_SETTING, data.store_cnpj));
    }

    if (data.store_address !== undefined) {
      operations.push(this.settingsRepository.upsert(STORE_ADDRESS_SETTING, data.store_address));
    }

    if (data.store_phone !== undefined) {
      operations.push(this.settingsRepository.upsert(STORE_PHONE_SETTING, data.store_phone));
    }

    if (data.receipt_footer !== undefined) {
      operations.push(this.settingsRepository.upsert(RECEIPT_FOOTER_SETTING, data.receipt_footer));
    }

    if (data.fiado_max_days !== undefined) {
      operations.push(this.settingsRepository.upsert(FIADO_MAX_DAYS_SETTING, String(data.fiado_max_days)));
    }

    if (data.fiado_allow_inactive !== undefined) {
      operations.push(
        this.settingsRepository.upsert(FIADO_ALLOW_INACTIVE_SETTING, String(data.fiado_allow_inactive)),
      );
    }

    if (data.fiado_blocked_message !== undefined) {
      operations.push(this.settingsRepository.upsert(FIADO_BLOCKED_MESSAGE_SETTING, data.fiado_blocked_message));
    }

    await Promise.all(operations);

    return this.getGeneralSettings();
  }
}
