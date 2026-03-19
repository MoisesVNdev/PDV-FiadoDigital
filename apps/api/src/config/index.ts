export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "file:./data/dev.db",
  timeZone: process.env.APP_TIME_ZONE || "America/Sao_Paulo",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  jwt: {
    secret: process.env.JWT_SECRET || "",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "",
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
} as const;

export function assertRequiredSecrets(): void {
  if (config.nodeEnv !== "production") {
    return;
  }

  if (!config.jwt.secret.trim()) {
    throw new Error("JWT_SECRET não configurado para ambiente de produção.");
  }

  if (!config.jwt.refreshSecret.trim()) {
    throw new Error("JWT_REFRESH_SECRET não configurado para ambiente de produção.");
  }
}
