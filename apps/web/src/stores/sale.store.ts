import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { CreateSalePayload, SalePayment } from "@pdv/shared";
import { generateUUID } from "@/utils/generate-uuid.js";
import { useOfflineQueue } from "@/composables/use-offline-queue.js";
import { useWebSocket } from "@/composables/use-websocket.js";
import { useApi } from "@/composables/use-api.js";

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

const STORAGE_KEY = "pdv-sale-cart";

function loadPersistedState(): { items: CartItem[]; discountCents: number; saleUuid: string | null } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      return {
        items: parsed.items,
        discountCents: typeof parsed.discountCents === "number" ? parsed.discountCents : 0,
        saleUuid: parsed.saleUuid ?? null,
      };
    }
  } catch {
    // corrupted data — ignore
  }
  return null;
}

export const useSaleStore = defineStore("sale", () => {
  const persisted = loadPersistedState();

  const items = ref<CartItem[]>(persisted?.items ?? []);
  const discountCentsState = ref(persisted?.discountCents ?? 0);
  const saleUuid = ref<string | null>(persisted?.saleUuid ?? null);

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
    localStorage.removeItem(STORAGE_KEY);
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
    finalTotalCents?: number,
  ): CreateSalePayload {
    return {
      uuid: saleUuid.value ?? generateUUID(),
      terminal_id: terminalId,
      operator_id: operatorId,
      payment_method: paymentMethod as CreateSalePayload["payment_method"],
      discount_cents: discountCentsState.value,
      ...(typeof finalTotalCents === "number" ? { total_cents: finalTotalCents } : {}),
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

  function persistState(): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: items.value,
        discountCents: discountCentsState.value,
        saleUuid: saleUuid.value,
      }),
    );
  }

  watch([items, discountCentsState, saleUuid], persistState, { deep: true });

  const { enqueue, queueLength, isSyncing } = useOfflineQueue();
  const { isOnline } = useWebSocket();
  const { authenticatedFetch } = useApi();

  async function createSale(payload: CreateSalePayload) {
    if (!isOnline.value) {
      enqueue(payload);
      return { ok: true, status: 202, offline: true, payload };
    }

    return authenticatedFetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return {
    items,
    discountCents,
    saleUuid,
    subtotalCents,
    totalCents,
    queueLength,
    isSyncing,
    addItem,
    removeItem,
    updateItemQuantity,
    clearCart,
    applyChangeDiscount,
    removeChangeDiscount,
    buildPayload,
    createSale,
  };
});
