import { CashRegisterRepository } from "../repositories/cash-register.repository.js";

const cashRegisterRepository = new CashRegisterRepository();

export class CashRegisterService {
  async list() {
    return cashRegisterRepository.findAll();
  }

  async getCurrent(terminalId: string) {
    return cashRegisterRepository.findOpenByTerminal(terminalId);
  }

  async open(payload: { terminal_id: string; opening_balance_cents: number; operator_id: string }) {
    const existing = await cashRegisterRepository.findOpenByTerminal(
      payload.terminal_id,
    );

    if (existing) {
      throw new Error("Já existe um caixa aberto neste terminal");
    }

    return cashRegisterRepository.create(payload);
  }

  async close(payload: { id: string; closing_balance_cents: number }) {
    return cashRegisterRepository.close(payload.id, payload.closing_balance_cents);
  }

  async cashOut(payload: {
    cash_register_id: string;
    amount_cents: number;
    description: string;
  }) {
    return cashRegisterRepository.cashOut(
      payload.cash_register_id,
      payload.amount_cents,
      payload.description,
    );
  }
}
