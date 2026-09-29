import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Spec `reservas`, requisito "Pantalla de reserva". Tres casos de navegador:
 * turno ausente o mal formado, el total a la vista y la reserva confirmada. Los
 * otros escenarios de la pantalla se verifican a mano, salvo "Visitante sin
 * sesión", que ya cubre el loop de rutas privadas de `autenticacion.spec.ts`.
 *
 * Nada de ids ni de horarios fijos: la cancha, el ítem y el turno libre se
 * consultan a la API en cada corrida. Si se hardcodearan, la primera reserva
 * dejaría el turno ocupado y la corrida siguiente fallaría.
 */

const API = process.env.API_URL?.trim() || "http://localhost:3000/api/v1";

/** El próximo día de la semana pedido, siempre futuro y nunca "hoy". */
function proximo(diaDeLaSemana: number): string {
  const fecha = new Date();
  fecha.setUTCHours(12, 0, 0, 0);
  do {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  } while (fecha.getUTCDay() !== diaDeLaSemana);
  return fecha.toISOString().slice(0, 10);
}

const LUNES = 1;

type Cancha = {
  id: number;
  nombre: string;
  disciplinaId: number;
  precioPorTurno: number;
};
type Equipamiento = { id: number; nombre: string; precioPorTurno: number; stockTotal: number };

const leer = async <T>(request: APIRequestContext, ruta: string): Promise<T> => {
  const respuesta = await request.get(`${API}${ruta}`);
  expect(
    respuesta.ok(),
    `La API no respondió ${ruta}. Estos tests necesitan la pila entera levantada.`,
  ).toBe(true);
  return respuesta.json() as Promise<T>;
};

/**
 * Una cancha con su ítem de equipamiento más caro dentro de la disciplina, y un
 * turno **libre** de esa cancha en el día pedido. El turno sale de la API para
 * no chocar con reservas de corridas anteriores.
 */
async function turnoParaReservar(request: APIRequestContext, fecha: string) {
  const canchas = await leer<Cancha[]>(request, "/canchas");

  // La combinación que pide el caso del total: cancha de 14000 e ítem de 2500.
  const cancha = canchas.find((candidata) => candidata.precioPorTurno === 14_000);
  expect(
    cancha,
    "El catálogo no tiene una cancha de 14000: si cambió el seed, actualizá este test.",
  ).toBeDefined();

  /*
   * El filtro por disciplina lo hace la API, no el test: un ítem de otra
   * disciplina no se puede alquilar en esta cancha (RN-08), y filtrarlo acá a
   * mano ya eligió una raqueta de tenis para una cancha de pádel.
   */
  const equipamiento = await leer<Equipamiento[]>(
    request,
    `/equipamiento?disciplinaId=${cancha!.disciplinaId}`,
  );

  const item = equipamiento.find(
    (candidato) => candidato.precioPorTurno === 2_500 && candidato.stockTotal >= 2,
  );
  expect(
    item,
    "El catálogo no tiene un ítem de 2500 con stock: si cambió el seed, actualizá este test.",
  ).toBeDefined();

  const disponibilidad = await leer<{
    canchas: { canchaId: number; slots: { horaInicio: string }[] }[];
  }>(request, `/disponibilidad?fecha=${fecha}&canchaId=${cancha!.id}`);

  const libres = disponibilidad.canchas.find((c) => c.canchaId === cancha!.id)?.slots ?? [];
  expect(libres.length, `La cancha ${cancha!.nombre} no tiene turnos libres el ${fecha}.`).toBeGreaterThan(0);

  return { cancha: cancha!, item: item!, horaInicio: libres[0].horaInicio, fecha };
}

/** Se registra un socio propio en cada corrida, como los otros e2e del front. */
async function ingresarComoSocio(page: import("@playwright/test").Page) {
  const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await page.goto("/registro");
  await page.getByLabel("Nombre").fill("E2E");
  await page.getByLabel("Apellido").fill(`Reserva ${marca}`);
  await page.getByLabel("Mail").fill(`e2e-reserva-${marca}@e2e.test`);
  await page.getByLabel("Contraseña").fill("clave-e2e-1234");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // Con sesión, el header deja de ofrecer "Ingresar".
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Ingresar" }),
  ).toHaveCount(0);
}

test.describe("Pantalla de reserva", () => {
  // Escenario "Turno ausente o mal formado en la dirección".
  test("sin un turno válido en la dirección, manda a elegir uno", async ({ page }) => {
    await ingresarComoSocio(page);

    for (const ruta of ["/reservar", "/reservar?canchaId=abc&fecha=2030-01-16&horaInicio=20:00"]) {
      await page.goto(ruta);

      await expect(
        page.getByRole("heading", { name: "Elegí un turno para reservar" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver disponibilidad" })).toBeVisible();
      // No se muestra un error de la API: no se la llamó.
      await expect(page.getByText("No pudimos preparar tu reserva")).toHaveCount(0);
    }
  });

  // Escenario "Total a la vista": 14000 de cancha + 2 × 2500 de equipamiento.
  test("el total se actualiza con el equipamiento elegido", async ({ page, request }) => {
    const { cancha, item, horaInicio, fecha } = await turnoParaReservar(request, proximo(LUNES));
    await ingresarComoSocio(page);

    await page.goto(
      `/reservar?canchaId=${cancha.id}&fecha=${fecha}&horaInicio=${horaInicio}`,
    );

    const total = page.getByTestId("total-a-la-vista");
    await expect(total).toHaveText(/14\.000/);

    await page.getByLabel(item.nombre).selectOption("2");
    await expect(total).toHaveText(/19\.000/);

    // El total es cosmético y la pantalla lo dice.
    await expect(
      page.getByText("El monto definitivo es el que confirma el club al crear la reserva."),
    ).toBeVisible();
  });

  // Escenario "Reserva confirmada".
  test("confirmar un turno libre devuelve el código de la reserva", async ({ page, request }) => {
    const { cancha, horaInicio, fecha } = await turnoParaReservar(request, proximo(LUNES));
    await ingresarComoSocio(page);

    await page.goto(
      `/reservar?canchaId=${cancha.id}&fecha=${fecha}&horaInicio=${horaInicio}`,
    );
    await page.getByRole("button", { name: "Confirmar reserva" }).click();

    await expect(page.getByRole("heading", { name: "Turno confirmado" })).toBeVisible();
    // El formato del código lo fija la spec: `<prefijo>-XXXXXX`.
    await expect(page.getByTestId("codigo-de-reserva")).toHaveText(/^[A-Z]{2,5}-[A-Z0-9]{6}$/);
    await expect(page.getByText("CONFIRMADA")).toBeVisible();

    /*
     * La prueba de que la reserva existe de verdad y no es solo pantalla: ese
     * turno deja de estar libre en la disponibilidad que devuelve la API.
     */
    const disponibilidad = await leer<{
      canchas: { canchaId: number; slots: { horaInicio: string }[] }[];
    }>(request, `/disponibilidad?fecha=${fecha}&canchaId=${cancha.id}`);
    const libres = disponibilidad.canchas.find((c) => c.canchaId === cancha.id)?.slots ?? [];
    expect(libres.map((slot) => slot.horaInicio)).not.toContain(horaInicio);
  });
});
