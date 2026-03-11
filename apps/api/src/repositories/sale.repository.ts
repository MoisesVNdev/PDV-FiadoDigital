import { prisma } from "../config/database.js";
import { PAYMENT_METHODS } from "@pdv/shared";
import type { Prisma } from "@prisma/client";
import type { CreateSalePayload } from "@pdv/shared";

export class SaleRepository {
  async findAll() {
    return prisma.sale.findMany({
      where: { deleted_at: null },
      include: { items: true, payments: true },
      orderBy: { created_at: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.sale.findFirst({
      where: { id, deleted_at: null },
      include: { items: true, payments: true },
    });
  }

  async findByUuid(uuid: string) {
    return prisma.sale.findFirst({
      where: { uuid },
      include: { items: true, payments: true },
    });
  }

  async create(payload: CreateSalePayload) {
    const subtotalCents = payload.items.reduce(
      (sum, item) =>
        sum + Math.round(item.unit_price_cents * item.quantity) - item.discount_cents,
      0,
    );
    const totalCents = subtotalCents - payload.discount_cents;

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
            })),
          },
        },
        include: { items: true, payments: true },
      });

      // 2. Validar e decrementar estoque de cada produto vendido
      const lowStockProducts = [];

      for (const item of payload.items) {
        const product = await tx.product.findUnique({
          where: { id: item.product_id },
          select: {
            id: true,
            name: true,
            is_bulk: true,
            stock_quantity: true,
            min_stock_alert: true,
          },
        });

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

        await tx.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: newStockQuantity },
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
      return { sale, lowStockProducts };
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
