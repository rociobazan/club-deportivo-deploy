import { expect, test, type Page } from "@playwright/test";

/**
 * Spec `autenticacion`: "Pantallas de recuperación de contraseña" y "Acceso a
 * la recuperación desde el ingreso" (RF-16), un test por escenario.
 *
 * "Contraseña restablecida" no está acá: el navegador no tiene cómo leer el
 * mail, que el doble de correo guarda dentro del proceso de la API. Ese camino
 * lo cubre `apps/api/test/recuperacion.e2e-spec.ts` (design.md de RF-16,
 * decisión 9). Un token inventado responde lo mismo que uno vencido o usado,
 * así que alcanza para probar la pantalla de enlace inválido.
 */

function usuarioDePrueba() {
  const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    nombre: "E2E",
    apellido: `Recupera ${marca}`,
    email: `e2e-recupera-${marca}@e2e.test`,
    password: "clave-e2e-1234",
  };
}

async function pedirEnlace(page: Page, email: string) {
  await page.goto("/recuperar");
  await page.getByLabel("Mail").fill(email);
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
}

/**
 * La confirmación, con el mail de quien pidió el enlace. La duración la decide
 * `RECUPERACION_VIGENCIA_MINUTOS` del servidor del sitio, que este proceso no
 * ve, así que se acepta cualquier número de minutos.
 */
function confirmacionPara(email: string): RegExp {
  const escapado = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^Si ${escapado} está registrado, te va a llegar un mail con un enlace para elegir una contraseña nueva\\. El enlace dura \\d+ minutos\\.$`,
  );
}

test.describe("Acceso a la recuperación desde el ingreso", () => {
  test("Link desde el ingreso: lleva a /recuperar", async ({ page }) => {
    await page.goto("/ingresar");

    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();

    await expect(page).toHaveURL(/\/recuperar$/);
    await expect(page.getByRole("heading", { name: "Recuperar la contraseña" })).toBeVisible();
  });
});

test.describe("Pantallas de recuperación de contraseña", () => {
  test("Pedido de enlace: confirma que, si el mail está registrado, llega un enlace", async ({
    page,
    context,
  }) => {
    const usuario = usuarioDePrueba();
    await page.goto("/registro");
    await page.getByLabel("Nombre").fill(usuario.nombre);
    await page.getByLabel("Apellido").fill(usuario.apellido);
    await page.getByLabel("Mail").fill(usuario.email);
    await page.getByLabel("Contraseña").fill(usuario.password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("banner").getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    await context.clearCookies();

    await pedirEnlace(page, usuario.email);

    await expect(page.getByRole("status")).toHaveText(confirmacionPara(usuario.email));
  });

  test("Pedido con un mail no registrado: el mismo mensaje que con uno registrado", async ({
    page,
  }) => {
    const email = `nadie-${Date.now()}@e2e.test`;

    await pedirEnlace(page, email);

    await expect(page.getByRole("status")).toHaveText(confirmacionPara(email));
  });

  test("Mail mal escrito: muestra el error junto al campo y conserva lo escrito", async ({
    page,
  }) => {
    await pedirEnlace(page, "no-es-un-mail");

    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Ese mail no parece válido.");
    await expect(page.getByLabel("Mail")).toHaveValue("no-es-un-mail");
    await expect(page.getByLabel("Mail")).toHaveAttribute("aria-describedby", "email-error");
  });

  test("Contraseñas que no coinciden: error junto a la repetición y los campos vacíos", async ({
    page,
  }) => {
    await page.goto("/restablecer?token=un-token-cualquiera");

    await page.getByLabel("Contraseña nueva").fill("claveNueva123");
    await page.getByLabel("Repetí la contraseña").fill("otraDistinta99");
    await page.getByRole("button", { name: "Guardar la contraseña" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Las contraseñas no coinciden.");
    await expect(page.getByLabel("Repetí la contraseña")).toHaveAttribute(
      "aria-describedby",
      "repetir-error",
    );
    await expect(page.getByLabel("Contraseña nueva")).toHaveValue("");
    await expect(page.getByLabel("Repetí la contraseña")).toHaveValue("");
  });

  test("Enlace vencido o usado: avisa que el enlace no sirve y ofrece pedir uno nuevo", async ({
    page,
  }) => {
    await page.goto("/restablecer?token=un-token-que-la-api-nunca-emitio");

    await page.getByLabel("Contraseña nueva").fill("claveNueva123");
    await page.getByLabel("Repetí la contraseña").fill("claveNueva123");
    await page.getByRole("button", { name: "Guardar la contraseña" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText("Este enlace no sirve");
    await page.getByRole("link", { name: "Pedir un enlace nuevo" }).click();
    await expect(page).toHaveURL(/\/recuperar$/);
  });

  test("Enlace sin token: avisa que no sirve y no muestra el formulario", async ({ page }) => {
    await page.goto("/restablecer");

    await expect(page.getByRole("main").getByRole("alert")).toContainText("Este enlace no sirve");
    await expect(page.getByRole("link", { name: "Pedir un enlace nuevo" })).toBeVisible();
    await expect(page.getByLabel("Contraseña nueva")).toHaveCount(0);
  });
});
