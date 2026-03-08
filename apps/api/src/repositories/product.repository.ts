import { prisma } from "../config/database.js";

export class ProductRepository {
  async findAll() {
    return prisma.product.findMany({
      where: { deleted_at: null },
    });
  }

  async findById(id: string) {
    return prisma.product.findFirst({
      where: { id, deleted_at: null },
    });
  }

  async create(data: {
    name: string;
    barcode?: string;
    description?: string;
    price_cents: number;
    cost_price_cents: number;
    stock_quantity: number;
    min_stock_alert: number;
  }) {
    return prisma.product.create({ data });
  }

  async update(id: string, data: Record<string, unknown>) {
    return prisma.product.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.product.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
