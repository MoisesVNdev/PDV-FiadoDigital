import { SaleRepository } from "../repositories/sale.repository.js";
import { broadcast } from "../websocket/index.js";
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

    const result = await saleRepository.create(payload);

    // Emitir alertas de estoque baixo via WebSocket
    if (result.lowStockProducts && result.lowStockProducts.length > 0) {
      for (const product of result.lowStockProducts) {
        broadcast({
          type: "stock.low_alert",
          payload: {
            productId: product.productId,
            productName: product.productName,
            stock_quantity: product.stock_quantity,
            min_stock_alert: product.min_stock_alert,
          },
        });
      }
    }

    return result.sale;
  }

  async cancel(id: string) {
    return saleRepository.cancel(id);
  }

  async refund(id: string) {
    return saleRepository.refund(id);
  }
}
