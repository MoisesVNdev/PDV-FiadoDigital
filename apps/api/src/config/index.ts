export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "file:./data/dev.db",
  timeZone: process.env.APP_TIME_ZONE || "America/Sao_Paulo",
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : "http://localhost:5173",
  jwt: {
    secret: process.env.JWT_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  pix: {
    keyType: (process.env.PIX_KEY_TYPE || "") as string,
    key: (process.env.PIX_KEY || "") as string,
    merchantName: (process.env.PIX_MERCHANT_NAME || "") as string,
    merchantCity: (process.env.PIX_MERCHANT_CITY || "") as string,
    webhookSecret: (process.env.PIX_WEBHOOK_SECRET || "") as string,
  },
  encryption: {
    fieldKey: process.env.FIELD_ENCRYPTION_KEY as string,
  },
} as const;

export function assertRequiredSecrets(): void {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    throw new Error("DATABASE_URL não configurado ou vazio.");
  }
  if (!config.encryption.fieldKey || config.encryption.fieldKey.length !== 64) {
    throw new Error("FIELD_ENCRYPTION_KEY não configurado ou com tamanho diferente de 64 caracteres (32 bytes hex).");
  }
  if (!config.jwt.secret || !config.jwt.secret.trim()) {
    throw new Error("JWT_SECRET não configurado.");
  }

  if (!config.jwt.refreshSecret || !config.jwt.refreshSecret.trim()) {
    throw new Error("JWT_REFRESH_SECRET não configurado.");
  }
}
