import { prisma } from "../config/database.js";
import type { CreateCardMachinePayload, UpdateCardMachinePayload } from "@pdv/shared";

export class CardMachineRepository {
  async findAll(options?: { onlyActive?: boolean }) {
    return prisma.cardMachine.findMany({
      where: {
        deleted_at: null,
        ...(options?.onlyActive ? { is_active: true } : {}),
      },
      include: {
        rates: {
          orderBy: {
            created_at: "desc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  async findById(id: string) {
    return prisma.cardMachine.findFirst({
      where: {
        id,
        deleted_at: null,
      },
      include: {
        rates: {
          orderBy: {
            created_at: "desc",
          },
        },
      },
    });
  }

  async create(payload: CreateCardMachinePayload) {
    return prisma.cardMachine.create({
      data: {
        name: payload.name,
        is_active: payload.is_active,
        absorb_fee: payload.absorb_fee,
        rates: {
          create: {
            debit_rate: payload.rates.debit_rate,
            credit_base_rate: payload.rates.credit_base_rate,
            credit_incremental_rate: payload.rates.credit_incremental_rate,
            max_installments: payload.rates.max_installments,
          },
        },
      },
      include: {
        rates: {
          orderBy: {
            created_at: "desc",
          },
        },
      },
    });
  }

  async update(id: string, payload: UpdateCardMachinePayload) {
    const current = await this.findById(id);

    if (!current) {
      throw new Error("Maquininha não encontrada");
    }

    const currentRate = current.rates[0] ?? null;

    return prisma.$transaction(async (transactionClient) => {
      const machine = await transactionClient.cardMachine.update({
        where: { id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
          ...(payload.absorb_fee !== undefined ? { absorb_fee: payload.absorb_fee } : {}),
        },
      });

      if (payload.rates) {
        if (currentRate) {
          await transactionClient.cardMachineRate.update({
            where: { id: currentRate.id },
            data: {
              debit_rate: payload.rates.debit_rate,
              credit_base_rate: payload.rates.credit_base_rate,
              credit_incremental_rate: payload.rates.credit_incremental_rate,
              max_installments: payload.rates.max_installments,
            },
          });
        } else {
          await transactionClient.cardMachineRate.create({
            data: {
              card_machine_id: id,
              debit_rate: payload.rates.debit_rate,
              credit_base_rate: payload.rates.credit_base_rate,
              credit_incremental_rate: payload.rates.credit_incremental_rate,
              max_installments: payload.rates.max_installments,
            },
          });
        }
      }

      return transactionClient.cardMachine.findFirst({
        where: { id: machine.id, deleted_at: null },
        include: {
          rates: {
            orderBy: {
              created_at: "desc",
            },
          },
        },
      });
    });
  }

  async softDelete(id: string) {
    return prisma.cardMachine.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
  }
}
