import type { PaymentMethod } from "../constants/payment-methods.js";

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
};

export type Sale = {
  id: string;
  uuid: string;
  operator_id: string;
  customer_id: string | null;
  terminal_id: string;
  payment_method: PaymentMethod;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  status: SaleStatus;
  items: SaleItem[];
  created_at: string;
  updated_at: string;
};

export type SaleStatus = "pending" | "completed" | "cancelled" | "refunded";

export type SalePayment = {
  method: PaymentMethod;
  amount_cents: number;
};

export type CreateSalePayload = {
  uuid: string;
  operator_id: string;
  customer_id?: string;
  terminal_id: string;
  payment_method: PaymentMethod;
  discount_cents: number;
  payments: SalePayment[];
  items: {
    product_id: string;
    quantity: number;
    unit_price_cents: number;
    discount_cents: number;
  }[];
};
