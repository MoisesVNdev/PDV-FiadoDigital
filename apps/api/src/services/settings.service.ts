import bcrypt from "bcryptjs";
import {
  STOCK_ALERT_TYPE_SETTING_PREFIX,
  type DynamicStockAlertSettingKey,
  type SettingEntry,
  type SettingKey,
} from "@pdv/shared";
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
const STOCK_ALERT_MIN_UNITS_SETTING = "stock_alert_min_units";
const STOCK_ALERT_MIN_BULK_KG_SETTING = "stock_alert_min_bulk_kg";
const ALERT_CASH_REGISTER_AMOUNT_SETTING = "cash_register_alert_amount_cents";
const ALERT_REFUND_LIMIT_SETTING = "refund_alert_limit_cents";
const FIADO_ALERT_AT_90_PERCENT_SETTING = "fiado_alert_at_90_percent";
const FIADO_ALERT_ON_DUE_DAY_SETTING = "fiado_alert_on_due_day";
const WHATSAPP_MESSAGE_FIADO_VENCIDO_SETTING = "whatsapp_message_fiado_vencido";
const WHATSAPP_MESSAGE_FIADO_A_VENCER_SETTING = "whatsapp_message_fiado_a_vencer";
const BACKUP_PATH_SETTING = "backup_path";
const BACKUP_FREQUENCY_SETTING = "backup_frequency";
const BACKUP_RETENTION_SETTING = "backup_retention";
const BACKUP_CLOUD_ENABLED_SETTING = "backup_cloud_enabled";
const BACKUP_CLOUD_TOKEN_SETTING = "backup_cloud_token";
const BACKUP_ENCRYPTION_ENABLED_SETTING = "backup_encryption_enabled";
const BACKUP_PASSWORD_SETTING = "backup_password";
const BACKUP_TIME_SETTING = "backup_time";

function toNumericSettingValue(value: number): `${number}` {
  return String(value) as `${number}`;
}

