import { SaleRepository } from "../repositories/sale.repository.js";
import { CustomerRepository } from "../repositories/customer.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { CashRegisterRepository } from "../repositories/cash-register.repository.js";
import { AuthService } from "./auth.service.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { NotificationService } from "./notification.service.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { broadcast } from "../websocket/index.js";
import { formatCents, PAYMENT_METHODS, NOTIFICATION_TYPES, NOTIFICATION_SEVERITIES } from "@pdv/shared";
import type { CreateSalePayload } from "@pdv/shared";
import type { DynamicStockAlertSettingKey } from "@pdv/shared";
import type { SaleQueryParams } from "../repositories/sale.repository.js";
import {
  badRequest,
  forbidden,
  notFound,
  unprocessable,
} from "../errors/domain-error.js";

const saleRepository = new SaleRepository();
const customerRepository = new CustomerRepository();
const productRepository = new ProductRepository();
const cashRegisterRepository = new CashRegisterRepository();
const authService = new AuthService();
const auditLogRepository = new AuditLogRepository();
const notificationService = new NotificationService();
const settingsRepository = new SettingsRepository();

const REFUND_ALERT_LIMIT_SETTING = "refund_alert_limit_cents";
const DISCOUNT_LIMIT_DAILY_SETTING = "discount_limit_daily";
const DISCOUNT_LIMIT_WEEKLY_SETTING = "discount_limit_weekly";
const DISCOUNT_LIMIT_MONTHLY_SETTING = "discount_limit_monthly";
const CASH_REGISTER_ALERT_AMOUNT_SETTING = "cash_register_alert_amount_cents";
const FIADO_ALERT_AT_90_PERCENT_SETTING = "fiado_alert_at_90_percent";

export class SaleService {
  async list(params: SaleQueryParams) {
    return saleRepository.findAll(params);
  }

  async getById(id: string) {
    const sale = await saleRepository.findById(id);

    if (!sale) {
      throw notFound("Venda não encontrada");
    }

    return sale;
  }

