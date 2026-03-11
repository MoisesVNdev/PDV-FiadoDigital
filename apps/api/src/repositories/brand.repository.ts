import { prisma } from "../config/database.js";
import type { CreateBrandPayload, UpdateBrandPayload } from "@pdv/shared";

export class BrandRepository {
  async findAll(productTypeId?: string) {
    return prisma.brand.findMany({
      where: {
        deleted_at: null,
        ...(productTypeId
          ? {
              products: {
                some: {
                  deleted_at: null,
                  product_type_id: productTypeId,
                },
              },
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string) {
    return prisma.brand.findFirst({
      where: { id, deleted_at: null },
    });
  }

  async findByName(name: string) {
    return prisma.brand.findFirst({
      where: {
        name,
        deleted_at: null,
      },
    });
  }

  async create(data: CreateBrandPayload) {
    return prisma.brand.create({ data });
  }

  async update(id: string, data: UpdateBrandPayload) {
    return prisma.brand.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return prisma.brand.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}