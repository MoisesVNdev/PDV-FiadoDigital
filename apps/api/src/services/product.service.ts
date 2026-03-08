import { ProductRepository } from "../repositories/product.repository.js";
import type { CreateProductPayload } from "@pdv/shared";

const productRepository = new ProductRepository();

export class ProductService {
  async list() {
    return productRepository.findAll();
  }

  async getById(id: string) {
    const product = await productRepository.findById(id);

    if (!product) {
      throw new Error("Produto não encontrado");
    }

    return product;
  }

  async create(payload: CreateProductPayload) {
    return productRepository.create(payload);
  }

  async update(id: string, payload: Partial<CreateProductPayload>) {
    return productRepository.update(id, payload);
  }

  async deactivate(id: string) {
    return productRepository.softDelete(id);
  }
}