  async create(payload: CreateSalePayload) {
    // Idempotência: rejeitar UUID duplicado
    const existing = await saleRepository.findByUuid(payload.uuid);

    if (existing) {
      return existing;
    }

    const subtotalCents = payload.items.reduce(
      (sum, item) =>
        sum + Math.round(item.unit_price_cents * item.quantity) - item.discount_cents,
      0,
    );
    const baseTotalCents = subtotalCents - payload.discount_cents;
    const totalCents = payload.total_cents ?? baseTotalCents;
    const paymentTotalCents = payload.payments.reduce(
      (sum, payment) => sum + payment.amount_cents,
      0,
    );
    const uniquePaymentMethodsCount = new Set(
      payload.payments.map((payment) => payment.method),
    ).size;

    if (payload.payments.length === 0) {
      throw badRequest("Dados inválidos: É obrigatório informar ao menos um pagamento.");
    }

    if (payload.payments.length > 2 || uniquePaymentMethodsCount > 2) {
      throw badRequest("Dados inválidos: A venda permite no máximo 2 meios de pagamento distintos.");
    }

    if (uniquePaymentMethodsCount !== payload.payments.length) {
      throw badRequest("Dados inválidos: Não é permitido repetir o mesmo meio de pagamento.");
    }

    if (paymentTotalCents !== totalCents) {
      throw badRequest("Dados inválidos: A soma dos pagamentos deve ser igual ao total da venda.");
    }

    const hasMultipleMethods = uniquePaymentMethodsCount > 1;

    if (hasMultipleMethods && payload.payment_method !== PAYMENT_METHODS.MIXED) {
      throw badRequest("Dados inválidos: payment_method deve ser 'mixed' quando houver mais de um meio de pagamento.");
    }

    if (!hasMultipleMethods && payload.payment_method === PAYMENT_METHODS.MIXED) {
      throw badRequest("Dados inválidos: payment_method não pode ser 'mixed' com apenas um meio de pagamento.");
    }

    // Validar limite de crédito quando houver pagamento no fiado
    const fiadoPayments = payload.payments.filter(
      (payment) => payment.method === PAYMENT_METHODS.FIADO,
    );

    if (fiadoPayments.length > 0) {
      if (!payload.customer_id) {
        throw badRequest("Dados inválidos: Cliente é obrigatório para pagamento no fiado.");
      }

      const customer = await customerRepository.findById(payload.customer_id);

      if (!customer) {
        throw notFound("Cliente não encontrado");
      }

      if (!customer.is_active) {
        throw badRequest("Não é possível registrar uma venda para um cliente inativo.");
      }

      if (customer.credit_blocked) {
        throw forbidden("Dados inválidos: Cliente com crédito bloqueado não pode comprar no fiado.");
      }

      const fiadoTotalCents = fiadoPayments.reduce(
        (sum, payment) => sum + payment.amount_cents,
        0,
      );
      const availableCredit = customer.credit_limit_cents - customer.current_debt_cents;

      if (fiadoTotalCents > availableCredit) {
        throw unprocessable(`Saldo de crédito insuficiente. Disponível: ${formatCents(availableCredit)}.`);
      }
    } else if (payload.customer_id) {
      const customer = await customerRepository.findById(payload.customer_id);

      if (customer && !customer.is_active) {
        throw badRequest("Não é possível registrar uma venda para um cliente inativo.");
      }
    }

    const result = await saleRepository.create(payload);

    // Emitir notificações de estoque baixo
    if (result.lowStockProducts && result.lowStockProducts.length > 0) {
      for (const product of result.lowStockProducts) {
        broadcast({
          type: "stock.low_alert",
          payload: {
            productId: product.productId,
            productName: product.productName,
            stock_quantity: product.stock_quantity,
            min_stock_alert: product.min_stock_alert,
          },
        });
        notificationService.create({
          type: NOTIFICATION_TYPES.STOCK_LOW,
          severity: NOTIFICATION_SEVERITIES.HIGH,
          title: `Estoque baixo: ${product.productName}`,
          message: `O produto "${product.productName}" atingiu o estoque mínimo (${product.min_stock_alert} un).`,
          meta: JSON.stringify({ productId: product.productId, redirectPath: "/products" }),
          target_roles: ["admin", "manager"],
        }).catch((err: unknown) => console.error("[Notification] Erro ao criar notificação de estoque:", err));
      }
    }

    // Notificações de fiado — checar limite do cliente após persistência
    if (fiadoPayments.length > 0 && payload.customer_id) {
      const updatedCustomer = await customerRepository.findById(payload.customer_id);
      const fiadoAlertAtNinetySetting = await settingsRepository.findByKey(FIADO_ALERT_AT_90_PERCENT_SETTING);
      const shouldNotifyFiadoAtNinety = fiadoAlertAtNinetySetting?.value !== "false";

      if (updatedCustomer && updatedCustomer.credit_limit_cents > 0) {
        const usagePercent =
          (updatedCustomer.current_debt_cents / updatedCustomer.credit_limit_cents) * 100;

        if (usagePercent >= 100) {
          notificationService.create({
            type: NOTIFICATION_TYPES.FIADO_LIMIT_REACHED,
            severity: NOTIFICATION_SEVERITIES.HIGH,
            title: `Limite de fiado atingido: ${updatedCustomer.name}`,
            message: `O cliente "${updatedCustomer.name}" atingiu 100% do limite de crédito (${formatCents(updatedCustomer.credit_limit_cents)}).`,
            meta: JSON.stringify({ customerId: updatedCustomer.id, redirectPath: "/customers" }),
            target_roles: ["admin", "manager"],
          }).catch((err: unknown) => console.error("[Notification] Erro ao criar notificação de fiado:", err));
        } else if (shouldNotifyFiadoAtNinety && usagePercent >= 90) {
          notificationService.create({
            type: NOTIFICATION_TYPES.FIADO_LIMIT_APPROACHING,
            severity: NOTIFICATION_SEVERITIES.MEDIUM,
            title: `Cliente próximo do limite de fiado: ${updatedCustomer.name}`,
            message: `O cliente "${updatedCustomer.name}" atingiu ${usagePercent.toFixed(0)}% do limite de crédito (${formatCents(updatedCustomer.current_debt_cents)} de ${formatCents(updatedCustomer.credit_limit_cents)}).`,
            meta: JSON.stringify({ customerId: updatedCustomer.id, redirectPath: "/customers" }),
            target_roles: ["admin", "manager"],
          }).catch((err: unknown) => console.error("[Notification] Erro ao criar notificação de fiado:", err));
        }
      }
    }

    if (payload.discount_cents > 0) {
      await this.notifyDiscountThresholds();
    }

    const hasCashPayment = payload.payment_method === PAYMENT_METHODS.CASH || payload.payments.some((payment) => payment.method === PAYMENT_METHODS.CASH);

    if (hasCashPayment) {
      await this.notifyCashRegisterAmountReached(payload.terminal_id);
    }

    await this.notifyStockTypeThresholds(result.affectedProductTypeIds ?? []);

    return result.sale;
  }

