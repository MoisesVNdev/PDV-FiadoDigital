import { prisma } from "../config/database.js";

export class CashRegisterRepository {
  async findAll() {
    return prisma.cashRegister.findMany({
      orderBy: { opened_at: "desc" },
    });
  }

  async findOpenByTerminal(terminalId: string) {
    return prisma.cashRegister.findFirst({
      where: { terminal_id: terminalId, status: "open" },
    });
  }

  async create(data: {
    terminal_id: string;
    opening_balance_cents: number;
    operator_id: string;
  }) {
    return prisma.cashRegister.create({
      data: {
        ...data,
        status: "open",
        expected_balance_cents: data.opening_balance_cents,
      },
    });
  }

  async close(id: string, closingBalanceCents: number) {
    const register = await prisma.cashRegister.findUnique({ where: { id } });

    if (!register) {
      throw new Error("Caixa não encontrado");
    }

    return prisma.cashRegister.update({
      where: { id },
      data: {
        closing_balance_cents: closingBalanceCents,
        status: "closed",
        closed_at: new Date(),
      },
    });
  }

  async cashOut(
    id: string,
    amountCents: number,
    description: string,
    operatorId: string,
  ) {
    const register = await prisma.cashRegister.findUnique({ where: { id } });

    if (!register || register.status !== "open") {
      throw new Error("Caixa não está aberto");
    }

    return prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          type: "cash_out",
          amount_cents: amountCents,
          cash_register_id: id,
          operator_id: operatorId,
          description,
        },
      });

      return tx.cashRegister.update({
        where: { id },
        data: {
          expected_balance_cents: (register.expected_balance_cents ?? register.opening_balance_cents) - amountCents,
        },
      });
    });
  }

  async cashIn(
    id: string,
    amountCents: number,
    description: string,
    operatorId: string,
  ) {
    const register = await prisma.cashRegister.findUnique({ where: { id } });

    if (!register || register.status !== "open") {
      throw new Error("Caixa não está aberto");
    }

    return prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          type: "cash_in",
          amount_cents: amountCents,
          cash_register_id: id,
          operator_id: operatorId,
          description,
        },
      });

      return tx.cashRegister.update({
        where: { id },
        data: {
          expected_balance_cents: (register.expected_balance_cents ?? register.opening_balance_cents) + amountCents,
        },
      });
    });
  }
}
