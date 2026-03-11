import { prisma } from "../config/database.js";
import type { CreateProductPayload, UpdateProductPayload } from "@pdv/shared";
import type { Prisma } from "@prisma/client";

export class ProductRepository {
  async findAll(barcode?: string) {
    return prisma.product.findMany({
      where: {
        deleted_at: null,
        ...(barcode ? { barcode } : {}),
        AND: [
          {
            OR: [
              { product_type_id: null },
              { product_type: { is: { deleted_at: null } } },
            ],
          },
          {
            OR: [
              { brand_id: null },
              { brand: { is: { deleted_at: null } } },
            ],
          },
        ],
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            created_at: true,
            updated_at: true,
          },
        },
        product_type: {
          select: {
            id: true,
            name: true,
            profit_margin: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.product.findFirst({
      where: { id, deleted_at: null },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            created_at: true,
            updated_at: true,
          },
        },
        product_type: {
          select: {
            id: true,
            name: true,
            profit_margin: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });
  }

  async findByBarcode(barcode: string) {
    return prisma.product.findFirst({
      where: { barcode, deleted_at: null },
      select: { id: true },
    });
  }

  async create(data: CreateProductPayload) {
    const createData: Prisma.ProductUncheckedCreateInput = {
      name: data.name,
      barcode: data.barcode ?? null,
      brand_id: data.brand_id ?? null,
      description: data.description ?? null,
      weight_value: data.weight_value ?? null,
      weight_unit: data.weight_unit ?? null,
      product_type_id: data.product_type_id ?? null,
      profit_margin: data.profit_margin ?? null,
      price_cents: data.price_cents ?? 0,
      cost_price_cents: data.cost_price_cents,
      stock_quantity: data.stock_quantity,
      min_stock_alert: data.min_stock_alert,
      is_bulk: data.is_bulk ?? false,
      is_active: data.is_active ?? true,
    };

    return prisma.product.create({
      data: createData,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            created_at: true,
            updated_at: true,
          },
        },
        product_type: {
          select: {
            id: true,
            name: true,
            profit_margin: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateProductPayload) {
    const updateData: Prisma.ProductUncheckedUpdateInput = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.barcode !== undefined ? { barcode: data.barcode } : {}),
      ...(data.brand_id !== undefined ? { brand_id: data.brand_id } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.weight_value !== undefined ? { weight_value: data.weight_value } : {}),
      ...(data.weight_unit !== undefined ? { weight_unit: data.weight_unit } : {}),
      ...(data.product_type_id !== undefined ? { product_type_id: data.product_type_id } : {}),
      ...(data.profit_margin !== undefined ? { profit_margin: data.profit_margin } : {}),
      ...(data.price_cents !== undefined ? { price_cents: data.price_cents } : {}),
      ...(data.cost_price_cents !== undefined ? { cost_price_cents: data.cost_price_cents } : {}),
      ...(data.stock_quantity !== undefined ? { stock_quantity: data.stock_quantity } : {}),
      ...(data.min_stock_alert !== undefined ? { min_stock_alert: data.min_stock_alert } : {}),
      ...(data.is_bulk !== undefined ? { is_bulk: data.is_bulk } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
    };

    return prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            created_at: true,
            updated_at: true,
          },
        },
        product_type: {
          select: {
            id: true,
            name: true,
            profit_margin: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });
  }

  async findByBrandId(brandId: string) {
    return prisma.product.findFirst({
      where: {
        brand_id: brandId,
        deleted_at: null,
      },
      select: { id: true },
    });
  }

  async findForBulkPricing(productTypeId: string, brandId?: string) {
    return prisma.product.findMany({
      where: {
        deleted_at: null,
        product_type_id: productTypeId,
        ...(brandId ? { brand_id: brandId } : {}),
      },
      select: {
        id: true,
        cost_price_cents: true,
      },
    });
  }

  async updatePricing(id: string, priceCents: number, profitMargin: number) {
    return prisma.product.update({
      where: { id },
      data: {
        price_cents: priceCents,
        profit_margin: profitMargin,
      },
    });
  }

  async softDelete(id: string) {
    return prisma.product.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