  async cancel(id: string, managerPin: string, operatorId: string) {
    const managerId = await authService.validateManagerPin(managerPin);

    if (!managerId) {
      throw forbidden("PIN de gerente inválido.");
    }

    const sale = await saleRepository.findById(id);

    if (!sale) {
      throw notFound("Venda não encontrada");
    }

    if (sale.status !== "completed") {
      throw unprocessable("Apenas vendas concluídas podem ser canceladas.");
    }

    const today = new Date();
    const saleDate = new Date(sale.created_at);

    if (today.toDateString() !== saleDate.toDateString()) {
      throw unprocessable("Cancelamento permitido apenas no dia da venda.");
    }

    await saleRepository.cancel(id, operatorId);

    await auditLogRepository.create({
      action: "sale_cancelled",
      actor_id: operatorId,
      entity_type: "sale",
      entity_id: id,
      details: { sale_id: id, operator_id: operatorId, manager_id: managerId },
    });
  }

  async refund(id: string, managerPin: string, operatorId: string) {
    const managerId = await authService.validateManagerPin(managerPin);

    if (!managerId) {
      throw forbidden("PIN de gerente inválido.");
    }

    const sale = await saleRepository.findById(id);

    if (!sale) {
      throw notFound("Venda não encontrada");
    }

    if (sale.status !== "completed") {
      throw unprocessable("Apenas vendas concluídas podem ser estornadas.");
    }

    const today = new Date();
    const saleDate = new Date(sale.created_at);
    const diffMs = today.getTime() - saleDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      throw unprocessable("Estorno permitido somente até 7 dias após a venda.");
    }

    await saleRepository.refund(id, operatorId);

    await auditLogRepository.create({
      action: "sale_refunded",
      actor_id: operatorId,
      entity_type: "sale",
      entity_id: id,
      details: { sale_id: id, operator_id: operatorId, manager_id: managerId },
    });

