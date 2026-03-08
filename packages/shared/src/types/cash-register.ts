export type CashRegister = {
  id: string;
  operator_id: string;
  terminal_id: string;
  opening_balance_cents: number;
  closing_balance_cents: number | null;
  expected_balance_cents: number | null;
  difference_cents: number | null;
  status: CashRegisterStatus;
  opened_at: string;
  closed_at: string | null;
};

export type CashRegisterStatus = "open" | "closed";

export type OpenCashRegisterPayload = {
  terminal_id: string;
  opening_balance_cents: number;
};
