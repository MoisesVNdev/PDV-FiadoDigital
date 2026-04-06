import { test, expect } from "@playwright/test";

test.describe("Fluxo de Clientes e Fiado", () => {
  test.beforeEach(async ({ page }) => {
    // Autenticação mock
    await page.route("**/api/auth/login", (route) => route.fulfill({ status: 200, json: { data: { access_token: "t", user: { role: "admin" } } } }));
    await page.goto("/login");
    await page.getByLabel("Usuário").fill("admin");
    await page.getByLabel("Senha").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();
  });

  test("cadastro de cliente e venda no fiado com quitação parcial", async ({ page }) => {
    // Mock lista de clientes
    await page.route("**/api/customers**", (route) => route.fulfill({ status: 200, json: { data: [{ id: "c1", name: "João Fiado", current_debt_cents: 0, credit_limit_cents: 10000, is_active: true }] } }));

    await page.goto("/customers");
    await expect(page.getByText("João Fiado")).toBeVisible();

    // Simula venda fiado (vai para tela de vendas)
    await page.goto("/sales");

    // Adiciona produto
    await page.route("**/api/products/search**", (route) => route.fulfill({ status: 200, json: { data: [{ id: "p1", name: "Pão", unit_price_cents: 50, stock_quantity: 100 }] } }));
    await page.getByPlaceholder("Nome ou código do produto...").fill("Pão");
    await page.keyboard.press("Enter");
    await page.getByText("Pão").click();

    // Selecionar cliente (Atalho F2 then TAB etc or manual search)
    await page.getByRole("button", { name: "Identificar Cliente" }).click();
    await page.getByLabel("Buscar por nome ou CPF").fill("João");
    await page.getByText("João Fiado").click();

    // Finalizar no Fiado
    await page.keyboard.press("F4");
    await page.getByRole("button", { name: "Fiado" }).click();

    // Mock criação de venda
    await page.route("**/api/sales", (route) => route.fulfill({ status: 201, json: { data: { id: "s1" } } }));

    await page.getByRole("button", { name: "Registrar Fiado" }).click();
    await expect(page.getByText("Venda fiado registrada")).toBeVisible();

    // Quitação Parcial
    await page.goto("/customers");
    await page.getByText("João Fiado").click();
    await page.getByRole("button", { name: "Receber Pagamento" }).click();

    await page.getByLabel("Valor do pagamento").fill("25,00");
    await page.getByLabel("PIN confirmacao").fill("1234");

    // Mock pagamento de dívida
    await page.route("**/api/customers/c1/pay-debt", (route) => route.fulfill({ status: 200, json: { data: { paid: true } } }));

    await page.getByRole("button", { name: "Confirmar Recebimento" }).click();
    await expect(page.getByText("Pagamento registrado")).toBeVisible();
  });
});
