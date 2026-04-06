import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const pr: any = {
    customer: { update: vi.fn(), findFirst: vi.fn() },
    cashRegister: { findFirst: vi.fn() },
    customerPaymentHistory: { create: vi.fn() },
    transaction: { create: vi.fn() },
  };
  pr.$transaction = vi.fn((callback) => callback(pr));
  
  return {
    mockPrisma: pr,
    mockCustomerRepository: { findById: vi.fn() },
    mockAuthService: { validateManagerPin: vi.fn() }
  };
});

vi.mock("../config/database.js", () => ({ prisma: mocks.mockPrisma }));

vi.mock("../repositories/customer.repository.js", () => ({
  CustomerRepository: vi.fn().mockImplementation(() => mocks.mockCustomerRepository),
}));
vi.mock("./auth.service.js", () => ({
  AuthService: vi.fn().mockImplementation(() => mocks.mockAuthService),
}));

import { CustomerService } from "./customer.service.js";

describe("CustomerService", () => {
  let customerService: CustomerService;

  beforeEach(() => {
    vi.clearAllMocks();
    customerService = new CustomerService();
  });

  it("deve processar pagamento total: current_debt_cents = 0 e credit_blocked = false", async () => {
    mocks.mockAuthService.validateManagerPin.mockResolvedValueOnce("manager123");
    mocks.mockCustomerRepository.findById.mockResolvedValueOnce({
      id: "1",
      current_debt_cents: 1000,
      credit_blocked: true,
    });
    mocks.mockPrisma.customer.findFirst.mockResolvedValueOnce({
      id: "1",
      current_debt_cents: 1000,
    });
    mocks.mockPrisma.cashRegister.findFirst.mockResolvedValueOnce({ id: "caixa1" });
    
    mocks.mockPrisma.customer.update.mockResolvedValueOnce({
      id: "1",
      current_debt_cents: 0,
      credit_blocked: false,
    });

    const result = await customerService.payDebt("1", 1000, "pin", "user1");

    expect(mocks.mockPrisma.customer.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({ current_debt_cents: 0, credit_blocked: false, is_active: true }),
    });
    expect(result.current_debt_cents).toBe(0);
  });

  it("deve processar pagamento parcial sem mexer no credit_blocked", async () => {
    mocks.mockAuthService.validateManagerPin.mockResolvedValueOnce("manager123");
    mocks.mockCustomerRepository.findById.mockResolvedValueOnce({
      id: "1",
      current_debt_cents: 1000,
      credit_blocked: true,
    });
    mocks.mockPrisma.customer.findFirst.mockResolvedValueOnce({
      id: "1",
      current_debt_cents: 1000,
    });
    mocks.mockPrisma.cashRegister.findFirst.mockResolvedValueOnce({ id: "caixa1" });

    mocks.mockPrisma.customer.update.mockResolvedValueOnce({
      id: "1",
      current_debt_cents: 500,
      credit_blocked: true,
    });

    const result = await customerService.payDebt("1", 500, "pin", "user1");

    expect(mocks.mockPrisma.customer.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({ current_debt_cents: 500 }),
    });
    expect(result.current_debt_cents).toBe(500);
  });

  it("deve falhar ao tentar pagamento sem caixa aberto", async () => {
    mocks.mockAuthService.validateManagerPin.mockResolvedValueOnce("manager123");
    mocks.mockCustomerRepository.findById.mockResolvedValueOnce({
      id: "1",
      current_debt_cents: 1000,
      credit_blocked: true,
    });
    mocks.mockPrisma.customer.findFirst.mockResolvedValueOnce({
      id: "1",
      current_debt_cents: 1000,
    });
    mocks.mockPrisma.cashRegister.findFirst.mockResolvedValueOnce(null);

    try {
      await customerService.payDebt("1", 500, "pin", "user1");
    } catch (err: any) {
      expect(err.statusCode).toBe(400); // 400 Bad Request
    }
    expect.assertions(1);
  });
});

