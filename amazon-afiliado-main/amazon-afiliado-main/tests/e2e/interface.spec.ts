import { test, expect } from "@playwright/test";
test("all ten sections load with honest setup and empty states", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "/",
    "/products",
    "/discover",
    "/pin-studio",
    "/approval-queue",
    "/scheduler",
    "/published",
    "/analytics",
    "/ai-insights",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.getByText("Vista inicial · Conecta Supabase"),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("product form validates required fields and explains missing setup", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Añadir producto", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Añadir un producto",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await modal.getByLabel("URL de Amazon o ASIN").fill("B012345678");
  await modal.getByLabel("Nombre del producto").fill("Producto de prueba");
  await modal.getByRole("button", { name: "Guardar producto" }).click();
  await expect(modal.getByRole("alert")).toContainText(
    "Configura las variables de Supabase",
  );
  await modal.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(modal).not.toBeVisible();
});
test("mobile navigation works without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Analytics", exact: true })
    .click();
  await expect(page).toHaveURL(/analytics/);
  await expect(page.locator("h1")).toContainText("Menos suposiciones");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await expect(page.getByRole("navigation")).not.toBeVisible();
});
test("unconfigured mutation cannot succeed and unknown pages render not-found", async ({
  request,
}) => {
  const response = await request.post("/api/command", {
    headers: { Origin: "http://localhost:3010" },
    data: { action: "addProduct" },
  });
  expect(response.status()).toBe(503);
  const notFound = await request.get("/unknown");
  // App Router can return HTTP 200 for a streamed notFound response.
  expect(await notFound.text()).toContain("Esta página no existe");
});
