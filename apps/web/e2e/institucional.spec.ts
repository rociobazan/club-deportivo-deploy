import { expect, test } from "@playwright/test";

/**
 * Spec `institucional`, requisito "Sitio institucional público": las páginas
 * del sitio son accesibles desde el header.
 */
test.describe("Sitio institucional", () => {
  test("el header lleva a las cinco páginas públicas", async ({ page }) => {
    await page.goto("/");

    const header = page.getByRole("banner");
    for (const label of [
      "Inicio",
      "El club",
      "Canchas y precios",
      "Disponibilidad",
      "Contacto",
    ]) {
      await expect(header.getByRole("link", { name: label })).toBeVisible();
    }

    await header.getByRole("link", { name: "El club" }).click();
    await expect(page).toHaveURL(/\/el-club$/);

    await header.getByRole("link", { name: "Contacto" }).click();
    await expect(page).toHaveURL(/\/contacto$/);
  });

  test("sin sesión, el header ofrece ingresar", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("banner").getByRole("link", { name: "Ingresar" }),
    ).toBeVisible();
  });

  /*
   * El escenario "Usuario con sesión": con la sesión iniciada el header deja de
   * ofrecer el recorrido del visitante. Es el único test que sostiene el cambio
   * de la spec `institucional`; sin él, volver al menú viejo pasaría en verde.
   */
  test("con sesión, el menú es el del socio y no el del visitante", async ({ page }) => {
    const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    await page.goto("/registro");
    await page.getByLabel("Nombre").fill("E2E");
    await page.getByLabel("Apellido").fill(`Menu ${marca}`);
    await page.getByLabel("Mail").fill(`e2e-menu-${marca}@e2e.test`);
    await page.getByLabel("Contraseña").fill("clave-e2e-1234");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    const header = page.getByRole("banner");
    await expect(header.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

    for (const label of ["Disponibilidad", "Mis reservas", "Contacto", "Mi perfil"]) {
      await expect(header.getByRole("link", { name: label })).toBeVisible();
    }
    for (const label of ["Inicio", "El club", "Canchas y precios"]) {
      await expect(header.getByRole("link", { name: label })).toHaveCount(0);
    }
  });

  /*
   * El sitio institucional no depende de la API, así que estas páginas tienen
   * que responder aunque la API esté caída. Acá solo se comprueba que cargan:
   * el escenario con la API apagada está en la spec y se verifica a mano,
   * porque apagar la API a mitad de una corrida rompería el resto de los tests.
   */
  test("las tres páginas institucionales responden", async ({ page }) => {
    for (const ruta of ["/", "/el-club", "/contacto"]) {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status(), `GET ${ruta}`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});
