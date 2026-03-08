export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  credit_limit_cents: number;
  current_debt_cents: number;
  payment_due_day: number | null;
  credit_blocked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateCustomerPayload = {
  name: string;
  phone?: string;
  email?: string;
  credit_limit_cents: number;
  payment_due_day?: number;
  is_active?: boolean;
};
