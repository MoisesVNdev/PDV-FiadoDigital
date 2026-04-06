import { prisma } from "../config/database.js";
import { encryptField, decryptField } from "../utils/encrypt-field.js";
import { config } from "../config/index.js";
import type {
  DynamicStockAlertSettingKey,
  SettingEntry,
  SettingKey,
  SettingValue,
} from "@pdv/shared";

export class SettingsRepository {
  async findByKey<K extends SettingKey>(key: K): Promise<SettingEntry<K> | null> {
    const setting = await prisma.settings.findFirst({
      where: {
        key,
        deleted_at: null,
      },
    });

    if (setting) {
      setting.value = this.deserializeValue(key, setting.value);
    }

    return setting as unknown as SettingEntry<K> | null;
  }

  async upsert<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<SettingEntry<K>> {
    const encryptedValue = this.serializeValue(key, value);

    const setting = await prisma.settings.upsert({
      where: { key },
      create: { key, value: encryptedValue, deleted_at: null },
      update: { value: encryptedValue, deleted_at: null },
    });

    setting.value = this.deserializeValue(key, setting.value);

    return setting as unknown as SettingEntry<K>;
  }

  async findMany<K extends SettingKey>(keys: readonly K[]): Promise<Array<SettingEntry<K>>> {
    const settings = await prisma.settings.findMany({
      where: {
        deleted_at: null,
        key: {
          in: [...keys],
        },
      },
    });

    for (const setting of settings) {
      setting.value = this.deserializeValue(setting.key, setting.value);
    }

    return settings as unknown as Array<SettingEntry<K>>;
  }

  async findByPrefix(prefix: string): Promise<Array<SettingEntry<DynamicStockAlertSettingKey>>> {
    const settings = await prisma.settings.findMany({
      where: {
        deleted_at: null,
        key: {
          startsWith: prefix,
        },
      },
    });

    for (const setting of settings) {
      setting.value = this.deserializeValue(setting.key, setting.value);
    }

    return settings as unknown as Array<SettingEntry<DynamicStockAlertSettingKey>>;
  }

  private serializeValue(key: string, value: string): string {
    if (value && (key === "backup_password" || key === "backup_cloud_token")) {
      return encryptField(value, config.encryption.fieldKey);
    }
    return value;
  }

  private deserializeValue(key: string, value: string): string {
    if (value && (key === "backup_password" || key === "backup_cloud_token")) {
      return decryptField(value, config.encryption.fieldKey);
    }
    return value;
  }
}
