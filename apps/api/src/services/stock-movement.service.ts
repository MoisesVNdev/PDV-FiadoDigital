import { ProductRepository } from "../repositories/product.repository.js";
import { StockMovementRepository } from "../repositories/stock-movement.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { NotificationService } from "./notification.service.js";
import { NOTIFICATION_TYPES, NOTIFICATION_SEVERITIES } from "@pdv/shared";
import { logError } from "../utils/logger.js";

const stockMovementRepository = new StockMovementRepository();
const productRepository = new ProductRepository();
const settingsRepository = new SettingsRepository();
const notificationService = new NotificationService();

export class StockMovementService {
  async listByProductId(productId: string) {
    const product = await productRepository.findById(productId);

    if (!product) {
      throw new Error("Produto não encontrado");
    }

    return stockMovementRepository.findByProductId(productId, 20);
  }

  async createAdjustment(payload: {
    product_id: string;
    quantity: number;
    unit_cost_cents: number;
    description: string;
    operator_id: string;
  }) {
    if (!payload.operator_id) {
      throw new Error("Operador inválido");
    }

    if (!payload.product_id) {
      throw new Error("Produto é obrigatório");
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity === 0) {
      throw new Error("Quantidade de ajuste inválida");
    }

    if (!Number.isInteger(payload.unit_cost_cents) || payload.unit_cost_cents < 0) {
      throw new Error("Custo unitário inválido");
    }

    if (!payload.description.trim()) {
      throw new Error("Descrição é obrigatória");
    }

    const result = await stockMovementRepository.createAdjustment({
      ...payload,
      description: payload.description.trim(),
    });

    // Notificação de estoque mínimo após ajuste manual
    const updatedProduct = result.product;
    if (
      updatedProduct.stock_quantity <= updatedProduct.min_stock_alert &&
      updatedProduct.stock_quantity >= 0
    ) {
      notificationService.create({
        type: NOTIFICATION_TYPES.STOCK_LOW,
        severity: NOTIFICATION_SEVERITIES.HIGH,
        title: `Estoque baixo: ${updatedProduct.name}`,
        message: `O produto "${updatedProduct.name}" atingiu o estoque mínimo (${updatedProduct.min_stock_alert} un).`,
        meta: JSON.stringify({ productId: updatedProduct.id, redirectPath: "/products" }),
        target_roles: ["admin", "manager"],
      }).catch((err: unknown) =>
        logError("Erro ao criar notificação de estoque", err, { tag: "Notification" }),
      );
    }

    await this.notifyStockTypeThresholds();

    return result;
  }

  private async notifyStockTypeThresholds() {
    const [settings, stockSnapshot] = await Promise.all([
      settingsRepository.findByPrefix("stock_alert_type_"),
      productRepository.getTypeStockSnapshot(),
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

      notificationService.create({
        type: NOTIFICATION_TYPES.STOCK_TYPE_LOW,
        severity: NOTIFICATION_SEVERITIES.MEDIUM,
        title: `Estoque baixo no tipo: ${row.name}`,
        message: `O estoque acumulado do tipo "${row.name}" está em ${stockDisplay} ${unit}, abaixo do limite configurado (${threshold.toLocaleString("pt-BR")} ${unit}).`,
        meta: JSON.stringify({ productTypeId: row.id, redirectPath: "/products" }),
        target_roles: ["admin", "manager"],
      }).catch((err: unknown) => logError("Erro ao criar notificação por tipo", err, { tag: "Notification" }));
    }
  }
}