    // Notificação crítica para estornos acima do limite configurado
    const limitSetting = await settingsRepository.findByKey(REFUND_ALERT_LIMIT_SETTING);
    const refundLimitCents = limitSetting ? parseInt(limitSetting.value, 10) : 50000; // padrão R$ 500,00
    if (sale.total_cents >= refundLimitCents) {
      notificationService.create({
        type: NOTIFICATION_TYPES.REFUND_CRITICAL,
        severity: NOTIFICATION_SEVERITIES.CRITICAL,
        title: `Estorno acima do limite: ${formatCents(sale.total_cents)}`,
        message: `Estorno de ${formatCents(sale.total_cents)} registrado na venda #${id.substring(0, 8)}. Operador: ${operatorId}.`,
        meta: JSON.stringify({ saleId: id, redirectPath: "/sales" }),
        target_roles: ["admin", "manager"],
      }).catch((err: unknown) => console.error("[Notification] Erro ao criar notificação de estorno:", err));
    }
  }

  private async notifyStockTypeThresholds(affectedTypeIds: string[]) {
    const uniqueTypeIds = Array.from(new Set(affectedTypeIds.filter((typeId) => typeId.trim().length > 0)));

    if (uniqueTypeIds.length === 0) {
      return;
    }

    const [settings, stockSnapshot] = await Promise.all([
      settingsRepository.findMany(
        uniqueTypeIds.map((typeId) => `stock_alert_type_${typeId}` as DynamicStockAlertSettingKey),
      ),
      productRepository.getTypeStockSnapshotByIds(uniqueTypeIds),
    ]);

    const thresholdMap = new Map<string, number>();

    for (const item of settings) {
      const parsed = Number.parseFloat(item.value);

      if (Number.isNaN(parsed) || parsed < 0) {
        continue;
      }

      thresholdMap.set(item.key, parsed);
    }

    for (const row of stockSnapshot) {
      const settingKey = `stock_alert_type_${row.id}`;
      const threshold = thresholdMap.get(settingKey);

      if (threshold === undefined || row.total > threshold) {
        continue;
      }

      const unit = row.allBulk ? "kg" : "un";
      const stockDisplay = row.allBulk
        ? row.total.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : String(Math.trunc(row.total));

      await notificationService.create({
        type: NOTIFICATION_TYPES.STOCK_TYPE_LOW,
        severity: NOTIFICATION_SEVERITIES.MEDIUM,
        title: `Estoque baixo no tipo: ${row.name}`,
        message: `O estoque acumulado do tipo "${row.name}" está em ${stockDisplay} ${unit}, abaixo do limite configurado (${threshold.toLocaleString("pt-BR")} ${unit}).`,
        meta: JSON.stringify({ productTypeId: row.id, redirectPath: "/control" }),
        target_roles: ["admin", "manager"],
      });
    }
  }

  private async notifyDiscountThresholds() {
    const [dailySetting, weeklySetting, monthlySetting] = await Promise.all([
      settingsRepository.findByKey(DISCOUNT_LIMIT_DAILY_SETTING),
      settingsRepository.findByKey(DISCOUNT_LIMIT_WEEKLY_SETTING),
      settingsRepository.findByKey(DISCOUNT_LIMIT_MONTHLY_SETTING),
    ]);

    const limits: Array<{ period: "daily" | "weekly" | "monthly"; label: string; limit: number }> = [
      {
        period: "daily",
        label: "diário",
        limit: Number.parseInt(dailySetting?.value ?? "0", 10) || 0,
      },
      {
        period: "weekly",
        label: "semanal",
        limit: Number.parseInt(weeklySetting?.value ?? "0", 10) || 0,
      },
      {
        period: "monthly",
        label: "mensal",
        limit: Number.parseInt(monthlySetting?.value ?? "0", 10) || 0,
      },
    ];

    for (const current of limits) {
      if (current.limit <= 0) {
        continue;
      }

      const total = await saleRepository.getCashDiscountTotalByPeriod(current.period);
      const ratio = total / current.limit;

      if (ratio < 0.8) {
        continue;
      }

      if (ratio <= 1) {
        notificationService.create({
          type: NOTIFICATION_TYPES.DISCOUNT_LIMIT_APPROACHING,
          severity: NOTIFICATION_SEVERITIES.MEDIUM,
          title: `Desconto de troco próximo do limite ${current.label}`,
          message: `O total de descontos de troco no período ${current.label} está em ${formatCents(total)} de ${formatCents(current.limit)}.`,
          meta: JSON.stringify({ redirectPath: "/control" }),
          target_roles: ["admin", "manager"],
        }).catch((err: unknown) => console.error("[Notification] Erro ao criar notificação de desconto:", err));
        continue;
      }

      notificationService.create({
        type: NOTIFICATION_TYPES.DISCOUNT_LIMIT_EXCEEDED,
        severity: NOTIFICATION_SEVERITIES.HIGH,
        title: `Desconto de troco acima do limite ${current.label}`,
        message: `O total de descontos de troco no período ${current.label} atingiu ${formatCents(total)}, acima do limite de ${formatCents(current.limit)}.`,
        meta: JSON.stringify({ redirectPath: "/control" }),
        target_roles: ["admin", "manager"],
      }).catch((err: unknown) => console.error("[Notification] Erro ao criar notificação de desconto:", err));
    }
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
