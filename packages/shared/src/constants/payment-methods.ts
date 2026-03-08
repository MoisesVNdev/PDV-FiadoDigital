export const PAYMENT_METHODS = {
  CASH: "cash",
  PIX: "pix",
  CREDIT_CARD: "credit_card",
  DEBIT_CARD: "debit_card",
  FIADO: "fiado",
  MIXED: "mixed",
} as const;

export type PaymentMethod =
  (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
