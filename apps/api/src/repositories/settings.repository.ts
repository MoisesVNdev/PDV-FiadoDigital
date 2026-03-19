import { prisma } from "../config/database.js";
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

    return setting as unknown as SettingEntry<K> | null;
  }

  async upsert<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<SettingEntry<K>> {
    const setting = await prisma.settings.upsert({
      where: { key },
      create: { key, value, deleted_at: null },
      update: { value, deleted_at: null },
    });

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

    return settings as unknown as Array<SettingEntry<DynamicStockAlertSettingKey>>;
  }
}
