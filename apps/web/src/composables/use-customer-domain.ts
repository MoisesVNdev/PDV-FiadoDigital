import { formatCents } from "@pdv/shared";

type WhatsAppChargeType = "full" | "partial";

interface CustomerLike {
  id: string;
  name: string;
  phone: string | null;
  credit_limit_cents: number;
  current_debt_cents: number;
  payment_due_day: number | null;
  is_active: boolean;
}

interface PaymentHistoryLike {
  description: string | null;
  debt_before_cents: number | null;
}

interface CustomerFormLike {
  name: string;
  phone: string;
  creditLimitCents: number;
  paymentDueDay: string;
  isActive: boolean;
}

interface WhatsAppMessageOptions {
  customer: CustomerLike;
  chargeAmountCents: number;
  chargeType: WhatsAppChargeType;
  messageVencido: string;
  messageAVencer: string;
  messageDuePartial?: string;
  messageOverduePartial?: string;
}

function formatWhatsAppDueDate(day: number | null): string {
  if (!day) {
    return "Nao informado";
  }

  return `todo dia ${day}`;
}

export function useCustomerDomain() {
  function extractPaymentMetadata(row: PaymentHistoryLike): { type: "full" | "partial"; debtBefore: number | null } {
    if (!row.description) {
      return { type: "partial", debtBefore: row.debt_before_cents };
    }

    try {
      const parsed = JSON.parse(row.description) as { type?: string; debt_before?: number };

      return {
        type: parsed.type === "full" ? "full" : "partial",
        debtBefore: typeof parsed.debt_before === "number" ? parsed.debt_before : row.debt_before_cents,
      };
    } catch {
      return { type: "partial", debtBefore: row.debt_before_cents };
    }
  }

  function getPaymentHistoryTypeLabel(row: PaymentHistoryLike): string {
    const metadata = extractPaymentMetadata(row);
    return metadata.type === "full" ? "Completo" : "Parcial";
  }

  function getPaymentHistoryDebtBeforeCents(row: PaymentHistoryLike): number {
    const metadata = extractPaymentMetadata(row);
    return metadata.debtBefore ?? 0;
  }

  function buildCustomerPayload(form: CustomerFormLike, normalizePhoneDigits: (value: string) => string) {
    const paymentDueDay = form.paymentDueDay ? Number.parseInt(form.paymentDueDay, 10) : undefined;

    return {
      name: form.name.trim(),
      phone: normalizePhoneDigits(form.phone) || undefined,
      credit_limit_cents: form.creditLimitCents,
      payment_due_day: paymentDueDay,
      is_active: form.isActive,
    };
  }

  function buildWhatsAppChargeMessage(options: WhatsAppMessageOptions): string {
    const today = new Date();
    const dueDay = options.customer.payment_due_day;
    const isOverdue = dueDay === null || today.getDate() > dueDay;
    const isPartial = options.chargeType === "partial";
    const dueDate = formatWhatsAppDueDate(dueDay);

    let template = "";
    if (isPartial) {
      template = isOverdue 
        ? (options.messageOverduePartial || options.messageVencido) 
        : (options.messageDuePartial || options.messageAVencer);
    } else {
      template = isOverdue ? options.messageVencido : options.messageAVencer;
    }

    const totalDisplay = formatCents(options.customer.current_debt_cents);
    const chargeDisplay = formatCents(options.chargeAmountCents);

    return template
      .replace(/\[NOME\]/gi, options.customer.name)
      .replace(/\{nome\}/gi, options.customer.name)
      .replace(/\[TOTAL\]/gi, totalDisplay)
      .replace(/\[COBRANCA\]/gi, chargeDisplay)
      .replace(/\{valor\}/gi, chargeDisplay)
      .replace(/\[VENCIMENTO\]/gi, dueDate)
      .replace(/\{vencimento\}/gi, dueDate);
  }

  return {
    extractPaymentMetadata,
    getPaymentHistoryTypeLabel,
    getPaymentHistoryDebtBeforeCents,
    buildCustomerPayload,
    buildWhatsAppChargeMessage,
  };
}
