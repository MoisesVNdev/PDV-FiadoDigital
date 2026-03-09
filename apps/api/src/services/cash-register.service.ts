import { CashRegisterRepository } from "../repositories/cash-register.repository.js";

const cashRegisterRepository = new CashRegisterRepository();

export class CashRegisterService {
  async list() {
    return cashRegisterRepository.findAll();
  }

  async getCurrent(terminalId: string) {
    return cashRegisterRepository.findOpenByTerminal(terminalId);
  }

  async open(payload: {
    terminal_id: string;
    opening_balance_cents: number;
    operator_id: string;
  }) {
    if (!payload.terminal_id || !payload.operator_id) {
      throw new Error("Dados inválidos");
    }

    if (!Number.isInteger(payload.opening_balance_cents) || payload.opening_balance_cents < 0) {
      throw new Error("Valor de abertura inválido");
    }

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
    operator_id: string;
  }) {
    if (!Number.isInteger(payload.amount_cents) || payload.amount_cents <= 0) {
      throw new Error("Valor inválido");
    }

    if (!payload.operator_id) {
      throw new Error("Operador inválido");
    }

    return cashRegisterRepository.cashOut(
      payload.cash_register_id,
      payload.amount_cents,
      payload.description,
      payload.operator_id,
    );
  }

  async cashIn(payload: {
    cash_register_id: string;
    amount_cents: number;
    description: string;
    operator_id: string;
  }) {
    if (!Number.isInteger(payload.amount_cents) || payload.amount_cents <= 0) {
      throw new Error("Valor inválido");
    }

    if (!payload.operator_id) {
      throw new Error("Operador inválido");
    }

    return cashRegisterRepository.cashIn(
      payload.cash_register_id,
      payload.amount_cents,
      payload.description,
      payload.operator_id,
    );
  }
}
