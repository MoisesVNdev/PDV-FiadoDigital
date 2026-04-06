import { test, expect } from "@playwright/test";

test.describe("Central de Notificações", () => {
  test.beforeEach(async ({ page }) => {
    // Autenticação e Mock WS
    await page.route("**/api/auth/login", (route) => route.fulfill({ status: 200, json: { data: { access_token: "t", user: { role: "admin" } } } }));
    await page.goto("/login");
    await page.getByLabel("Usuário").fill("admin");
    await page.getByLabel("Senha").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();
  });

  test("recebimento e gestão de notificações críticas", async ({ page }) => {
    // Mock inicial das notificações
    await page.route("**/api/notifications**", (route) => route.fulfill({ 
      status: 200, 
      json: { data: [{ id: "n1", type: "CRITICAL_STOCK", message: "Estoque insuficiente: Coca-Cola", read: false }] } 
    }));

    await page.goto("/notifications");
    await expect(page.getByText("Estoque insuficiente: Coca-Cola")).toBeVisible();

    // Confirmar notificação (Acknowledge)
    await page.getByRole("button", { name: "Confirmar" }).click();

    // Mock acknowledge
    await page.route("**/api/notifications/n1/read", (route) => route.fulfill({ status: 200, json: { data: { readAt: new Date() } } }));

    // Exportação CSV
    await page.route("**/api/notifications/export**", (route) => route.fulfill({ 
      status: 200, 
      body: "id,message\nn1,Estoque insuficiente: Coca-Cola",
      contentType: "text/csv" 
    }));

    // Clica no botão de exportar
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("notificacoes");
  });
});
