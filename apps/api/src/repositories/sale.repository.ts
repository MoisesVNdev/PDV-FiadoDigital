import { prisma } from "../config/database.js";
import { PAYMENT_METHODS } from "@pdv/shared";
import type { Prisma } from "@prisma/client";
import type { CreateSalePayload } from "@pdv/shared";
import {
  fromStoredPercentage,
  toStoredPercentage,
} from "../utils/percentage-scaling.js";

const saleInclude = {
  items: true,
  payments: {
    where: {
      deleted_at: null,
    },
  },
} satisfies Prisma.SaleInclude;

function mapSalePayments<T extends { payments: Array<{ applied_rate: number | null }> }>(sale: T): T {
  return {
    ...sale,
    payments: sale.payments.map((payment) => ({
      ...payment,
      applied_rate: fromStoredPercentage(payment.applied_rate),
    })),
  };
}

export interface SaleQueryParams {
  page: number;
  per_page: number;
  from_date?: Date;
  to_date?: Date;
  status?: "completed" | "cancelled" | "refunded";
  terminal_id?: string;
  operator_id?: string;
}

export class SaleRepository {
  async findAll(params: SaleQueryParams) {
    const where: Prisma.SaleWhereInput = {
      deleted_at: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.terminal_id ? { terminal_id: params.terminal_id } : {}),
      ...(params.operator_id ? { operator_id: params.operator_id } : {}),
      ...(params.from_date || params.to_date
        ? {
            created_at: {
              ...(params.from_date ? { gte: params.from_date } : {}),
              ...(params.to_date ? { lte: params.to_date } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: saleInclude,
        orderBy: { created_at: "desc" },
        take: params.per_page,
        skip: (params.page - 1) * params.per_page,
      }),
    ]);

    return {
      data: data.map(mapSalePayments),
      pagination: {
        page: params.page,
        per_page: params.per_page,
        total,
        total_pages: Math.ceil(total / params.per_page),
      },
    };
  }

  async findById(id: string) {
    const sale = await prisma.sale.findFirst({
      where: { id, deleted_at: null },
      include: saleInclude,
    });

    return sale ? mapSalePayments(sale) : null;
  }

  async findByUuid(uuid: string) {
    const sale = await prisma.sale.findFirst({
      where: { uuid },
      include: saleInclude,
    });

    return sale ? mapSalePayments(sale) : null;
  }

