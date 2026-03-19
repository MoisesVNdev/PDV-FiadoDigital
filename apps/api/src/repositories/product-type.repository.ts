import { prisma } from "../config/database.js";
import type { CreateProductTypePayload, UpdateProductTypePayload } from "@pdv/shared";
import { fromStoredRatio, toStoredRatio } from "../utils/percentage-scaling.js";

function mapProductType<T extends { profit_margin: number | null }>(productType: T): T {
  return {
    ...productType,
    profit_margin: fromStoredRatio(productType.profit_margin),
  };
}

export class ProductTypeRepository {
  async findAll() {
    const productTypes = await prisma.productType.findMany({
      where: { deleted_at: null },
      orderBy: { name: "asc" },
    });

    return productTypes.map(mapProductType);
  }

  async findById(id: string) {
    const productType = await prisma.productType.findFirst({
      where: { id, deleted_at: null },
    });

    return productType ? mapProductType(productType) : null;
  }

  async findByName(name: string) {
    const productType = await prisma.productType.findFirst({
      where: {
        name,
        deleted_at: null,
      },
    });

    return productType ? mapProductType(productType) : null;
  }

  async create(data: CreateProductTypePayload) {
    const productType = await prisma.productType.create({
      data: {
        ...data,
        profit_margin: data.profit_margin === null || data.profit_margin === undefined
          ? null
          : toStoredRatio(data.profit_margin),
      },
    });

    return mapProductType(productType);
  }

  async update(id: string, data: UpdateProductTypePayload) {
    const productType = await prisma.productType.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.profit_margin !== undefined
          ? {
              profit_margin: data.profit_margin === null
                ? null
                : toStoredRatio(data.profit_margin),
            }
          : {}),
      },
    });

    return mapProductType(productType);
  }

  async softDelete(id: string) {
    return prisma.productType.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
