import { CashRegisterRepository } from "../repositories/cash-register.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { NotificationService } from "./notification.service.js";
import { formatCents, NOTIFICATION_SEVERITIES, NOTIFICATION_TYPES } from "@pdv/shared";
import type { CashRegisterQueryParams } from "../repositories/cash-register.repository.js";
import { badRequest, conflict } from "../errors/domain-error.js";

const cashRegisterRepository = new CashRegisterRepository();
const settingsRepository = new SettingsRepository();
const notificationService = new NotificationService();
const CASH_REGISTER_ALERT_AMOUNT_SETTING = "cash_register_alert_amount_cents";

export class CashRegisterService {
  async list(options: CashRegisterQueryParams) {
    return cashRegisterRepository.findAll(options);
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
      throw badRequest("Dados inválidos");
    }

    if (!Number.isInteger(payload.opening_balance_cents) || payload.opening_balance_cents < 0) {
      throw badRequest("Valor de abertura inválido");
    }

    const existing = await cashRegisterRepository.findOpenByTerminal(
      payload.terminal_id,
    );

    if (existing) {
      throw conflict("Já existe um caixa aberto neste terminal");
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
      throw badRequest("Valor inválido");
    }

    if (!payload.operator_id) {
      throw badRequest("Operador inválido");
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
      throw badRequest("Valor inválido");
    }

    if (!payload.operator_id) {
      throw badRequest("Operador inválido");
    }

    const updatedRegister = await cashRegisterRepository.cashIn(
      payload.cash_register_id,
      payload.amount_cents,
      payload.description,
      payload.operator_id,
    );

    await this.notifyCashRegisterAmountReached(updatedRegister.terminal_id);

    return updatedRegister;
  }

  private async notifyCashRegisterAmountReached(terminalId: string) {
    const thresholdSetting = await settingsRepository.findByKey(CASH_REGISTER_ALERT_AMOUNT_SETTING);
    const threshold = Number.parseInt(thresholdSetting?.value ?? "0", 10) || 0;

    if (threshold <= 0) {
      return;
    }

    const balance = await cashRegisterRepository.getCurrentCashBalanceByTerminal(terminalId);

    if (!balance) {
      return;
    }

    if (balance.totalCashCents < threshold) {
      return;
    }

    notificationService.create({
      type: NOTIFICATION_TYPES.CASH_REGISTER_AMOUNT_REACHED,
      severity: NOTIFICATION_SEVERITIES.MEDIUM,
      title: "Valor de caixa atingiu limite de alerta",
      message: `O caixa em dinheiro do terminal atingiu ${formatCents(balance.totalCashCents)}, acima do valor de alerta configurado (${formatCents(threshold)}).`,
      meta: JSON.stringify({ terminalId, redirectPath: "/control" }),
      target_roles: ["admin", "manager"],
    }).catch((err: unknown) => console.error("[Notification] Erro ao criar notificação de caixa:", err));
  }
}
