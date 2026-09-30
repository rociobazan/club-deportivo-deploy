import { expect, test } from "@playwright/test";

/**
 * Spec `institucional`, requisito "Formulario de contacto en el sitio".
 *
 * El envío llega hasta la API de verdad y esta guarda el mensaje con el doble
 * de correo (`CorreoDoble`), que no toca la red: en test y en desarrollo sin
 * `RESEND_API_KEY` el cliente de mail es el doble (memoria, decisión 25). O
 * sea que estos tests no mandan mails.
 */

/** Datos propios, con el prefijo que ya usan los e2e de la API. */
function datosDePrueba() {
  const marca = Date.now();
  return {
    nombre: `E2E Visitante ${marca}`,
    email: `e2e-contacto-${marca}@e2e.test`,
    telefono: "351 000 0000",
    mensaje: `E2E consulta automática ${marca}.`,
  };
}

async function completar(
  page: import("@playwright/test").Page,
  datos: ReturnType<typeof datosDePrueba>,
) {
  await page.getByLabel("Nombre").fill(datos.nombre);
  await page.getByLabel("Mail").fill(datos.email);
  await page.getByLabel("Teléfono").fill(datos.telefono);
  await page.getByLabel("Mensaje").fill(datos.mensaje);
}

test.describe("Formulario de contacto", () => {
  test("un envío válido muestra la confirmación y vacía el formulario", async ({
    page,
  }) => {
    const datos = datosDePrueba();

    await page.goto("/contacto");
    await completar(page, datos);
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    /*
     * El texto lo devuelve la API, no lo inventa el front, y aparece en dos
     * nodos a propósito: la región viva `sr-only`, que es la que lo anuncia a
     * un lector de pantalla, y la copia visible. El escenario de la spec dice
     * que la persona lo *ve*, así que se afirma sobre la que no es `sr-only`;
     * buscar el texto suelto matchea los dos y Playwright corta por estricto.
     */
    await expect(
      page.locator("p:not(.sr-only)", { hasText: "Recibimos tu consulta" }),
    ).toBeVisible();
    await expect(page.locator("p.sr-only")).toHaveText(
      /Recibimos tu consulta/,
    );

    // La `key` del formulario lo re-monta: los campos quedan vacíos.
    await expect(page.getByLabel("Nombre")).toHaveValue("");
    await expect(page.getByLabel("Mensaje")).toHaveValue("");
  });

  test("un mail mal formado muestra el error y conserva lo escrito", async ({
    page,
  }) => {
    const datos = { ...datosDePrueba(), email: "esto-no-es-un-mail" };

    await page.goto("/contacto");
    await completar(page, datos);
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    // `Campo` arma el error como <p id="<campo>-error" role="alert">.
    const error = page.locator("#email-error");
    await expect(error).toBeVisible();
    await expect(page.getByLabel("Mail")).toHaveAttribute("aria-invalid", "true");

    // Lo importante del escenario: no se pierde lo que la persona escribió.
    await expect(page.getByLabel("Nombre")).toHaveValue(datos.nombre);
    await expect(page.getByLabel("Mensaje")).toHaveValue(datos.mensaje);
  });

  test("el campo trampa existe pero no es alcanzable con el teclado", async ({
    page,
  }) => {
    await page.goto("/contacto");

    const trampa = page.locator("#sitioWeb");
    await expect(trampa).toHaveCount(1);
    await expect(trampa).toHaveAttribute("tabindex", "-1");

    /*
     * Fuera del árbol de accesibilidad. Va con `getByRole` y no con
     * `getByLabel`: `getByRole` descarta lo que está oculto para un lector de
     * pantalla, que es exactamente la propiedad que pide la spec, mientras que
     * `getByLabel` encontraría el `<label>` igual.
     */
    await expect(page.getByRole("textbox", { name: "Sitio web" })).toHaveCount(0);
  });
});
