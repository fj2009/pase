import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string, password = "PaseDemo2026!") {
  await page.goto("/entrar");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("la carta pública muestra la mesa del QR y enlaza al seguimiento", async ({ page }) => {
  await page.goto("/carta/casa-aurelio?mesa=casa04c4d5e6f708192a3b4c5d6e7f8091a2b");
  await expect(page.getByRole("heading", { name: "Casa Aurelio" })).toBeVisible();
  await expect(page.getByText("Mesa 4", { exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: /Seguir el pedido/ }).first().click();
  await expect(page.getByText("Seguimiento en directo")).toBeVisible();
  await expect(page.getByText("Tiempo estimado")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Casa Aurelio" })).toBeVisible();
});

test("el propietario entra y recorre la gestión del restaurante", async ({ page }) => {
  await login(page, "owner@casa-aurelio.es");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Hola, Aurelio." })).toBeVisible();

  for (const [path, text] of [
    ["/admin/carta", "Carta"],
    ["/admin/mesas", "Mesas"],
    ["/admin/estaciones", "Estaciones"],
    ["/admin/impresion", "Impresión"],
    ["/admin/equipo", "Equipo"],
    ["/sala", "Sala"],
    ["/cocina", "Cocina"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(await page.getByText("Application error").count()).toBe(0);
    expect((await page.textContent("body"))?.toLowerCase()).toContain(text.toLowerCase());
  }

  const stationName = `Prueba E2E ${Date.now()}`;
  await page.goto("/admin/estaciones");
  await page.getByLabel("Nombre").last().fill(stationName);
  await page.getByRole("button", { name: "Crear estación" }).click();
  await expect(page.getByText("Estación de cocina guardada.")).toBeVisible();

  const stationRow = page
    .locator(`input[name="name"][value="${stationName}"]`)
    .locator("xpath=ancestor::li");
  await stationRow.getByRole("button", { name: "Eliminar" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Estación eliminada.")).toBeVisible();
});

test("el superadmin accede al panel de plataforma", async ({ page }) => {
  await login(page, "admin@pase.app");
  await expect(page).toHaveURL(/\/plataforma$/);
  await expect(page.getByText("Casa Aurelio").first()).toBeVisible();
  await expect(page.getByText("La Chispa").first()).toBeVisible();
  expect(await page.getByText("Application error").count()).toBe(0);
});

test("el QR de una mesa se descarga como PNG", async ({ page }) => {
  await login(page, "owner@casa-aurelio.es");
  await expect(page).toHaveURL(/\/admin$/);
  const response = await page.request.get(
    "/api/admin/mesas/aa000000-0000-4000-8000-000000000004/qr?format=png&download=1",
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  const body = await response.body();
  expect(body.length).toBeGreaterThan(500);
});
