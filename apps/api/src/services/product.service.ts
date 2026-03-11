import { ProductRepository } from "../repositories/product.repository.js";
import type { CreateProductPayload, UpdateProductPayload } from "@pdv/shared";
import { ProductTypeRepository } from "../repositories/product-type.repository.js";
import { BrandRepository } from "../repositories/brand.repository.js";

const productRepository = new ProductRepository();
const productTypeRepository = new ProductTypeRepository();
const brandRepository = new BrandRepository();

type BulkPricePayload = {
  product_type_id: string;
  brand_id?: string;
  profit_margin_percentage: number;
};

export class ProductService {
  async list(barcode?: string) {
    return productRepository.findAll(barcode);
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
      is_bulk: payload.is_bulk ?? false,
    });
  }

  async update(id: string, payload: UpdateProductPayload) {
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

    return productRepository.update(id, {
      ...payload,
      price_cents: resolvedPriceCents,
    });
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
}
