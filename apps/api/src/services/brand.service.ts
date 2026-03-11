import { BrandRepository } from "../repositories/brand.repository.js";
import type { CreateBrandPayload, UpdateBrandPayload } from "@pdv/shared";

const brandRepository = new BrandRepository();

export class BrandService {
  async list(productTypeId?: string) {
    return brandRepository.findAll(productTypeId);
  }

  async create(payload: CreateBrandPayload) {
    const normalizedName = payload.name.trim();

    if (!normalizedName) {
      throw new Error("Nome da marca é obrigatório");
    }

    const existing = await brandRepository.findByName(normalizedName);

    if (existing) {
      throw new Error("Marca já existe");
    }

    return brandRepository.create({ name: normalizedName });
  }

  async update(id: string, payload: UpdateBrandPayload) {
    const brand = await brandRepository.findById(id);

    if (!brand) {
      throw new Error("Marca não encontrada");
    }

    if (typeof payload.name === "string") {
      const normalizedName = payload.name.trim();

      if (!normalizedName) {
        throw new Error("Nome da marca é obrigatório");
      }

      const existing = await brandRepository.findByName(normalizedName);

      if (existing && existing.id !== id) {
        throw new Error("Marca já existe");
      }

      return brandRepository.update(id, { name: normalizedName });
    }

    return brand;
  }

  async deactivate(id: string) {
    const brand = await brandRepository.findById(id);

    if (!brand) {
      throw new Error("Marca não encontrada");
    }

    return brandRepository.softDelete(id);
  }
}