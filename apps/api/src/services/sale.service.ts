import { SaleRepository } from "../repositories/sale.repository.js";
import type { CreateSalePayload } from "@pdv/shared";

const saleRepository = new SaleRepository();

export class SaleService {
  async list() {
    return saleRepository.findAll();
  }

  async getById(id: string) {
    const sale = await saleRepository.findById(id);

    if (!sale) {
      throw new Error("Venda não encontrada");
    }

    return sale;
  }

  async create(payload: CreateSalePayload) {
    // Idempotência: rejeitar UUID duplicado
    const existing = await saleRepository.findByUuid(payload.uuid);

    if (existing) {
      return existing;
    }

    return saleRepository.create(payload);
  }

  async cancel(id: string) {
    return saleRepository.cancel(id);
  }

  async refund(id: string) {
    return saleRepository.refund(id);
  }
}
