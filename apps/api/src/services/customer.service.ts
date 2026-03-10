import { prisma } from "../config/database.js";
import bcrypt from "bcryptjs";
import { CustomerRepository, type FindAllOptions } from "../repositories/customer.repository.js";
import type { CreateCustomerPayload } from "@pdv/shared";

const customerRepository = new CustomerRepository();

export class CustomerService {
  async list(options?: FindAllOptions) {
    return customerRepository.findAll(options);
  }

  async getById(id: string) {
    const customer = await customerRepository.findById(id);

    if (!customer) {
      throw new Error("Cliente não encontrado");
    }

    return customer;
  }

  async create(payload: CreateCustomerPayload) {
    return customerRepository.create({
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      credit_limit_cents: payload.credit_limit_cents,
      payment_due_day: payload.payment_due_day,
      is_active: payload.is_active,
    });
  }

  async update(id: string, payload: Partial<CreateCustomerPayload>) {
    const updatePayload: Partial<CreateCustomerPayload> = {};

    if (typeof payload.name === "string") {
      updatePayload.name = payload.name;
    }

    if (typeof payload.phone === "string") {
      updatePayload.phone = payload.phone;
    }

    if (typeof payload.email === "string") {
      updatePayload.email = payload.email;
    }

    if (typeof payload.credit_limit_cents === "number") {
      updatePayload.credit_limit_cents = payload.credit_limit_cents;
    }

    if (typeof payload.payment_due_day === "number") {
      updatePayload.payment_due_day = payload.payment_due_day;
    }

    if (typeof payload.is_active === "boolean") {
      updatePayload.is_active = payload.is_active;
    }

    return customerRepository.update(id, updatePayload);
  }

  async deactivate(id: string) {
    return customerRepository.softDelete(id);
  }

  async payDebt(customerId: string, amountCents: number, pin: string, operatorId: string) {
    return prisma.$transaction(async (tx) => {
      const managers = await tx.user.findMany({
        where: {
          deleted_at: null,
          is_active: true,
          role: { in: ["admin", "manager"] },
          pin_hash: { not: null },
        },
        select: { pin_hash: true },
      });

      let hasValidPin = false;

      for (const manager of managers) {
        if (!manager.pin_hash) {
          continue;
        }

        const isMatch = await bcrypt.compare(pin, manager.pin_hash);

        if (isMatch) {
          hasValidPin = true;
          break;
        }
      }

      if (!hasValidPin) {
        throw new Error("PIN inválido ou não configurado.");
      }

      const customer = await tx.customer.findFirst({
        where: { id: customerId, deleted_at: null },
      });

      if (!customer) {
        throw new Error("Cliente não encontrado");
      }

      if (amountCents <= 0 || amountCents > customer.current_debt_cents) {
        throw new Error(
          "Valor do pagamento inválido. Deve ser maior que zero e menor ou igual à dívida atual."
        );
      }

      const newDebt = customer.current_debt_cents - amountCents;

      const operatorOpenCashRegister = await tx.cashRegister.findFirst({
        where: {
          status: "open",
          operator_id: operatorId,
        },
        orderBy: { opened_at: "desc" },
        select: { id: true },
      });

      const fallbackOpenCashRegister = operatorOpenCashRegister
        ? operatorOpenCashRegister
        : await tx.cashRegister.findFirst({
            where: { status: "open" },
            orderBy: { opened_at: "desc" },
            select: { id: true },
          });

      if (!fallbackOpenCashRegister) {
        throw new Error("Não há caixa aberto no sistema para registrar o pagamento de fiado.");
      }

      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          current_debt_cents: newDebt,
          ...(newDebt === 0 && { credit_blocked: false, is_active: true }),
        },
      });

      // Registrar transação de pagamento de fiado
      await tx.transaction.create({
        data: {
          type: "fiado_payment",
          amount_cents: amountCents,
          operator_id: operatorId,
          cash_register_id: fallbackOpenCashRegister.id,
          description: `Pagamento de fiado - Cliente: ${customer.name}`,
        },
      });

      return updated;
    });
  }

  async checkAndDeactivateOverdueCustomers() {
    return customerRepository.checkAndDeactivateOverdueCustomers();
  }
}
