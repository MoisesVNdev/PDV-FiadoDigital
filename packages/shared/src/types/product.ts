export type Product = {
  id: string;
  name: string;
  barcode: string | null;
  description: string | null;
  price_cents: number;
  cost_price_cents: number;
  stock_quantity: number;
  min_stock_alert: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateProductPayload = {
  name: string;
  barcode?: string;
  description?: string;
  price_cents: number;
  cost_price_cents: number;
  stock_quantity: number;
  min_stock_alert: number;
};
