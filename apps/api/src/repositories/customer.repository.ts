import { prisma } from "../config/database.js";

export class CustomerRepository {
  async findAll(search?: string, onlyActive = false) {
    const normalizedSearch = search?.trim();

    return prisma.customer.findMany({
      where: {
        deleted_at: null,
        ...(onlyActive ? { is_active: true } : {}),
        ...(normalizedSearch
          ? {
              OR: [
                { name: { contains: normalizedSearch } },
                { phone: { contains: normalizedSearch } },
                { email: { contains: normalizedSearch } },
              ],
            }
          : {}),
      },
    });
  }

  async findById(id: string) {
    return prisma.customer.findFirst({
      where: { id, deleted_at: null },
    });
  }

  async create(data: {
    name: string;
    phone?: string;
    email?: string;
    credit_limit_cents: number;
    payment_due_day?: number;
    is_active?: boolean;
  }) {
    return prisma.customer.create({ data });
  }

  async update(id: string, data: Record<string, unknown>) {
    return prisma.customer.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.customer.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
