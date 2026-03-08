export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  credit_limit_cents: number;
  current_debt_cents: number;
  credit_blocked: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateCustomerPayload = {
  name: string;
  phone?: string;
  email?: string;
  credit_limit_cents: number;
};
