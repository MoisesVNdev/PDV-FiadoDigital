import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { CreateSalePayload } from "@pdv/shared";

type CartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
};

export const useSaleStore = defineStore("sale", () => {
  const items = ref<CartItem[]>([]);
  const discountCents = ref(0);
  const saleUuid = ref<string | null>(null);

  const subtotalCents = computed(() =>
    items.value.reduce(
      (sum, item) =>
        sum + item.unit_price_cents * item.quantity - item.discount_cents,
      0,
    ),
  );

  const totalCents = computed(() => subtotalCents.value - discountCents.value);

  function addItem(item: CartItem): void {
    const existing = items.value.find(
      (i) => i.product_id === item.product_id,
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

  function clearCart(): void {
    items.value = [];
    discountCents.value = 0;
    saleUuid.value = null;
  }

  function buildPayload(
    terminalId: string,
    paymentMethod: string,
    operatorId: string,
    customerId?: string,
  ): CreateSalePayload {
    return {
      uuid: saleUuid.value ?? crypto.randomUUID(),
      terminal_id: terminalId,
      operator_id: operatorId,
      payment_method: paymentMethod as CreateSalePayload["payment_method"],
      discount_cents: discountCents.value,
      customer_id: customerId,
      items: items.value.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        discount_cents: item.discount_cents,
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
    clearCart,
    buildPayload,
  };
});
