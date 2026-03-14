import type { CreateSalePayload, SalePayment } from "@pdv/shared";

type BuildPayloadFn = (
  terminalId: string,
  paymentMethod: string,
  operatorId: string,
  payments: SalePayment[],
  customerId?: string,
  finalTotalCents?: number,
) => CreateSalePayload;

interface BuildSalePayloadParams {
  terminalId: string;
  paymentMethod: string;
  operatorId: string;
  customerId?: string;
  finalTotalCents: number;
  payments: SalePayment[];
  buildPayload: BuildPayloadFn;
}

export function useSaleCalculator() {
  function calcCardRate(baseRate: number, incrementalRate: number, installments: number): number {
    const normalizedInstallments = Math.max(1, installments);
    return baseRate + (normalizedInstallments - 1) * incrementalRate;
  }

  function applyCardFee(totalCents: number, ratePercent: number): number {
    return Math.round(totalCents * (1 + ratePercent / 100));
  }

  function calcChange(paidCents: number, totalCents: number, discountCents: number): number {
    return Math.max(0, paidCents - (totalCents - discountCents));
  }

  function validateFiadoCredit(
    creditLimitCents: number,
    currentDebtCents: number,
    totalCents: number,
  ): { valid: boolean; availableCents: number } {
    const available = creditLimitCents - currentDebtCents;
    return { valid: available >= totalCents, availableCents: available };
  }

  function buildSalePayload(params: BuildSalePayloadParams): CreateSalePayload {
    const normalizedPayments = params.payments.map((payment) => ({ ...payment }));
    const paymentSum = normalizedPayments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    const excess = paymentSum - params.finalTotalCents;

    if (excess > 0) {
      const cashPayment = normalizedPayments.find((payment) => payment.method === "cash");

      if (cashPayment && cashPayment.amount_cents >= excess) {
        cashPayment.amount_cents -= excess;
      }
    }

    return params.buildPayload(
      params.terminalId,
      params.paymentMethod,
      params.operatorId,
      normalizedPayments,
      params.customerId,
      params.finalTotalCents,
    );
  }

  return {
    calcCardRate,
    applyCardFee,
    calcChange,
    validateFiadoCredit,
    buildSalePayload,
  };
}