  async create(payload: CreateSalePayload) {
    const subtotalCents = payload.items.reduce(
      (sum, item) =>
        sum + Math.round(item.unit_price_cents * item.quantity) - item.discount_cents,
      0,
    );
    const totalCents = payload.total_cents ?? (subtotalCents - payload.discount_cents);

    return prisma.$transaction(async (tx) => {
      const customer = await this.findCustomerForSale(tx, payload.customer_id);
      this.ensureCustomerCanBeLinkedToSale(customer);
      this.ensureFiadoBusinessRules(customer, totalCents, payload.payment_method);

      const productNamesById = await this.buildProductNameMap(tx, payload.items);

      // 1. Criar a venda e os itens
      const sale = await tx.sale.create({
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
              product_name: productNamesById.get(item.product_id) || "Produto sem nome",
              quantity: item.quantity,
              unit_price_cents: item.unit_price_cents,
              discount_cents: item.discount_cents,
              total_cents: Math.round(item.unit_price_cents * item.quantity) - item.discount_cents,
            })),
          },
          payments: {
            create: payload.payments.map((payment) => ({
              method: payment.method,
              amount_cents: payment.amount_cents,
              ...(payment.installments !== undefined ? { installments: payment.installments } : {}),
              ...(payment.applied_rate !== undefined
                ? { applied_rate: toStoredPercentage(payment.applied_rate) }
                : {}),
            })),
          },
        },
        include: saleInclude,
      });

      // 2. Validar e decrementar estoque de cada produto vendido
      const uniqueProductIds = Array.from(new Set(payload.items.map((item) => item.product_id)));
      const products = await tx.product.findMany({
        where: { id: { in: uniqueProductIds } },
        select: {
          id: true,
          name: true,
          product_type_id: true,
          is_bulk: true,
          stock_quantity: true,
          min_stock_alert: true,
          average_cost_cents: true,
        },
      });
      const productMap = new Map(products.map((product) => [product.id, product]));

      const lowStockProducts = [];
      const affectedTypeIds = new Set<string>();

      for (const item of payload.items) {
        const product = productMap.get(item.product_id);

        if (!product) {
          throw new Error(`Produto não encontrado: ${item.product_id}`);
        }

        if (!product.is_bulk && !Number.isInteger(item.quantity)) {
          throw new Error(`Dados inválidos: quantidade inválida para o produto unitário ${product.name}.`);
        }

        const requiredQuantity = product.is_bulk ? item.quantity : Math.round(item.quantity);

        // Validar estoque disponível antes de decrementar
        if (product.stock_quantity < requiredQuantity) {
          if (product.is_bulk) {
            throw new Error(
              `Estoque insuficiente para o produto: ${product.name}. Disponível: ${this.formatBulkStock(product.stock_quantity)} kg.`,
            );
          }

          throw new Error(`Estoque insuficiente para o produto: ${product.name}.`);
        }

        const newStockQuantity = product.stock_quantity - requiredQuantity;

        if (product.product_type_id) {
          affectedTypeIds.add(product.product_type_id);
        }

        await tx.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: newStockQuantity },
        });

        await tx.stockMovement.create({
          data: {
            product_id: item.product_id,
            type: "sale",
            quantity: -requiredQuantity,
            unit_cost_cents: product.average_cost_cents,
            description: `Venda ${sale.id}`,
            operator_id: payload.operator_id,
          },
        });

        // Verificar se o estoque ficou abaixo do mínimo
        if (newStockQuantity <= product.min_stock_alert) {
          lowStockProducts.push({
            productId: product.id,
            productName: product.name,
            stock_quantity: newStockQuantity,
            min_stock_alert: product.min_stock_alert,
          });
        }
      }

      // 3. Atualizar débito do cliente quando houver pagamento no fiado
      if (payload.customer_id) {
        const fiadoPayments = payload.payments.filter(
          (payment) => payment.method === PAYMENT_METHODS.FIADO,
        );

        if (fiadoPayments.length > 0) {
          const fiadoTotalCents = fiadoPayments.reduce(
            (sum, payment) => sum + payment.amount_cents,
            0,
          );

          await tx.customer.update({
            where: { id: payload.customer_id },
            data: {
              current_debt_cents: {
                increment: fiadoTotalCents,
              },
            },
          });
        }
      }

      // Retornar venda com informações de estoque baixo
      return {
        sale: mapSalePayments(sale),
        lowStockProducts,
        affectedProductTypeIds: Array.from(affectedTypeIds),
      };
    });
  }

  private formatBulkStock(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }).format(value);
  }

  private async buildProductNameMap(
    tx: Prisma.TransactionClient,
    items: CreateSalePayload["items"],
  ): Promise<Map<string, string>> {
    const uniqueProductIds = Array.from(new Set(items.map((item) => item.product_id)));

    if (uniqueProductIds.length === 0) {
      return new Map();
    }

    const products = await tx.product.findMany({
      where: { id: { in: uniqueProductIds } },
      select: { id: true, name: true },
    });

    return new Map(products.map((product) => [product.id, product.name]));
  }

  private async findCustomerForSale(
    tx: Prisma.TransactionClient,
    customerId?: string,
  ) {
    if (!customerId) {
      return null;
    }

    return tx.customer.findFirst({
      where: {
        id: customerId,
        deleted_at: null,
      },
      select: {
        id: true,
        is_active: true,
        credit_blocked: true,
        current_debt_cents: true,
        credit_limit_cents: true,
      },
    });
  }

  private ensureCustomerCanBeLinkedToSale(
    customer: {
      id: string;
      is_active: boolean;
      credit_blocked: boolean;
      current_debt_cents: number;
      credit_limit_cents: number;
    } | null,
  ): void {
    if (!customer) {
      return;
    }

    if (customer.is_active) {
      return;
    }

    throw new Error("Não é possível registrar uma venda para um cliente inativo.");
  }

  private ensureFiadoBusinessRules(
    customer: {
      id: string;
      is_active: boolean;
      credit_blocked: boolean;
      current_debt_cents: number;
      credit_limit_cents: number;
    } | null,
    totalCents: number,
    paymentMethod: string,
  ): void {
    const isFiadoSale = paymentMethod === PAYMENT_METHODS.FIADO;

    if (!isFiadoSale) {
      return;
    }

    if (!customer) {
      throw new Error("Dados inválidos: Cliente é obrigatório para pagamento no fiado.");
    }

    if (customer.credit_blocked) {
      throw new Error("Dados inválidos: Cliente com crédito bloqueado não pode comprar no fiado.");
    }

    const debtAfterSale = customer.current_debt_cents + totalCents;

    if (debtAfterSale <= customer.credit_limit_cents) {
      return;
    }

    throw new Error("Dados inválidos: Limite de crédito insuficiente para esta venda no fiado.");
  }

  async cancel(id: string, operatorId: string): Promise<void> {
    const sale = await prisma.sale.findFirst({
      where: { id, deleted_at: null },
      include: saleInclude,
    });

    if (!sale) {
      throw new Error("Venda não encontrada");
    }

    if (sale.status !== "completed") {
      throw new Error("Apenas vendas concluídas podem ser canceladas.");
    }

    const cashRegister = await prisma.cashRegister.findFirst({
      where: { terminal_id: sale.terminal_id },
      orderBy: { opened_at: "desc" },
    });

    if (!cashRegister) {
      throw new Error("Caixa não encontrado para este terminal");
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id }, data: { status: "cancelled" } });

      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            product_id: item.product_id,
            type: "adjustment",
            quantity: item.quantity,
            unit_cost_cents: item.unit_price_cents,
            description: `Reposição por cancelamento da venda #${sale.id.slice(0, 8)}`,
            operator_id: operatorId,
          },
        });
      }

      const fiadoPayment = sale.payments.find((p) => p.method === "fiado");

      if (fiadoPayment && sale.customer_id) {
        const customer = await tx.customer.findUnique({
          where: { id: sale.customer_id },
          select: { current_debt_cents: true },
        });
        const newDebt = Math.max(
          0,
          (customer?.current_debt_cents ?? 0) - fiadoPayment.amount_cents,
        );
        await tx.customer.update({
          where: { id: sale.customer_id },
          data: { current_debt_cents: newDebt },
        });
      }

      await tx.transaction.create({
        data: {
          type: "cancellation",
          amount_cents: -sale.total_cents,
          sale_id: sale.id,
          customer_id: sale.customer_id ?? null,
          cash_register_id: cashRegister.id,
          operator_id: operatorId,
          description: `Cancelamento da venda #${sale.id.slice(0, 8)}`,
        },
      });
    });
  }

  async refund(id: string, operatorId: string): Promise<void> {
    const sale = await prisma.sale.findFirst({
      where: { id, deleted_at: null },
      include: saleInclude,
    });

    if (!sale) {
      throw new Error("Venda não encontrada");
    }

    if (sale.status !== "completed") {
      throw new Error("Apenas vendas concluídas podem ser estornadas.");
    }

    const cashRegister = await prisma.cashRegister.findFirst({
      where: { terminal_id: sale.terminal_id },
      orderBy: { opened_at: "desc" },
    });

    if (!cashRegister) {
      throw new Error("Caixa não encontrado para este terminal");
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id }, data: { status: "refunded" } });

      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            product_id: item.product_id,
            type: "adjustment",
            quantity: item.quantity,
            unit_cost_cents: item.unit_price_cents,
            description: `Reposição por estorno da venda #${sale.id.slice(0, 8)}`,
            operator_id: operatorId,
          },
        });
      }

      const fiadoPayment = sale.payments.find((p) => p.method === "fiado");

      if (fiadoPayment && sale.customer_id) {
        const customer = await tx.customer.findUnique({
          where: { id: sale.customer_id },
          select: { current_debt_cents: true },
        });
        const newDebt = Math.max(
          0,
          (customer?.current_debt_cents ?? 0) - fiadoPayment.amount_cents,
        );
        await tx.customer.update({
          where: { id: sale.customer_id },
          data: { current_debt_cents: newDebt },
        });
      }

      await tx.transaction.create({
        data: {
          type: "refund",
          amount_cents: -sale.total_cents,
          sale_id: sale.id,
          customer_id: sale.customer_id ?? null,
          cash_register_id: cashRegister.id,
          operator_id: operatorId,
          description: `Estorno da venda #${sale.id.slice(0, 8)}`,
        },
      });
    });
  }

  async getCashDiscountTotalByPeriod(period: "daily" | "weekly" | "monthly", referenceDate = new Date()) {
    const { start, end } = this.resolvePeriodRange(period, referenceDate);

    const result = await prisma.sale.aggregate({
      where: {
        deleted_at: null,
        status: "completed",
        discount_cents: { gt: 0 },
        created_at: {
          gte: start,
          lte: end,
        },
        OR: [
          { payment_method: PAYMENT_METHODS.CASH },
          { payments: { some: { method: PAYMENT_METHODS.CASH, deleted_at: null } } },
        ],
      },
      _sum: {
        discount_cents: true,
      },
    });

    return result._sum.discount_cents ?? 0;
  }

  private resolvePeriodRange(period: "daily" | "weekly" | "monthly", referenceDate: Date) {
    const start = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);

    if (period === "weekly") {
      const day = start.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diffToMonday);
    }

    if (period === "monthly") {
      start.setDate(1);
    }

    const end = new Date(start);

    if (period === "daily") {
      end.setDate(start.getDate() + 1);
      end.setMilliseconds(end.getMilliseconds() - 1);
      return { start, end };
    }

    if (period === "weekly") {
      end.setDate(start.getDate() + 7);
      end.setMilliseconds(end.getMilliseconds() - 1);
      return { start, end };
    }

    end.setMonth(start.getMonth() + 1);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return { start, end };
  }
}
