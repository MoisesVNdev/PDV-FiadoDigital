export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "file:./data/dev.db",
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
  },
} as const;
