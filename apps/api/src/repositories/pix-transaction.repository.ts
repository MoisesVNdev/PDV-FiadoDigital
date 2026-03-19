import { prisma } from "../config/database.js";

type PixPaymentStatus = "pending" | "confirmed" | "failed" | "expired";

export type PersistedPixTransaction = {
  tx_id: string;
  amount_cents: number;
  status: PixPaymentStatus;
  created_at: string;
  expires_at: string;
  paid_at?: string;
  paid_amount_cents?: number;
};

const PIX_TX_PREFIX = "pix_tx_";

function toSettingKey(txId: string): string {
  return `${PIX_TX_PREFIX}${txId}`;
}

function fromSettingKey(key: string): string {
  return key.slice(PIX_TX_PREFIX.length);
}

export class PixTransactionRepository {
  async upsert(transaction: PersistedPixTransaction): Promise<void> {
    await prisma.settings.upsert({
      where: { key: toSettingKey(transaction.tx_id) },
      create: {
        key: toSettingKey(transaction.tx_id),
        value: JSON.stringify(transaction),
        deleted_at: null,
      },
      update: {
        value: JSON.stringify(transaction),
        deleted_at: null,
      },
    });
  }

  async findByTxId(txId: string): Promise<PersistedPixTransaction | null> {
    const found = await prisma.settings.findFirst({
      where: {
        key: toSettingKey(txId),
        deleted_at: null,
      },
    });

    if (!found) {
      return null;
    }

    return this.safeParse(found.value, txId);
  }

  async findPending(): Promise<PersistedPixTransaction[]> {
    const rows = await prisma.settings.findMany({
      where: {
        key: { startsWith: PIX_TX_PREFIX },
        deleted_at: null,
      },
      orderBy: { updated_at: "desc" },
    });

    const pending: PersistedPixTransaction[] = [];

    for (const row of rows) {
      const txId = fromSettingKey(row.key);
      const parsed = this.safeParse(row.value, txId);

      if (!parsed || parsed.status !== "pending") {
        continue;
      }

      pending.push(parsed);
    }

    return pending;
  }

  private safeParse(value: string, fallbackTxId: string): PersistedPixTransaction | null {
    try {
      const parsed = JSON.parse(value) as PersistedPixTransaction;

      if (!parsed?.tx_id || !parsed?.status) {
        return null;
      }

      return {
        ...parsed,
        tx_id: parsed.tx_id || fallbackTxId,
      };
    } catch {
      return null;
    }
  }
}
