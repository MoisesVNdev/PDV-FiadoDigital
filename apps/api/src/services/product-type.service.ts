import { ProductTypeRepository } from "../repositories/product-type.repository.js";
import type { CreateProductTypePayload, UpdateProductTypePayload } from "@pdv/shared";

const productTypeRepository = new ProductTypeRepository();

export class ProductTypeService {
  async list() {
    return productTypeRepository.findAll();
  }

  async create(payload: CreateProductTypePayload) {
    const normalizedName = payload.name.trim();

    if (!normalizedName) {
      throw new Error("Nome do tipo de produto é obrigatório");
    }

    const existing = await productTypeRepository.findByName(normalizedName);

    if (existing) {
      throw new Error("Tipo de produto já existe");
    }

    return productTypeRepository.create({
      name: normalizedName,
      profit_margin: this.normalizeProfitMargin(payload.profit_margin),
    });
  }

  async update(id: string, payload: UpdateProductTypePayload) {
    const productType = await productTypeRepository.findById(id);

    if (!productType) {
      throw new Error("Tipo de produto não encontrado");
    }

    if (typeof payload.name === "string") {
      const normalizedName = payload.name.trim();

      if (!normalizedName) {
        throw new Error("Nome do tipo de produto é obrigatório");
      }

      const existing = await productTypeRepository.findByName(normalizedName);

      if (existing && existing.id !== id) {
        throw new Error("Tipo de produto já existe");
      }

      return productTypeRepository.update(id, {
        name: normalizedName,
        ...(payload.profit_margin !== undefined
          ? { profit_margin: this.normalizeProfitMargin(payload.profit_margin) }
          : {}),
      });
    }

    if (payload.profit_margin !== undefined) {
      return productTypeRepository.update(id, {
        profit_margin: this.normalizeProfitMargin(payload.profit_margin),
      });
    }

    return productType;
  }

  async deactivate(id: string) {
    const productType = await productTypeRepository.findById(id);

    if (!productType) {
      throw new Error("Tipo de produto não encontrado");
    }

    return productTypeRepository.softDelete(id);
  }

  private normalizeProfitMargin(margin?: number | null): number | null {
    if (margin === null || margin === undefined) {
      return null;
    }

    return margin / 100;
  }
}
