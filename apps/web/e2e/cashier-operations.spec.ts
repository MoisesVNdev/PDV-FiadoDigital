import { test, expect } from "@playwright/test";

test.describe("Operações de Caixa", () => {
  test.beforeEach(async ({ page }) => {
    // Autenticação mock
    await page.route("**/api/auth/login", (route) => route.fulfill({ status: 200, json: { data: { access_token: "t", user: { role: "admin" } } } }));
    await page.goto("/login");
    await page.getByLabel("Usuário").fill("admin");
    await page.getByLabel("Senha").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();
  });

  test("abrir caixa com saldo inicial", async ({ page }) => {
    // Mock do caixa fechado
    await page.route("**/api/cash-registers/active", (route) => route.fulfill({ status: 404, json: { message: "Caixa fechado" } }));

    await page.goto("/sales");

    await expect(page.getByText("Caixa Fechado")).toBeVisible();
    await page.getByLabel("Saldo inicial (Dinheiro)").fill("100,00");

    // Mock de abertura de caixa
    await page.route("**/api/cash-registers/open", (route) => route.fulfill({ status: 201, json: { data: { id: "cr1" } } }));

    await page.getByRole("button", { name: "Abrir Caixa" }).click();
    await expect(page.getByText("Caixa aberto com sucesso")).toBeVisible();
  });

  test("suprimento de caixa (cash-in)", async ({ page }) => {
    await page.route("**/api/cash-registers/active", (route) => route.fulfill({ status: 200, json: { data: { id: "cr1", status: "open" } } }));
    await page.goto("/sales");

    // Atalho Suprimento (F7)
    await page.keyboard.press("F7");
    await page.getByLabel("Valor do suprimento").fill("50,00");
    await page.getByPlaceholder("Motivo do suprimento").fill("Troco adicional");

    // Mock do suprimento
    await page.route("**/api/cash-registers/movement", (route) => route.fulfill({ status: 201, json: { data: { type: "in" } } }));

    await page.getByRole("button", { name: "Confirmar Suprimento" }).click();
    await expect(page.getByText("Suprimento registrado")).toBeVisible();
  });

  test("fechar caixa com conferência de saldo", async ({ page }) => {
    await page.route("**/api/cash-registers/active", (route) => route.fulfill({ status: 200, json: { data: { id: "cr1", status: "open" } } }));
    await page.goto("/sales");

    await page.getByRole("button", { name: "Fechar Caixa" }).click();
    await expect(page.getByText("Conferência de fechamento")).toBeVisible();

    await page.getByLabel("Conferido em Dinheiro").fill("150,00");

    // Mock de fechamento
    await page.route("**/api/cash-registers/cr1/close", (route) => route.fulfill({ status: 200, json: { data: { status: "closed" } } }));

    await page.getByRole("button", { name: "Encerrar Caixa" }).click();
    await expect(page.getByText("Caixa encerrado")).toBeVisible();
  });
});
