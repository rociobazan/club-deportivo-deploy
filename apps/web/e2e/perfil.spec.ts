import { expect, test } from "@playwright/test";

/**
 * Spec `autenticacion`, requisito "Pantalla de perfil".
 *
 * Cada corrida se registra su propio usuario con el prefijo `@e2e.test`, igual
 * que `autenticacion.spec.ts`: así no hace falta sembrar nada y los tests no
 * dependen del seed ni de otra corrida.
 */

function usuarioDePrueba() {
  const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    nombre: "E2E",
    apellido: `Perfil ${marca}`,
    email: `e2e-perfil-${marca}@e2e.test`,
    password: "clave-e2e-1234",
  };
}

/** Registra e ingresa, y deja la sesión abierta en la página. */
async function registrarse(page: import("@playwright/test").Page) {
  const usuario = usuarioDePrueba();

  await page.goto("/registro");
  await page.getByLabel("Nombre").fill(usuario.nombre);
  await page.getByLabel("Apellido").fill(usuario.apellido);
  await page.getByLabel("Mail").fill(usuario.email);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(
    page.getByRole("banner").getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();

  return usuario;
}

test.describe("Pantalla de perfil", () => {
  test("Visitante sin sesión: /perfil lleva a ingresar y recuerda a dónde iba", async ({
    page,
  }) => {
    await page.goto("/perfil");

    await expect(page).toHaveURL("/ingresar?volver=%2Fperfil");
  });

  /*
   * `proxy.ts` mira si la cookie existe, no si el token sigue vivo, así que una
   * sesión vencida llega hasta la página y la API contesta 401. Antes eso
   * mostraba "probá de nuevo en unos segundos" con un botón Reintentar que no
   * podía funcionar nunca; ahora lleva a ingresar, que es lo que hace falta.
   */
  test("sesión inválida: lleva a ingresar en vez de ofrecer reintentar", async ({
    page,
    context,
  }) => {
    // Se navega primero para que la cookie cuelgue del origen del sitio.
    await page.goto("/");
    await context.addCookies([
      { name: "sesion", value: "un.token.que-no-vale", url: page.url() },
    ]);

    await page.goto("/perfil");

    await expect(page).toHaveURL("/ingresar?volver=%2Fperfil");
    await expect(page.getByRole("link", { name: "Reintentar" })).toHaveCount(0);
  });

  test("Socio abre su perfil y ve sus datos actuales", async ({ page }) => {
    const usuario = await registrarse(page);

    await page.goto("/perfil");

    await expect(page.getByRole("heading", { name: "Mi perfil", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue(usuario.nombre);
    await expect(page.getByLabel("Apellido")).toHaveValue(usuario.apellido);
    await expect(page.getByLabel("Mail")).toHaveValue(usuario.email);
  });

  test("Cambio guardado: el dato nuevo queda a la vista", async ({ page }) => {
    await registrarse(page);

    await page.goto("/perfil");
    await page.getByLabel("Teléfono (opcional)").fill("351 555 0000");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Guardamos tus datos.")).toBeVisible();
    await expect(page.getByLabel("Teléfono (opcional)")).toHaveValue("351 555 0000");
  });

  /*
   * El caso que sostiene la decisión de separar los dos formularios: un error
   * en el de contraseña no puede borrar lo que la persona cargó en sus datos.
   */
  test("un error de contraseña no toca lo cargado en los datos", async ({ page }) => {
    await registrarse(page);

    await page.goto("/perfil");
    await page.getByLabel("Nombre").fill("Sin guardar todavía");
    await page.getByLabel("Contraseña actual").fill("la-que-no-es");
    await page.getByLabel("Contraseña nueva").fill("otraClaveSegura456");
    await page.getByLabel("Repetir la nueva").fill("otraClaveSegura456");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue("Sin guardar todavía");
    // Y la contraseña nunca se repone en pantalla, ni siquiera la rechazada.
    await expect(page.getByLabel("Contraseña actual")).toHaveValue("");
  });
});
