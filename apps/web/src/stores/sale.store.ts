import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { CreateSalePayload, SalePayment } from "@pdv/shared";

type CartItem = {
  product_id: string;
  product_name: string;
  product_barcode?: string | null;
  product_description?: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents?: number;
  is_bulk?: boolean;
  discount_cents: number;
  stock_quantity: number;
};

export const useSaleStore = defineStore("sale", () => {
  const items = ref<CartItem[]>([]);
  const discountCentsState = ref(0);
  const saleUuid = ref<string | null>(null);

  const subtotalCents = computed(() =>
    items.value.reduce(
      (sum, item) => {
        const lineTotal = item.is_bulk
          ? item.total_cents ?? Math.round(item.unit_price_cents * item.quantity)
          : item.unit_price_cents * item.quantity;

        return sum + lineTotal - item.discount_cents;
      },
      0,
    ),
  );

  const discountCents = computed(() => discountCentsState.value);
  const totalCents = computed(() => subtotalCents.value - discountCentsState.value);

  function addItem(item: CartItem): void {
    if (item.is_bulk) {
      items.value.push(item);
      return;
    }

    const existing = items.value.find(
      (i) =>
        i.product_id === item.product_id &&
        i.unit_price_cents === item.unit_price_cents &&
        i.discount_cents === item.discount_cents,
    );

    if (existing) {
      existing.quantity += item.quantity;
      return;
    }

    items.value.push(item);
  }

  function removeItem(productId: string): void {
    items.value = items.value.filter((i) => i.product_id !== productId);
  }

  function updateItemQuantity(productId: string, newQuantity: number): void {
    const item = items.value.find((i) => i.product_id === productId);
    
    if (!item) {
      return;
    }

    if (newQuantity <= 0) {
      removeItem(productId);
      return;
    }

    item.quantity = newQuantity;
  }

  function clearCart(): void {
    items.value = [];
    discountCentsState.value = 0;
    saleUuid.value = null;
  }

  function applyChangeDiscount(cents: number): void {
    if (!Number.isInteger(cents) || cents <= 0 || cents > 99) {
      throw new Error("Desconto de troco inválido.");
    }

    discountCentsState.value = cents;
  }

  function removeChangeDiscount(): void {
    discountCentsState.value = 0;
  }

  function buildPayload(
    terminalId: string,
    paymentMethod: string,
    operatorId: string,
    payments: SalePayment[],
    customerId?: string,
  ): CreateSalePayload {
    return {
      uuid: saleUuid.value ?? crypto.randomUUID(),
      terminal_id: terminalId,
      operator_id: operatorId,
      payment_method: paymentMethod as CreateSalePayload["payment_method"],
      discount_cents: discountCentsState.value,
      payments,
      customer_id: customerId,
      items: items.value.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        discount_cents: item.discount_cents,
        is_bulk: item.is_bulk,
      })),
    };
  }

  return {
    items,
    discountCents,
    saleUuid,
    subtotalCents,
    totalCents,
    addItem,
    removeItem,
    updateItemQuantity,
    clearCart,
    applyChangeDiscount,
    removeChangeDiscount,
    buildPayload,
  };
});
