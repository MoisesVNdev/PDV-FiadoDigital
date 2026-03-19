export const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "phone", "random"] as const;

export const STOCK_ALERT_TYPE_SETTING_PREFIX = "stock_alert_type_" as const;

export const KNOWN_SETTING_KEYS = [
  "pix.key",
  "pix.key_type",
  "pix.merchant_name",
  "pix.merchant_city",
  "discount_limit_daily",
  "discount_limit_weekly",
  "discount_limit_monthly",
  "store_name",
  "store_cnpj",
  "store_address",
  "store_phone",
  "receipt_footer",
  "fiado_max_days",
  "fiado_allow_inactive",
  "fiado_blocked_message",
  "stock_alert_min_units",
  "stock_alert_min_bulk_kg",
  "cash_register_alert_amount_cents",
  "refund_alert_limit_cents",
  "fiado_alert_at_90_percent",
  "fiado_alert_on_due_day",
  "whatsapp_message_fiado_vencido",
  "whatsapp_message_fiado_a_vencer",
] as const;

export type SettingsPixKeyType = (typeof PIX_KEY_TYPES)[number];
export type KnownSettingKey = (typeof KNOWN_SETTING_KEYS)[number];
export type DynamicStockAlertSettingKey = `${typeof STOCK_ALERT_TYPE_SETTING_PREFIX}${string}`;
export type SettingKey = KnownSettingKey | DynamicStockAlertSettingKey;

export type KnownSettingValueMap = {
  "pix.key": string;
  "pix.key_type": SettingsPixKeyType;
  "pix.merchant_name": string;
  "pix.merchant_city": string;
  "discount_limit_daily": `${number}`;
  "discount_limit_weekly": `${number}`;
  "discount_limit_monthly": `${number}`;
  store_name: string;
  store_cnpj: string;
  store_address: string;
  store_phone: string;
  receipt_footer: string;
  fiado_max_days: `${number}`;
  fiado_allow_inactive: "true" | "false";
  fiado_blocked_message: string;
  stock_alert_min_units: `${number}`;
  stock_alert_min_bulk_kg: `${number}`;
  cash_register_alert_amount_cents: `${number}`;
  refund_alert_limit_cents: `${number}`;
  fiado_alert_at_90_percent: "true" | "false";
  fiado_alert_on_due_day: "true" | "false";
  whatsapp_message_fiado_vencido: string;
  whatsapp_message_fiado_a_vencer: string;
};

export type SettingValue<K extends SettingKey = SettingKey> = K extends KnownSettingKey
  ? KnownSettingValueMap[K]
  : `${number}`;

export type SettingEntry<K extends SettingKey = SettingKey> = {
  key: K;
  value: SettingValue<K>;
};

export type SettingsRecord = {
  [Key in SettingKey]?: SettingValue<Key>;
};