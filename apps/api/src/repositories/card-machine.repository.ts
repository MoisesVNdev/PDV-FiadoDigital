import { prisma } from "../config/database.js";
import type { CreateCardMachinePayload, UpdateCardMachinePayload } from "@pdv/shared";
import {
  fromStoredPercentage,
  toStoredPercentage,
} from "../utils/percentage-scaling.js";

function mapCardMachineRate<T extends {
  debit_rate: number;
  credit_base_rate: number;
  credit_incremental_rate: number;
}>(rate: T): T {
  return {
    ...rate,
    debit_rate: fromStoredPercentage(rate.debit_rate) ?? 0,
    credit_base_rate: fromStoredPercentage(rate.credit_base_rate) ?? 0,
    credit_incremental_rate: fromStoredPercentage(rate.credit_incremental_rate) ?? 0,
  };
}

function mapCardMachine<T extends {
  rates: Array<{
    debit_rate: number;
    credit_base_rate: number;
    credit_incremental_rate: number;
  }>;
}>(machine: T): T {
  return {
    ...machine,
    rates: machine.rates.map(mapCardMachineRate),
  };
}

export class CardMachineRepository {
  async findAll(options?: { onlyActive?: boolean }) {
    const machines = await prisma.cardMachine.findMany({
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

    return machines.map(mapCardMachine);
  }

  async findById(id: string) {
    const machine = await prisma.cardMachine.findFirst({
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

    return machine ? mapCardMachine(machine) : null;
  }

  async create(payload: CreateCardMachinePayload) {
    const machine = await prisma.cardMachine.create({
      data: {
        name: payload.name,
        is_active: payload.is_active,
        absorb_fee: payload.absorb_fee,
        rates: {
          create: {
            debit_rate: toStoredPercentage(payload.rates.debit_rate),
            credit_base_rate: toStoredPercentage(payload.rates.credit_base_rate),
            credit_incremental_rate: toStoredPercentage(payload.rates.credit_incremental_rate),
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

    return mapCardMachine(machine);
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
              debit_rate: toStoredPercentage(payload.rates.debit_rate),
              credit_base_rate: toStoredPercentage(payload.rates.credit_base_rate),
              credit_incremental_rate: toStoredPercentage(payload.rates.credit_incremental_rate),
              max_installments: payload.rates.max_installments,
            },
          });
        } else {
          await transactionClient.cardMachineRate.create({
            data: {
              card_machine_id: id,
              debit_rate: toStoredPercentage(payload.rates.debit_rate),
              credit_base_rate: toStoredPercentage(payload.rates.credit_base_rate),
              credit_incremental_rate: toStoredPercentage(payload.rates.credit_incremental_rate),
              max_installments: payload.rates.max_installments,
            },
          });
        }
      }

      const updatedMachine = await transactionClient.cardMachine.findFirst({
        where: { id: machine.id, deleted_at: null },
        include: {
          rates: {
            orderBy: {
              created_at: "desc",
            },
          },
        },
      });

      return updatedMachine ? mapCardMachine(updatedMachine) : null;
    });
  }

  async softDelete(id: string) {
    return prisma.cardMachine.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
  }
}
