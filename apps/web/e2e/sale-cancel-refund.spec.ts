import { test, expect } from "@playwright/test";

test.describe("Fluxo de Cancelamento e Estorno", () => {
  test.beforeEach(async ({ page }) => {
    // Autenticação mock
    await page.route("**/api/auth/login", (route) => route.fulfill({ status: 200, json: { data: { access_token: "t", user: { role: "admin" } } } }));
    await page.goto("/login");
    await page.getByLabel("Usuário").fill("admin");
    await page.getByLabel("Senha").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();
  });

  test("cancelamento de venda com PIN de gerente", async ({ page }) => {
    // Mock de produto
    await page.route("**/api/products/search**", (route) => route.fulfill({ status: 200, json: { data: [{ id: "p1", name: "Coca", unit_price_cents: 800, stock_quantity: 10 }] } }));
    
    await page.goto("/sales");

    await page.getByPlaceholder("Nome ou código do produto...").fill("Coca");
    await page.keyboard.press("Enter");
    await page.getByText("Coca").click();

    // Tenta cancelar venda (botão no header ou atalho)
    await page.getByRole("button", { name: "Cancelar Venda" }).click();
    
    // Modal de PIN deve abrir
    await expect(page.getByText("PIN do Gerente / Administrador")).toBeVisible();
    await page.getByLabel("PIN").fill("1234");
    
    // Mock de validação de PIN
    await page.route("**/api/auth/verify-role-pin", (route) => route.fulfill({ status: 200, json: { data: { valid: true } } }));

    await page.getByRole("button", { name: "Verificar PIN" }).click();
    await expect(page.getByText("Carrinho limpo.")).toBeVisible();
  });

  test("estorno de venda entregue/finalizada", async ({ page }) => {
    // Mock do histórico de vendas
    await page.route("**/api/control/sales**", (route) => route.fulfill({ 
      status: 200, 
      json: { data: [{ id: "s1", status: "completed", total_cents: 2000, sale_number: "001" }] } 
    }));

    await page.goto("/control");
    await page.getByText("Histórico de Vendas").click();
    await page.getByText("s1").click();

    await page.getByRole("button", { name: "Estornar" }).click();
    
    // Modal de estorno (com valor e PIN)
    await expect(page.getByText("Solicitar Estorno (Refund)")).toBeVisible();
    await page.getByLabel("PIN de confirmação").fill("1234");
    
    // Mock de estorno
    await page.route("**/api/sales/s1/refund", (route) => route.fulfill({ status: 200, json: { data: { status: "refunded" } } }));

    await page.getByRole("button", { name: "Confirmar Estorno" }).click();
    await expect(page.getByText("Venda estornada com sucesso")).toBeVisible();
  });
});
