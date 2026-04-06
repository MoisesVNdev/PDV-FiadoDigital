import { ProductRepository } from "../repositories/product.repository.js";
import type { CreateProductPayload, ProductQueryParams, UpdateProductPayload } from "@pdv/shared";
import { ProductTypeRepository } from "../repositories/product-type.repository.js";
import { BrandRepository } from "../repositories/brand.repository.js";
import { StockMovementRepository } from "../repositories/stock-movement.repository.js";

const productRepository = new ProductRepository();
const productTypeRepository = new ProductTypeRepository();
const brandRepository = new BrandRepository();
const stockMovementRepository = new StockMovementRepository();
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
const auditLogRepository = new AuditLogRepository();

type BulkPricePayload = {
  product_type_id: string;
  brand_id?: string;
  profit_margin_percentage: number;
};

type UpdateProductWithStockPayload = UpdateProductPayload & {
  stock_entry_quantity?: number;
  stock_entry_unit_cost_cents?: number;
  stock_entry_description?: string;
};

export class ProductService {
  async list(params: ProductQueryParams) {
    return productRepository.findAll(params);
  }

  async getById(id: string) {
    const product = await productRepository.findById(id);

    if (!product) {
      throw new Error("Produto não encontrado");
    }

    return product;
  }

  async create(payload: CreateProductPayload) {
    if (payload.barcode) {
      const existingByBarcode = await productRepository.findByBarcode(payload.barcode);

      if (existingByBarcode) {
        throw new Error("Código de barras já existe");
      }
    }

    const productType = payload.product_type_id
      ? await productTypeRepository.findById(payload.product_type_id)
      : null;

    if (payload.product_type_id) {
      if (!productType) {
        throw new Error("Tipo de produto não encontrado");
      }
    }

    if (payload.brand_id) {
      const brand = await brandRepository.findById(payload.brand_id);

      if (!brand) {
        throw new Error("Marca não encontrada");
      }
    }

    if (typeof payload.profit_margin === "number") {
      if (payload.profit_margin <= 0 || payload.profit_margin >= 1) {
        throw new Error("Margem de lucro deve estar entre 0 e 1");
      }
    }

    const resolvedPriceCents = this.resolvePriceCents(
      payload.price_cents,
      payload.cost_price_cents,
      productType?.profit_margin ?? null,
    );

    return productRepository.create({
      ...payload,
      price_cents: resolvedPriceCents,
      average_cost_cents: payload.average_cost_cents ?? payload.cost_price_cents,
      is_bulk: payload.is_bulk ?? false,
    });
  }

