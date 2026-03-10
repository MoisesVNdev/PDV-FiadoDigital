import { prisma } from "../config/database.js";

const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

export interface FindAllOptions {
  search?: string;
  onlyActive?: boolean;
  page?: number;
  perPage?: number;
  sortBy?: "name" | "credit_limit_cents" | "payment_due_day" | "current_debt_cents" | "is_active";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export class CustomerRepository {
  async findAll(options?: FindAllOptions): Promise<PaginatedResult<any>> {
    const {
      search = undefined,
      onlyActive = false,
      page = 1,
      perPage = DEFAULT_PER_PAGE,
      sortBy = "name",
      sortOrder = "asc",
    } = options || {};

    const normalizedSearch = search?.trim();
    const validPerPage = Math.min(Math.max(perPage || DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
    const validPage = Math.max(page || 1, 1);

    const where = {
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
    };

    const [total, data] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip: (validPage - 1) * validPerPage,
        take: validPerPage,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const totalPages = Math.ceil(total / validPerPage);

    return {
      data,
      pagination: {
        page: validPage,
        per_page: validPerPage,
        total,
        total_pages: totalPages,
      },
    };
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

  async updateDebt(id: string, debtCents: number) {
    return prisma.customer.update({
      where: { id },
      data: {
        current_debt_cents: debtCents,
        ...(debtCents === 0 && { credit_blocked: false, is_active: true }),
      },
    });
  }

  async softDelete(id: string) {
    return prisma.customer.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async checkAndDeactivateOverdueCustomers() {
    const today = new Date();
    const currentDay = today.getDate();

    return prisma.customer.updateMany({
      where: {
        deleted_at: null,
        is_active: true,
        current_debt_cents: { gt: 0 },
        payment_due_day: { not: null, lt: currentDay },
      },
      data: { is_active: false },
    });
  }
}
