import { test, expect } from "@playwright/test";

test.describe("Fluxo de Venda Completo", () => {
  test.beforeEach(async ({ page }) => {
    // Mock do login e estado inicial
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({ status: 200, json: { data: { access_token: "mock-token", user: { role: "admin" } } } });
    });
    
    await page.goto("/login");
    await page.getByLabel("Usuário").fill("admin");
    await page.getByLabel("Senha").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();
  });

  test("venda com pagamento em dinheiro e troco", async ({ page }) => {
    // Mock do caixa aberto
    await page.route("**/api/cash-registers/active", async (route) => {
      await route.fulfill({ status: 200, json: { data: { id: "cr-1", status: "open", opening_balance_cents: 10000 } } });
    });

    // Mock de produto
    await page.route("**/api/products/search**", async (route) => {
      await route.fulfill({ status: 200, json: { data: [{ id: "p1", name: "Coca-Cola", unit_price_cents: 800, stock_quantity: 10 }] } });
    });

    await page.goto("/sales");

    // Adiciona item
    await page.getByPlaceholder("Nome ou código do produto...").fill("Coca");
    await page.keyboard.press("Enter");
    await page.getByText("Coca-Cola").click();

    // Finalizar (F4) - Abre modal de pagamento
    await page.keyboard.press("F4");
    
    // Simula pagamento em dinheiro de R$ 10,00
    await page.getByLabel("Valor recebido").fill("10,00");
    
    // Verifica troco calculado: 10,00 - 8,00 = 2,00
    await expect(page.getByText("Troco: R$ 2,00")).toBeVisible();

    // Mock da criação da venda
    await page.route("**/api/sales", async (route) => {
      await route.fulfill({ status: 201, json: { data: { id: "s1" } } });
    });

    await page.getByRole("button", { name: "Concluir Venda (Enter)" }).click();
    await expect(page.getByText("Venda concluída com sucesso")).toBeVisible();
  });

  test("venda com Pix e polling de confirmação", async ({ page }) => {
    await page.route("**/api/products/search**", async (route) => {
      await route.fulfill({ status: 200, json: { data: [{ id: "p1", name: "Coca-Cola", unit_price_cents: 800, stock_quantity: 10 }] } });
    });
    await page.goto("/sales");

    await page.getByPlaceholder("Nome ou código do produto...").fill("Coca");
    await page.keyboard.press("Enter");
    await page.getByText("Coca-Cola").click();

    await page.keyboard.press("F4");
    await page.getByRole("button", { name: "Pix" }).click();

    // Mock da geração do QR Code
    await page.route("**/api/pix/qrcode", async (route) => {
      await route.fulfill({ status: 200, json: { data: { tx_id: "tx-123", qr_code_payload: "pix-payload" } } });
    });

    await page.getByRole("button", { name: "Gerar QR Code Pix" }).click();

    // Mock do polling de status
    await page.route("**/api/pix/status/tx-123", async (route) => {
      await route.fulfill({ status: 200, json: { data: { status: "confirmed" } } });
    });

    await expect(page.getByText("Pagamento Pix confirmado automaticamente")).toBeVisible({ timeout: 10000 });
  });
});