  async update(id: string, payload: UpdateProductWithStockPayload, operatorId?: string) {
    if (payload.barcode) {
      const existingByBarcode = await productRepository.findByBarcode(payload.barcode);

      if (existingByBarcode && existingByBarcode.id !== id) {
        throw new Error("Código de barras já existe");
      }
    }

    const currentProduct = await productRepository.findById(id);

    if (!currentProduct) {
      throw new Error("Produto não encontrado");
    }

    const nextProductTypeId = payload.product_type_id ?? currentProduct.product_type_id ?? undefined;

    const productType = nextProductTypeId
      ? await productTypeRepository.findById(nextProductTypeId)
      : null;

    if (payload.product_type_id) {
      if (!productType) {
        throw new Error("Tipo de produto não encontrado");
      }
    }

    if (payload.brand_id) {
      const brand = await brandRepository.findById(payload.brand_id);

      if (!brand) {
        throw new Error("Marca não encontrada");
      }
    }

    if (typeof payload.profit_margin === "number") {
      if (payload.profit_margin <= 0 || payload.profit_margin >= 1) {
        throw new Error("Margem de lucro deve estar entre 0 e 1");
      }
    }

    const nextCostPriceCents = payload.cost_price_cents ?? currentProduct.cost_price_cents;
    const resolvedPriceCents = this.resolvePriceCents(
      payload.price_cents,
      nextCostPriceCents,
      productType?.profit_margin ?? null,
      currentProduct.price_cents,
    );

    const entryQuantityFromStock = this.resolveEntryQuantityFromStockDelta(
      currentProduct.stock_quantity,
      payload.stock_quantity,
    );
    const entryQuantity = payload.stock_entry_quantity ?? entryQuantityFromStock;

    const entryUnitCostCents =
      payload.stock_entry_unit_cost_cents ??
      payload.cost_price_cents ??
      currentProduct.average_cost_cents ??
      currentProduct.cost_price_cents;

    const resolvedEntryUnitCostCents = entryUnitCostCents > 0
      ? entryUnitCostCents
      : currentProduct.cost_price_cents;

    const nextAverageCostCents = this.resolveAverageCostAfterEntry({
      currentStock: currentProduct.stock_quantity,
      currentAverageCostCents: currentProduct.average_cost_cents,
      entryQuantity,
      entryUnitCostCents: resolvedEntryUnitCostCents,
    });

    const updatedProduct = await productRepository.update(id, {
      ...payload,
      price_cents: resolvedPriceCents,
      average_cost_cents: nextAverageCostCents,
    });

    if (resolvedPriceCents !== currentProduct.price_cents && operatorId) {
      await auditLogRepository.create({
        action: "product_price_updated",
        actor_id: operatorId,
        entity_type: "product",
        entity_id: id,
        details: { old_price_cents: currentProduct.price_cents, new_price_cents: resolvedPriceCents, product_id: id },
      });
    }

    if (entryQuantity > 0 && operatorId) {
      await stockMovementRepository.create({
        product_id: id,
        type: "entry",
        quantity: entryQuantity,
        unit_cost_cents: resolvedEntryUnitCostCents,
        description: payload.stock_entry_description ?? "Entrada de estoque",
        operator_id: operatorId,
      });
    }

    return updatedProduct;
  }

  async bulkUpdatePrice(payload: BulkPricePayload) {
    const productType = await productTypeRepository.findById(payload.product_type_id);

    if (!productType) {
      throw new Error("Tipo de produto não encontrado");
    }

    if (payload.brand_id) {
      const brand = await brandRepository.findById(payload.brand_id);

      if (!brand) {
        throw new Error("Marca não encontrada");
      }
    }

    const profitMargin = payload.profit_margin_percentage / 100;

    if (profitMargin <= 0 || profitMargin >= 1) {
      throw new Error("Margem de lucro deve estar entre 1% e 99%");
    }

    const products = await productRepository.findForBulkPricing(payload.product_type_id, payload.brand_id);

    if (products.length === 0) {
      return { updated_count: 0 };
    }

    for (const product of products) {
      const calculatedPrice = Math.round(product.cost_price_cents / (1 - profitMargin));
      await productRepository.updatePricing(product.id, calculatedPrice, profitMargin);
    }

    return { updated_count: products.length };
  }

  async deactivate(id: string) {
    return productRepository.softDelete(id);
  }

  private resolvePriceCents(
    informedPriceCents: number | undefined,
    costPriceCents: number,
    productTypeProfitMargin: number | null,
    fallbackPriceCents = 0,
  ): number {
    if (typeof informedPriceCents === "number") {
      return informedPriceCents;
    }

    if (typeof productTypeProfitMargin === "number" && productTypeProfitMargin > 0 && productTypeProfitMargin < 1) {
      return Math.round(costPriceCents / (1 - productTypeProfitMargin));
    }

    return fallbackPriceCents;
  }

  private resolveEntryQuantityFromStockDelta(currentStock: number, nextStock?: number): number {
    if (typeof nextStock !== "number") {
      return 0;
    }

    const delta = nextStock - currentStock;

    if (delta <= 0) {
      return 0;
    }

    return delta;
  }

  private resolveAverageCostAfterEntry(input: {
    currentStock: number;
    currentAverageCostCents: number;
    entryQuantity: number;
    entryUnitCostCents: number;
  }): number {
    if (!Number.isFinite(input.entryQuantity) || input.entryQuantity <= 0) {
      return input.currentAverageCostCents;
    }

    const denominator = input.currentStock + input.entryQuantity;

    if (denominator <= 0) {
      return 0;
    }

    const weightedTotal =
      input.currentStock * input.currentAverageCostCents +
      input.entryQuantity * input.entryUnitCostCents;

    return Math.round(weightedTotal / denominator);
  }
}
