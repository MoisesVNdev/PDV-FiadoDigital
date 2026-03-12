export type CardMachineRate = {
  id: string;
  card_machine_id: string;
  debit_rate: number;
  credit_base_rate: number;
  credit_incremental_rate: number;
  max_installments: number;
  created_at: string;
  updated_at: string;
};

export type CardMachine = {
  id: string;
  name: string;
  is_active: boolean;
  absorb_fee: boolean;
  rates: CardMachineRate[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateCardMachinePayload = {
  name: string;
  is_active: boolean;
  absorb_fee: boolean;
  rates: {
    debit_rate: number;
    credit_base_rate: number;
    credit_incremental_rate: number;
    max_installments: number;
  };
};

export type UpdateCardMachinePayload = Partial<CreateCardMachinePayload>;

