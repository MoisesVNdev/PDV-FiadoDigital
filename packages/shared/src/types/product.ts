import type { ProductType } from "./product-type.js";
import type { Brand } from "./brand.js";

export type Product = {
  id: string;
  name: string;
  barcode: string | null;
  brand_id: string | null;
  brand: Brand | null;
  description: string | null;
  weight_value: number | null;
  weight_unit: ProductWeightUnit | null;
  product_type_id: string | null;
  product_type: ProductType | null;
  profit_margin: number | null;
  price_cents: number;
  cost_price_cents: number;
  stock_quantity: number;
  min_stock_alert: number;
  is_bulk: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductWeightUnit = "kg" | "g" | "L" | "ml" | "un";

export type CreateProductPayload = {
  name: string;
  brand_id?: string;
  barcode?: string;
  description?: string;
  weight_value?: number;
  weight_unit?: ProductWeightUnit;
  product_type_id?: string;
  profit_margin?: number;
  price_cents?: number;
  cost_price_cents: number;
  stock_quantity: number;
  min_stock_alert: number;
  is_bulk?: boolean;
  is_active?: boolean;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;
