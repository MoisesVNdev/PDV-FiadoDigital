import { describe, expect, it } from "vitest";
import { useSaleCalculator } from "../use-sale-calculator.js";

describe("useSaleCalculator", () => {
  const calculator = useSaleCalculator();

  it("calcula taxa de cartão progressiva por parcelas", () => {
    expect(calculator.calcCardRate(2, 0.5, 1)).toBe(2);
    expect(calculator.calcCardRate(2, 0.5, 4)).toBe(3.5);
    expect(calculator.calcCardRate(2, 0.5, 0)).toBe(2);
  });

  it("aplica taxa no total em centavos", () => {
    expect(calculator.applyCardFee(10000, 2.5)).toBe(10250);
    expect(calculator.applyCardFee(0, 2.5)).toBe(0);
  });

  it("calcula troco respeitando limite mínimo zero", () => {
    expect(calculator.calcChange(5000, 4000, 0)).toBe(1000);
    expect(calculator.calcChange(3000, 4000, 0)).toBe(0);
    expect(calculator.calcChange(3950, 4000, 100)).toBe(50);
  });

  it("valida crédito do fiado com saldo disponível", () => {
    expect(calculator.validateFiadoCredit(10000, 4000, 5000)).toEqual({ valid: true, availableCents: 6000 });
    expect(calculator.validateFiadoCredit(10000, 4000, 7000)).toEqual({ valid: false, availableCents: 6000 });
  });

  it("normaliza excesso de pagamento em dinheiro ao montar payload", () => {
    const payload = calculator.buildSalePayload({
      terminalId: "PDV-01",
      paymentMethod: "mixed",
      operatorId: "op-1",
      customerId: "c-1",
      finalTotalCents: 1000,
      payments: [
        { method: "cash", amount_cents: 1200 },
        { method: "pix", amount_cents: 0 },
      ],
      buildPayload: (_terminalId, _paymentMethod, _operatorId, payments) => ({
        uuid: "uuid-1",
        terminal_id: "PDV-01",
        operator_id: "op-1",
        payment_method: "mixed",
        discount_cents: 0,
        total_cents: 1000,
        payments,
        customer_id: "c-1",
        items: [],
      }),
    });

    expect(payload.payments.find((p) => p.method === "cash")?.amount_cents).toBe(1000);
  });
});
