import type { PaymentMethod } from "@pdv/shared";

export interface PaymentMethodRow {
  method: PaymentMethod;
}

export interface PrintFallbackResult {
  usedFallback: boolean;
  message: string | null;
}

const PRINT_FALLBACK_MESSAGE =
  "Impressao automatica indisponivel. Use a janela do navegador para concluir o comprovante.";

export function useSaleDomain() {
  function resolvePaymentMethod(rows: readonly PaymentMethodRow[], mixedMethodValue: string): string {
    const uniqueMethods = Array.from(new Set(rows.map((row) => row.method)));

    if (uniqueMethods.length > 1) {
      return mixedMethodValue;
    }

    return uniqueMethods[0] ?? mixedMethodValue;
  }

  async function requestReceiptPrint(
    payload: Record<string, unknown>,
    onFallbackVisible?: (message: string) => void,
  ): Promise<PrintFallbackResult> {
    void payload;

    // B-01 resolvido: fallback oficial
    onFallbackVisible?.(PRINT_FALLBACK_MESSAGE);
    window.print();

    return {
      usedFallback: true,
      message: PRINT_FALLBACK_MESSAGE,
    };
  }

  return {
    resolvePaymentMethod,
    requestReceiptPrint,
  };
}
