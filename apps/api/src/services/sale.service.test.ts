import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSaleRepository: {
    findByUuid: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    refund: vi.fn(),
  },
  mockCustomerRepository: {
    findById: vi.fn(),
  },
  mockAuthService: {
    validateManagerPin: vi.fn(),
  }
}));

vi.mock("../repositories/sale.repository.js", () => ({
  SaleRepository: vi.fn().mockImplementation(() => mocks.mockSaleRepository),
}));

vi.mock("../repositories/customer.repository.js", () => ({
  CustomerRepository: vi.fn().mockImplementation(() => mocks.mockCustomerRepository),
}));

vi.mock("../repositories/product.repository.js", () => ({ ProductRepository: vi.fn() }));
vi.mock("../repositories/cash-register.repository.js", () => ({ CashRegisterRepository: vi.fn() }));
vi.mock("../repositories/audit-log.repository.js", () => ({ AuditLogRepository: vi.fn().mockImplementation(() => ({ create: vi.fn() }))}));
vi.mock("./notification.service.js", () => ({ NotificationService: vi.fn().mockImplementation(() => ({ create: vi.fn() }))}));
vi.mock("../repositories/settings.repository.js", () => ({ SettingsRepository: vi.fn().mockImplementation(() => ({ findByKey: vi.fn() }))}));
vi.mock("../websocket/index.js", () => ({ broadcast: vi.fn() }));
vi.mock("./auth.service.js", () => ({
  AuthService: vi.fn().mockImplementation(() => mocks.mockAuthService),
}));

import { SaleService } from "./sale.service.js";

describe("SaleService", () => {
  let saleService: SaleService;

  beforeEach(() => {
    vi.clearAllMocks();
    saleService = new SaleService();
  });

  describe("create", () => {
    it("deve retornar a venda existente sem erro se uuid já existir (Idempotência)", async () => {
      mocks.mockSaleRepository.findByUuid.mockResolvedValueOnce({ id: "existente" });
      
      const payload = {
        uuid: "123",
        items: [{ unit_price_cents: 100, quantity: 1, discount_cents: 0 }],
        payments: [{ amount_cents: 100, method: "cash" }],
        discount_cents: 0,
        total_cents: 100,
        payment_method: "cash",
      } as any;

      const result = await saleService.create(payload);
      expect(result).toEqual({ id: "existente" });
    });

    it("deve falhar se informar mais de 2 métodos de pagamento", async () => {
      mocks.mockSaleRepository.findByUuid.mockResolvedValueOnce(null);
      const payload = {
        uuid: "123",
        items: [],
        payments: [
          { amount_cents: 10, method: "cash" },
          { amount_cents: 10, method: "credit" },
          { amount_cents: 10, method: "pix" }
        ],
      } as any;

      await expect(saleService.create(payload)).rejects.toThrow(/máximo 2 meios de pagamento/);
    });

    it("deve falhar compra no fiado sem customer_id", async () => {
      mocks.mockSaleRepository.findByUuid.mockResolvedValueOnce(null);
      const payload = {
        uuid: "123",
        items: [{ unit_price_cents: 100, quantity: 1, discount_cents: 0 }],
        payments: [{ amount_cents: 100, method: "fiado" }],
        discount_cents: 0,
        total_cents: 100,
        payment_method: "fiado",
      } as any;

      await expect(saleService.create(payload)).rejects.toThrow("Dados inválidos: Cliente é obrigatório para pagamento no fiado.");
    });
  });

  describe("cancel", () => {
    it("deve falhar com 422 se tentado em dia diferente da venda", async () => {
      mocks.mockAuthService.validateManagerPin.mockResolvedValueOnce("manager123");
      mocks.mockSaleRepository.findById.mockResolvedValueOnce({
        id: "1",
        status: "completed",
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      });

      try {
        await saleService.cancel("1", "pin", "operator");
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
      }
    });
  });

  describe("refund", () => {
    it("deve falhar com 422 se além de 7 dias", async () => {
      mocks.mockAuthService.validateManagerPin.mockResolvedValueOnce("manager123");
      mocks.mockSaleRepository.findById.mockResolvedValueOnce({
        id: "1",
        status: "completed",
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      });

      try {
        await saleService.refund("1", "pin", "operator");
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
      }
    });
  });
});
