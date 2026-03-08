import { prisma } from "../config/database.js";
import type { CreateSalePayload } from "@pdv/shared";

export class SaleRepository {
  async findAll() {
    return prisma.sale.findMany({
      where: { deleted_at: null },
      include: { items: true },
      orderBy: { created_at: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.sale.findFirst({
      where: { id, deleted_at: null },
      include: { items: true },
    });
  }

  async findByUuid(uuid: string) {
    return prisma.sale.findFirst({
      where: { uuid },
      include: { items: true },
    });
  }

  async create(payload: CreateSalePayload) {
    const subtotalCents = payload.items.reduce(
      (sum, item) =>
        sum + item.unit_price_cents * item.quantity - item.discount_cents,
      0,
    );
    const totalCents = subtotalCents - payload.discount_cents;

    return prisma.sale.create({
      data: {
        uuid: payload.uuid,
        operator_id: payload.operator_id,
        terminal_id: payload.terminal_id,
        payment_method: payload.payment_method,
        subtotal_cents: subtotalCents,
        discount_cents: payload.discount_cents,
        total_cents: totalCents,
        status: "completed",
        customer_id: payload.customer_id ?? null,
        items: {
          create: payload.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price_cents: item.unit_price_cents,
            discount_cents: item.discount_cents,
            total_cents:
              item.unit_price_cents * item.quantity - item.discount_cents,
          })),
        },
      },
      include: { items: true },
    });
  }

  async cancel(id: string) {
    return prisma.sale.update({
      where: { id },
      data: { status: "cancelled" },
    });
  }

  async refund(id: string) {
    return prisma.sale.update({
      where: { id },
      data: { status: "refunded" },
    });
  }
}
