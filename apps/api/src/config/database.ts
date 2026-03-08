import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "./index.js";

const dbPath = config.databaseUrl.replace("file:", "");
const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const prisma = new PrismaClient({ adapter });

export async function initDatabase(): Promise<void> {
  await prisma.$connect();

  // Habilitar WAL mode — obrigatório para concorrência multi-terminal
  await prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;");
  await prisma.$executeRawUnsafe("PRAGMA busy_timeout=5000;");

  console.log("[PDV DB] Conectado ao SQLite com WAL mode");
}
