import bcrypt from "bcryptjs";
import { config } from "../config/index.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import type { PixKeyType } from "../utils/pix-key.js";

const PIX_KEY_SETTING = "pix.key";
const PIX_KEY_TYPE_SETTING = "pix.key_type";
const PIX_MERCHANT_NAME_SETTING = "pix.merchant_name";
const PIX_MERCHANT_CITY_SETTING = "pix.merchant_city";

export class SettingsService {
  private settingsRepository: SettingsRepository;
  private userRepository: UserRepository;

  constructor() {
    this.settingsRepository = new SettingsRepository();
    this.userRepository = new UserRepository();
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

    return { success: true };
  }
}
