import { prisma } from "../config/database.js";
import type {
  CreateProductPayload,
  PaginatedResult,
  Product,
  ProductQueryParams,
  ProductWeightUnit,
  UpdateProductPayload,
} from "@pdv/shared";
import type { Prisma } from "@prisma/client";
import { fromStoredRatio, toStoredRatio } from "../utils/percentage-scaling.js";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

function toProduct(product: {
  id: string;
  name: string;
  barcode: string | null;
  brand_id: string | null;
  brand: { id: string; name: string; created_at: Date; updated_at: Date } | null;
  description: string | null;
  weight_value: number | null;
  weight_unit: string | null;
  product_type_id: string | null;
  product_type: { id: string; name: string; profit_margin: number | null; created_at: Date; updated_at: Date } | null;
  profit_margin: number | null;
  price_cents: number;
  cost_price_cents: number;
  average_cost_cents: number;
  stock_quantity: number;
  min_stock_alert: number;
  is_bulk: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}): Product {
  return {
    ...product,
    profit_margin: fromStoredRatio(product.profit_margin),
    weight_unit: product.weight_unit as ProductWeightUnit | null,
    brand: product.brand
      ? {
          ...product.brand,
          created_at: product.brand.created_at.toISOString(),
          updated_at: product.brand.updated_at.toISOString(),
        }
      : null,
    product_type: product.product_type
      ? {
          ...product.product_type,
          profit_margin: fromStoredRatio(product.product_type.profit_margin),
          created_at: product.product_type.created_at.toISOString(),
          updated_at: product.product_type.updated_at.toISOString(),
        }
      : null,
    created_at: product.created_at.toISOString(),
    updated_at: product.updated_at.toISOString(),
  };
}

export class ProductRepository {
  async findAll(params: ProductQueryParams): Promise<PaginatedResult<Product>> {
    const {
      barcode,
      search,
      page = 1,
      per_page = DEFAULT_PER_PAGE,
    } = params;

    const normalizedSearch = search?.trim();
    const validPerPage = Math.min(Math.max(per_page || DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
    const validPage = Math.max(page || 1, 1);

    const where: Prisma.ProductWhereInput = {
      deleted_at: null,
      ...(barcode ? { barcode } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { name: { contains: normalizedSearch } },
              { barcode: { contains: normalizedSearch } },
            ],
          }
        : {}),
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
    };

    const [total, data] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip: (validPage - 1) * validPerPage,
        take: validPerPage,
        orderBy: { name: "asc" },
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
      }),
    ]);

    return {
      data: data.map(toProduct),
      pagination: {
        page: validPage,
        per_page: validPerPage,
        total,
        total_pages: Math.ceil(total / validPerPage),
      },
    };
  }

  async findById(id: string) {
    const product = await prisma.product.findFirst({
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

    return product ? toProduct(product) : null;
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
      profit_margin: data.profit_margin === undefined ? null : toStoredRatio(data.profit_margin),
      price_cents: data.price_cents ?? 0,
      cost_price_cents: data.cost_price_cents,
      average_cost_cents: data.average_cost_cents ?? data.cost_price_cents,
      stock_quantity: data.stock_quantity,
      min_stock_alert: data.min_stock_alert,
      is_bulk: data.is_bulk ?? false,
      is_active: data.is_active ?? true,
    };

    const product = await prisma.product.create({
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

    return toProduct(product);
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
      ...(data.profit_margin !== undefined ? { profit_margin: toStoredRatio(data.profit_margin) } : {}),
      ...(data.price_cents !== undefined ? { price_cents: data.price_cents } : {}),
      ...(data.cost_price_cents !== undefined ? { cost_price_cents: data.cost_price_cents } : {}),
      ...(data.average_cost_cents !== undefined ? { average_cost_cents: data.average_cost_cents } : {}),
      ...(data.stock_quantity !== undefined ? { stock_quantity: data.stock_quantity } : {}),
      ...(data.min_stock_alert !== undefined ? { min_stock_alert: data.min_stock_alert } : {}),
      ...(data.is_bulk !== undefined ? { is_bulk: data.is_bulk } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
    };

    const product = await prisma.product.update({
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

    return toProduct(product);
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
        profit_margin: toStoredRatio(profitMargin),
      },
    });
  }

  async softDelete(id: string) {
    return prisma.product.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async getTypeStockSnapshot() {
    const rows = await prisma.product.findMany({
      where: {
        deleted_at: null,
        product_type_id: {
          not: null,
        },
        product_type: {
          is: {
            deleted_at: null,
          },
        },
      },
      select: {
        stock_quantity: true,
        is_bulk: true,
        product_type: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const typeMap = new Map<string, { id: string; name: string; total: number; allBulk: boolean }>();

    for (const row of rows) {
      if (!row.product_type) {
        continue;
      }

      const current = typeMap.get(row.product_type.id);

      if (!current) {
        typeMap.set(row.product_type.id, {
          id: row.product_type.id,
          name: row.product_type.name,
          total: row.stock_quantity,
          allBulk: row.is_bulk,
        });
        continue;
      }

      current.total += row.stock_quantity;

      if (!row.is_bulk) {
        current.allBulk = false;
      }
    }

    return Array.from(typeMap.values());
  }

  async getTypeStockSnapshotByIds(typeIds: string[]) {
    if (typeIds.length === 0) {
      return [];
    }

    const rows = await prisma.product.findMany({
      where: {
        deleted_at: null,
        product_type_id: {
          in: typeIds,
        },
        product_type: {
          is: {
            deleted_at: null,
          },
        },
      },
      select: {
        stock_quantity: true,
        is_bulk: true,
        product_type: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const typeMap = new Map<string, { id: string; name: string; total: number; allBulk: boolean }>();

    for (const row of rows) {
      if (!row.product_type) {
        continue;
      }

      const current = typeMap.get(row.product_type.id);

      if (!current) {
        typeMap.set(row.product_type.id, {
          id: row.product_type.id,
          name: row.product_type.name,
          total: row.stock_quantity,
          allBulk: row.is_bulk,
        });
        continue;
      }

      current.total += row.stock_quantity;

      if (!row.is_bulk) {
        current.allBulk = false;
      }
    }

    return Array.from(typeMap.values());
  }
}
