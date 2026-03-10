import { prisma } from "../config/database.js";

export class SettingsRepository {
  async findByKey(key: string) {
    return prisma.settings.findUnique({
      where: { key },
    });
  }

  async upsert(key: string, value: string) {
    return prisma.settings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async findMany(keys: string[]) {
    return prisma.settings.findMany({
      where: {
        key: {
          in: keys,
        },
      },
    });
  }
}
