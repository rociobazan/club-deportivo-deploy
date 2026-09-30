import { expect, test } from "@playwright/test";

/**
 * Spec `reservas`, requisitos de "Mis reservas" y su detalle (ítem 1.4).
 *
 * Cada corrida se registra su propio usuario con el prefijo `@e2e.test`, igual
 * que `perfil.spec.ts`: no hace falta sembrar nada y los tests no dependen del
 * seed ni de otra corrida.
 *
 * Todavía no se cubre una reserva **con datos**, porque `POST /reservas` no
 * existe hasta el ítem 1.3: un socio recién registrado no tiene ninguna y no
 * hay forma de crearle una desde el navegador. Cuando 1.3 entre, acá van los
 * casos de la lista con reservas, las pestañas con contenido y la cancelación.
 */

function usuarioDePrueba() {
  const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    nombre: "E2E",
    apellido: `Reservas ${marca}`,
    email: `e2e-reservas-${marca}@e2e.test`,
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

/** Deja una cookie de sesión que existe pero no vale, sin pasar por el login. */
async function conSesionInvalida(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
) {
  // Se navega primero para que la cookie cuelgue del origen del sitio.
  await page.goto("/");
  await context.addCookies([
    { name: "sesion", value: "un.token.que-no-vale", url: page.url() },
  ]);
}

test.describe("Mis reservas", () => {
  test("Socio sin reservas: ve el estado vacío y no una lista rota", async ({ page }) => {
    await registrarse(page);

    await page.goto("/mis-reservas");

    await expect(page.getByRole("heading", { name: "Mis reservas" })).toBeVisible();
    await expect(page.getByText("Nada por acá todavía")).toBeVisible();
    // Sin reservas no hay pestañas que mostrar.
    await expect(page.getByRole("tab")).toHaveCount(0);
  });

  test("el estado vacío ofrece ir a reservar", async ({ page }) => {
    await registrarse(page);

    await page.goto("/mis-reservas");
    await page.getByRole("link", { name: "Reservar otro turno" }).click();

    await expect(page).toHaveURL("/disponibilidad");
  });

  /*
   * `proxy.ts` mira si la cookie existe, no si el token sigue vivo, así que una
   * sesión vencida llega hasta la página y la API contesta 401. Ofrecer
   * "reintentar" ahí manda a un bucle que no puede funcionar: lo que la persona
   * necesita es volver a ingresar. Mismo criterio que `/perfil`.
   */
  test("sesión inválida: lleva a ingresar en vez de ofrecer reintentar", async ({
    page,
    context,
  }) => {
    await conSesionInvalida(page, context);

    await page.goto("/mis-reservas");

    await expect(page).toHaveURL("/ingresar?volver=%2Fmis-reservas");
    await expect(page.getByRole("link", { name: "Reintentar" })).toHaveCount(0);
  });
});

test.describe("Detalle de una reserva", () => {
  test("sesión inválida: lleva a ingresar en vez de ofrecer reintentar", async ({
    page,
    context,
  }) => {
    await conSesionInvalida(page, context);

    await page.goto("/mis-reservas/1");

    await expect(page).toHaveURL("/ingresar?volver=%2Fmis-reservas%2F1");
    await expect(page.getByRole("link", { name: "Reintentar" })).toHaveCount(0);
  });

  /*
   * La reserva de otra persona y una que no existe tienen que dar lo mismo: si
   * el detalle de otro devolviera un error distinto, se podría averiguar qué
   * ids existen preguntando de a uno.
   */
  test("una reserva que no es suya no se distingue de una que no existe", async ({ page }) => {
    await registrarse(page);

    await page.goto("/mis-reservas/999999");

    await expect(page.getByRole("heading", { name: /no encontramos/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reintentar" })).toHaveCount(0);
  });
});
