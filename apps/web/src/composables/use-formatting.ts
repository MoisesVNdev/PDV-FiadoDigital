import { formatCents, parseCentsFromString } from "@pdv/shared";

export function useFormatting() {
  function normalizePhoneDigits(rawValue: string): string {
    return rawValue.replace(/\D/g, "").slice(0, 11);
  }

  function formatPhoneForDisplay(rawValue: string | null): string {
    const digits = rawValue ? rawValue.replace(/\D/g, "").slice(0, 11) : "";

    if (!digits) {
      return "-";
    }

    if (digits.length < 3) {
      return `(${digits}`;
    }

    const areaCode = digits.slice(0, 2);
    const firstDigit = digits.slice(2, 3);
    const mid = digits.slice(3, 7);
    const end = digits.slice(7, 11);

    if (!firstDigit) {
      return `(${areaCode})`;
    }

    if (!mid) {
      return `(${areaCode}) ${firstDigit}`;
    }

    if (!end) {
      return `(${areaCode}) ${firstDigit} ${mid}`;
    }

    return `(${areaCode}) ${firstDigit} ${mid}-${end}`;
  }

  function formatPhoneForInput(rawValue: string): string {
    const digits = normalizePhoneDigits(rawValue);

    if (!digits) {
      return "";
    }

    if (digits.length < 3) {
      return `(${digits}`;
    }

    const areaCode = digits.slice(0, 2);
    const firstDigit = digits.slice(2, 3);
    const mid = digits.slice(3, 7);
    const end = digits.slice(7, 11);

    if (!mid) {
      return `(${areaCode}) ${firstDigit}`;
    }

    if (!end) {
      return `(${areaCode}) ${firstDigit} ${mid}`;
    }

    return `(${areaCode}) ${firstDigit} ${mid}-${end}`;
  }

  /**
   * Máscara de entrada para campos monetários.
   * Extrai apenas dígitos e aplica formatação de centavos.
   * Retorna "" para entrada vazia.
   */
  function formatCurrencyInput(rawValue: string): string {
    const digits = rawValue.replace(/\D/g, "");

    if (!digits) {
      return "";
    }

    return formatCents(Number.parseInt(digits, 10));
  }

  /**
   * Converte string de campo monetário em centavos. Retorna 0 para entrada vazia.
   * Adequado para uso em cálculos aritméticos (total, troco, taxa).
   */
  function parseCurrencyInputToCents(rawValue: string): number {
    if (!rawValue.trim()) {
      return 0;
    }

    return parseCentsFromString(rawValue);
  }

  /**
   * Converte string de campo monetário em centavos. Retorna null para entrada vazia.
   * Adequado para validação de formulários onde vazio ≠ zero.
   */
  function parseCurrencyInputToNullableCents(rawValue: string): number | null {
    const digitsOnly = rawValue.replace(/\D/g, "");

    if (!digitsOnly) {
      return null;
    }

    return parseCentsFromString(rawValue);
  }

  /**
   * Formata quantidade de estoque com unidade.
   * @param minDecimals - Casas decimais mínimas para produtos a granel (padrão 0, máx 3).
   *                      Passe 3 para forçar exibição de 3 casas fixas (ex: "1,500 kg").
   */
  function formatStockQuantity(quantity: number, isBulk: boolean, minDecimals = 0): string {
    if (isBulk) {
      return `${quantity.toLocaleString("pt-BR", {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: 3,
      })} kg`;
    }

    return `${Math.trunc(quantity)} un`;
  }

  function displayPercent(value: number, decimals = 2): string {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return {
    normalizePhoneDigits,
    formatPhoneForDisplay,
    formatPhoneForInput,
    formatCurrencyInput,
    parseCurrencyInputToCents,
    parseCurrencyInputToNullableCents,
    formatStockQuantity,
    displayPercent,
  };
}
