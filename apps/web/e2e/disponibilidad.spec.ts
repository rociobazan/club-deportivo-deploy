import { expect, test } from "@playwright/test";

/**
 * Spec `disponibilidad`, requisito "Pantalla de disponibilidad", y el horario
 * por día: los domingos el club no abre (`DIAS_CERRADOS=0`).
 */

/**
 * El próximo día de la semana pedido, siempre en el futuro.
 *
 * Nunca "hoy": el resultado del test cambiaría según el día en que corra. Se
 * arma como fecha calendaria (`YYYY-MM-DD`), que tiene un día de la semana sin
 * ambigüedad, así que no importa que el CI corra en UTC y el club esté en
 * `America/Argentina/Cordoba`.
 */
function proximo(diaDeLaSemana: number): string {
  const fecha = new Date();
  fecha.setUTCHours(12, 0, 0, 0);
  do {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  } while (fecha.getUTCDay() !== diaDeLaSemana);
  return fecha.toISOString().slice(0, 10);
}

const DOMINGO = 0;
const LUNES = 1;

test.describe("Pantalla de disponibilidad", () => {
  test("consultar una fecha deja la consulta en la URL", async ({ page }) => {
    const lunes = proximo(LUNES);

    await page.goto("/disponibilidad");
    await expect(
      page.getByRole("heading", { name: "Disponibilidad", level: 1 }),
    ).toBeVisible();

    await page.getByLabel("Fecha").fill(lunes);
    await page.getByRole("button", { name: "Ver turnos" }).click();

    // `<Form>` de Next: GET con la consulta en la URL, sin estado en el cliente.
    await expect(page).toHaveURL(new RegExp(`fecha=${lunes}`));
  });

  test("un día abierto muestra la grilla con las canchas del catálogo", async ({
    page,
  }) => {
    await page.goto(`/disponibilidad?fecha=${proximo(LUNES)}`);

    await expect(page.getByText("El club no abre este día")).toHaveCount(0);

    /*
     * La prueba de fondo: que haya al menos una grilla de cancha significa que
     * el front pidió el catálogo a la API y lo dibujó. Sin esto el test pasaría
     * con la API devolviendo vacío. Se busca por el `aria-label` del grupo y no
     * por el nombre de una cancha, que es dato del seed y ya cambió una vez.
     */
    await expect(
      page.locator('[aria-label^="Turnos de "]').first(),
    ).toBeVisible();
  });

  test("un domingo avisa que el club no abre", async ({ page }) => {
    await page.goto(`/disponibilidad?fecha=${proximo(DOMINGO)}`);

    await expect(page.getByText("El club no abre este día")).toBeVisible();
  });
});