function toBooleanSettingValue(value: boolean): "true" | "false" {
  return String(value) as "true" | "false";
}

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
    ] as const satisfies readonly SettingKey[];
    const settings = await this.settingsRepository.findMany(keys);

    const settingsMap = new Map(
      settings.map((setting: SettingEntry) => [setting.key, setting.value]),
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
    stock_alert_min_units: number;
    stock_alert_min_bulk_kg: number;
    cash_register_alert_amount_cents: number;
    refund_alert_limit_cents: number;
    fiado_alert_at_90_percent: boolean;
    fiado_alert_on_due_day: boolean;
    whatsapp_message_fiado_vencido: string;
    whatsapp_message_fiado_a_vencer: string;
    backup_path?: string;
    backup_frequency?: string;
    backup_retention?: number;
    backup_cloud_enabled?: boolean;
    backup_cloud_token?: string;
    backup_encryption_enabled?: boolean;
    backup_password?: string;
    backup_time?: string;
    stock_alert_type_settings: Record<string, number>;
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
      STOCK_ALERT_MIN_UNITS_SETTING,
      STOCK_ALERT_MIN_BULK_KG_SETTING,
      ALERT_CASH_REGISTER_AMOUNT_SETTING,
      ALERT_REFUND_LIMIT_SETTING,
      FIADO_ALERT_AT_90_PERCENT_SETTING,
      FIADO_ALERT_ON_DUE_DAY_SETTING,
      WHATSAPP_MESSAGE_FIADO_VENCIDO_SETTING,
      WHATSAPP_MESSAGE_FIADO_A_VENCER_SETTING,
      BACKUP_PATH_SETTING,
      BACKUP_FREQUENCY_SETTING,
      BACKUP_RETENTION_SETTING,
      BACKUP_CLOUD_ENABLED_SETTING,
      BACKUP_CLOUD_TOKEN_SETTING,
      BACKUP_ENCRYPTION_ENABLED_SETTING,
      BACKUP_PASSWORD_SETTING,
      BACKUP_TIME_SETTING,
    ] as const satisfies readonly SettingKey[];

    const [settings, stockAlertTypeSettings] = await Promise.all([
      this.settingsRepository.findMany(keys),
      this.settingsRepository.findByPrefix(STOCK_ALERT_TYPE_SETTING_PREFIX),
    ]);
    const map = new Map(settings.map((setting) => [setting.key, setting.value]));

    const stockAlertTypeMap: Record<string, number> = {};

    for (const item of stockAlertTypeSettings) {
      const parsed = Number.parseFloat(item.value);

      if (Number.isNaN(parsed) || parsed < 0) {
        continue;
      }

      stockAlertTypeMap[item.key] = parsed;
    }

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
      stock_alert_min_units: Number.parseInt(map.get(STOCK_ALERT_MIN_UNITS_SETTING) ?? "0", 10) || 0,
      stock_alert_min_bulk_kg: Number.parseFloat(map.get(STOCK_ALERT_MIN_BULK_KG_SETTING) ?? "0") || 0,
      cash_register_alert_amount_cents: Number.parseInt(map.get(ALERT_CASH_REGISTER_AMOUNT_SETTING) ?? "0", 10) || 0,
      refund_alert_limit_cents: Number.parseInt(map.get(ALERT_REFUND_LIMIT_SETTING) ?? "50000", 10) || 50000,
      fiado_alert_at_90_percent: map.get(FIADO_ALERT_AT_90_PERCENT_SETTING) !== "false",
      fiado_alert_on_due_day: map.get(FIADO_ALERT_ON_DUE_DAY_SETTING) !== "false",
      whatsapp_message_fiado_vencido: map.get(WHATSAPP_MESSAGE_FIADO_VENCIDO_SETTING) ?? "",
      whatsapp_message_fiado_a_vencer: map.get(WHATSAPP_MESSAGE_FIADO_A_VENCER_SETTING) ?? "",
      backup_path: map.get(BACKUP_PATH_SETTING),
      backup_frequency: map.get(BACKUP_FREQUENCY_SETTING),
      backup_retention: map.has(BACKUP_RETENTION_SETTING) ? Number.parseInt(map.get(BACKUP_RETENTION_SETTING) as string, 10) : undefined,
      backup_cloud_enabled: map.has(BACKUP_CLOUD_ENABLED_SETTING) ? map.get(BACKUP_CLOUD_ENABLED_SETTING) === "true" : undefined,
      backup_cloud_token: map.get(BACKUP_CLOUD_TOKEN_SETTING),
      backup_encryption_enabled: map.has(BACKUP_ENCRYPTION_ENABLED_SETTING) ? map.get(BACKUP_ENCRYPTION_ENABLED_SETTING) === "true" : undefined,
      backup_password: map.get(BACKUP_PASSWORD_SETTING),
      backup_time: map.get(BACKUP_TIME_SETTING),
      stock_alert_type_settings: stockAlertTypeMap,
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
    stock_alert_min_units?: number;
    stock_alert_min_bulk_kg?: number;
    cash_register_alert_amount_cents?: number;
    refund_alert_limit_cents?: number;
    fiado_alert_at_90_percent?: boolean;
    fiado_alert_on_due_day?: boolean;
    whatsapp_message_fiado_vencido?: string;
    whatsapp_message_fiado_a_vencer?: string;
    backup_path?: string;
    backup_frequency?: string;
    backup_retention?: number;
    backup_cloud_enabled?: boolean;
    backup_cloud_token?: string;
    backup_encryption_enabled?: boolean;
    backup_password?: string;
    backup_time?: string;
    stock_alert_type_settings?: Record<string, number>;
  }) {
    const operations: Promise<unknown>[] = [];

    if (data.discount_limit_daily !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          DISCOUNT_LIMIT_DAILY_SETTING,
          toNumericSettingValue(data.discount_limit_daily),
        ),
      );
    }

    if (data.discount_limit_weekly !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          DISCOUNT_LIMIT_WEEKLY_SETTING,
          toNumericSettingValue(data.discount_limit_weekly),
        ),
      );
    }

    if (data.discount_limit_monthly !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          DISCOUNT_LIMIT_MONTHLY_SETTING,
          toNumericSettingValue(data.discount_limit_monthly),
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
      operations.push(
        this.settingsRepository.upsert(
          FIADO_MAX_DAYS_SETTING,
          toNumericSettingValue(data.fiado_max_days),
        ),
      );
    }

    if (data.fiado_allow_inactive !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          FIADO_ALLOW_INACTIVE_SETTING,
          toBooleanSettingValue(data.fiado_allow_inactive),
        ),
      );
    }

    if (data.fiado_blocked_message !== undefined) {
      operations.push(this.settingsRepository.upsert(FIADO_BLOCKED_MESSAGE_SETTING, data.fiado_blocked_message));
    }

    if (data.stock_alert_min_units !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          STOCK_ALERT_MIN_UNITS_SETTING,
          toNumericSettingValue(data.stock_alert_min_units),
        ),
      );
    }

    if (data.stock_alert_min_bulk_kg !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          STOCK_ALERT_MIN_BULK_KG_SETTING,
          toNumericSettingValue(data.stock_alert_min_bulk_kg),
        ),
      );
    }

    if (data.cash_register_alert_amount_cents !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          ALERT_CASH_REGISTER_AMOUNT_SETTING,
          toNumericSettingValue(data.cash_register_alert_amount_cents),
        ),
      );
    }

    if (data.refund_alert_limit_cents !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          ALERT_REFUND_LIMIT_SETTING,
          toNumericSettingValue(data.refund_alert_limit_cents),
        ),
      );
    }

    if (data.fiado_alert_at_90_percent !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          FIADO_ALERT_AT_90_PERCENT_SETTING,
          toBooleanSettingValue(data.fiado_alert_at_90_percent),
        ),
      );
    }

    if (data.fiado_alert_on_due_day !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          FIADO_ALERT_ON_DUE_DAY_SETTING,
          toBooleanSettingValue(data.fiado_alert_on_due_day),
        ),
      );
    }

    if (data.whatsapp_message_fiado_vencido !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          WHATSAPP_MESSAGE_FIADO_VENCIDO_SETTING,
          data.whatsapp_message_fiado_vencido,
        ),
      );
    }

    if (data.whatsapp_message_fiado_a_vencer !== undefined) {
      operations.push(
        this.settingsRepository.upsert(
          WHATSAPP_MESSAGE_FIADO_A_VENCER_SETTING,
          data.whatsapp_message_fiado_a_vencer,
        ),
      );
    }

    if (data.backup_path !== undefined) {
      operations.push(this.settingsRepository.upsert(BACKUP_PATH_SETTING, data.backup_path));
    }

    if (data.backup_frequency !== undefined) {
      operations.push(this.settingsRepository.upsert(BACKUP_FREQUENCY_SETTING, data.backup_frequency));
    }

    if (data.backup_retention !== undefined) {
      operations.push(this.settingsRepository.upsert(BACKUP_RETENTION_SETTING, toNumericSettingValue(data.backup_retention)));
    }

    if (data.backup_cloud_enabled !== undefined) {
      operations.push(this.settingsRepository.upsert(BACKUP_CLOUD_ENABLED_SETTING, toBooleanSettingValue(data.backup_cloud_enabled)));
    }

    if (data.backup_cloud_token !== undefined) {
      operations.push(this.settingsRepository.upsert(BACKUP_CLOUD_TOKEN_SETTING, data.backup_cloud_token));
    }

    if (data.backup_encryption_enabled !== undefined) {
      operations.push(this.settingsRepository.upsert(BACKUP_ENCRYPTION_ENABLED_SETTING, toBooleanSettingValue(data.backup_encryption_enabled)));
    }

    if (data.backup_password !== undefined) {
      operations.push(this.settingsRepository.upsert(BACKUP_PASSWORD_SETTING, data.backup_password));
    }

    if (data.backup_time !== undefined) {
      operations.push(this.settingsRepository.upsert(BACKUP_TIME_SETTING, data.backup_time));
    }

    if (data.stock_alert_type_settings) {
      for (const [key, threshold] of Object.entries(data.stock_alert_type_settings)) {
        operations.push(
          this.settingsRepository.upsert(
            key as DynamicStockAlertSettingKey,
            toNumericSettingValue(threshold),
          ),
        );
      }
    }

    await Promise.all(operations);

    return this.getGeneralSettings();
  }
}