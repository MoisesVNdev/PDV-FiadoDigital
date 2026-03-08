/**
 * Formata valor em centavos para exibição em Real (pt-BR).
 * Ex.: 1050 → "R$ 10,50"
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * Converte string com vírgula para centavos inteiros.
 * Ex.: "10,50" → 1050
 */
export function parseCentsFromString(value: string): number {
  const sanitized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = parseFloat(sanitized);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

/**
 * Soma segura de valores em centavos.
 */
export function sumCents(...values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}
