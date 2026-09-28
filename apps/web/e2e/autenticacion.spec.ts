import { expect, test } from "@playwright/test";

/**
 * Spec `autenticacion`: "Ingreso y registro desde el sitio", "Rutas privadas
 * del sitio" y "Cierre de sesión".
 *
 * Cada corrida se crea su propio usuario con el prefijo `@e2e.test`, como los
 * e2e de la API, para no depender de los usuarios del seed ni pisarlos.
 */

function usuarioDePrueba() {
  const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    nombre: "E2E",
    apellido: `Socio ${marca}`,
    email: `e2e-${marca}@e2e.test`,
    password: "clave-e2e-1234",
  };
}

test.describe("Registro, ingreso y cierre de sesión", () => {
  test("una persona se registra, cierra sesión y vuelve a entrar", async ({
    page,
  }) => {
    const usuario = usuarioDePrueba();

    await page.goto("/registro");
    await page.getByLabel("Nombre").fill(usuario.nombre);
    await page.getByLabel("Apellido").fill(usuario.apellido);
    await page.getByLabel("Mail").fill(usuario.email);
    await page.getByLabel("Contraseña").fill(usuario.password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Con sesión, el header muestra el cierre de sesión en vez de "Ingresar".
    const header = page.getByRole("banner");
    await expect(header.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Ingresar" })).toHaveCount(0);

    await header.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(header.getByRole("link", { name: "Ingresar" })).toBeVisible();

    // Y las mismas credenciales sirven para volver a entrar.
    await page.goto("/ingresar");
    await page.getByLabel("Mail").fill(usuario.email);
    await page.getByLabel("Contraseña").fill(usuario.password);
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(header.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });

  test("credenciales equivocadas no dejan entrar", async ({ page }) => {
    await page.goto("/ingresar");
    await page.getByLabel("Mail").fill("no-existe@e2e.test");
    await page.getByLabel("Contraseña").fill("una-clave-cualquiera");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Ingresar" }),
    ).toBeVisible();
  });
});

test.describe("Rutas privadas", () => {
  /*
   * Las pantallas de estas rutas todavía no existen (son 1.3, 1.4 y 1.6), pero
   * el proxy redirige antes de intentar renderizarlas, así que la protección se
   * puede verificar igual. Cuando esas pantallas entren, el test no cambia.
   */
  for (const ruta of ["/mis-reservas", "/reservar", "/admin"]) {
    test(`sin sesión, ${ruta} redirige a ingresar y recuerda a dónde iba`, async ({
      page,
    }) => {
      await page.goto(ruta);

      await expect(page).toHaveURL(
        `/ingresar?volver=${encodeURIComponent(ruta)}`,
      );
    });
  }
});
