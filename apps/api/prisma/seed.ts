import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const databaseUrl = process.env.DATABASE_URL ?? "file:/app/data/data.db";
const dbPath = databaseUrl.replace("file:", "");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      is_active: true,
      deleted_at: null,
    },
    create: {
      name: "Administrador",
      username: "admin",
      password_hash: passwordHash,
      role: "admin",
      is_active: true,
    },
  });

  console.log("[SEED] Usuario admin garantido com sucesso.");
  console.log("[SEED] Login: admin | Senha: admin123");
}

main()
  .catch((error) => {
    console.error("[SEED] Falha ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
