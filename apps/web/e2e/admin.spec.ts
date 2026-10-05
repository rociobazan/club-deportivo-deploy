import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

/**
 * Pantallas de administración (ítem 1.6): specs `administracion`, `catalogo`
 * y `reservas`, requisitos de pantalla.
 *
 * Entra con el ADMIN del seed (`admin@club.test`): el job `e2e` del CI corre el
 * seed. Los socios se registran por la API con el prefijo `@e2e.test`, como en
 * las otras specs.
 *
 * **La cancha que crea este archivo no se puede borrar**: la API no tiene
 * `DELETE` y desde acá no hay acceso a la base. Por eso lleva un nombre único
 * con timestamp, para no chocar con el 409 en una segunda corrida local, y el
 * `afterAll` la deja **dada de baja**: este archivo corre primero (orden
 * alfabético, un worker), y una cancha activa de más aparecería en el
 * catálogo y en la disponibilidad que prueban las specs siguientes.
 */

const API = process.env.API_URL?.trim() || "http://localhost:3000/api/v1";
const ADMIN = { email: "admin@club.test", password: "clave1234" };
const CANCHA = `E2E-${Date.now()}`;

async function token(request: APIRequestContext, credenciales: { email: string; password: string }) {
  const login = await request.post(`${API}/auth/login`, { data: credenciales });
  expect(login.ok(), `No se pudo ingresar como ${credenciales.email} por la API.`).toBe(true);
  return ((await login.json()) as { accessToken: string }).accessToken;
}

/** Deja la cookie de sesión en el navegador, la misma que deja el login de la interfaz. */
async function conSesion(page: Page, context: BrowserContext, accessToken: string) {
  await page.goto("/");
  await context.addCookies([{ name: "sesion", value: accessToken, url: page.url() }]);
}

async function socioNuevo(request: APIRequestContext) {
  const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const socio = {
    nombre: "E2E",
    apellido: `Admin ${marca}`,
    email: `e2e-admin-${marca}@e2e.test`,
    password: "clave-e2e-1234",
  };
  const registro = await request.post(`${API}/auth/registro`, { data: socio });
  expect(registro.ok(), "No se pudo registrar el socio de prueba por la API.").toBe(true);
  // Solo mail y contraseña: el login rechaza cualquier campo de más.
  return { ...socio, token: await token(request, { email: socio.email, password: socio.password }) };
}

/** El próximo viernes: las otras specs reservan de lunes a jueves, y la base es compartida. */
function proximoViernes(): string {
  const fecha = new Date();
  fecha.setUTCHours(12, 0, 0, 0);
  do {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  } while (fecha.getUTCDay() !== 5);
  return fecha.toISOString().slice(0, 10);
}

test.describe("Administración", () => {
  test.afterAll(async ({ request }) => {
    const admin = await token(request, ADMIN);
    const canchas = await request.get(`${API}/canchas?incluirInactivas=true`, {
      headers: { Authorization: `Bearer ${admin}` },
    });
    const creada = ((await canchas.json()) as { id: number; nombre: string }[]).find(
      (c) => c.nombre === CANCHA,
    );
    if (!creada) return;
    await request.patch(`${API}/canchas/${creada.id}`, {
      headers: { Authorization: `Bearer ${admin}` },
      data: { activa: false },
    });
  });

  test("Panel de hoy: el ADMIN ve las métricas, la ocupación por cancha y los próximos turnos", async ({
    page,
    context,
    request,
  }) => {
    await conSesion(page, context, await token(request, ADMIN));

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Panel del club" })).toBeVisible();
    const metricas = page.getByRole("region", { name: "Métricas del día" });
    for (const titulo of ["Reservas del día", "Facturación prevista", "Ocupación del día", "Cancelaciones"]) {
      await expect(metricas.getByText(titulo)).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Ocupación por cancha" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Próximos turnos de hoy" })).toBeVisible();
  });

  test("Socio en el panel: ve el aviso y ninguna métrica del club", async ({ page, context, request }) => {
    const socio = await socioNuevo(request);
    await conSesion(page, context, socio.token);

    await page.goto("/admin");

    await expect(page.getByText("Esta sección es solo para administradores")).toBeVisible();
    await expect(page.getByText("Reservas del día")).toHaveCount(0);
  });

  test("Alta de una cancha desde la pantalla, y Baja y reactivación", async ({ page, context, request }) => {
    await conSesion(page, context, await token(request, ADMIN));
    await page.goto("/admin/canchas");

    const alta = page.getByRole("form", { name: "Nueva cancha" });
    await alta.getByLabel("Disciplina").selectOption({ label: "Pádel" });
    await alta.getByLabel("Nombre").fill(CANCHA);
    await alta.getByLabel("Precio por turno").fill("15000");
    await alta.getByRole("button", { name: "Dar de alta" }).click();

    const fila = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: CANCHA }) });
    await expect(fila.getByText("Activa", { exact: true })).toBeVisible();
    await expect(alta.getByLabel("Nombre")).toHaveValue("");

    await fila.getByRole("button", { name: `Dar de baja ${CANCHA}` }).click();
    await expect(fila.getByText("Dada de baja")).toBeVisible();

    await fila.getByRole("button", { name: `Reactivar ${CANCHA}` }).click();
    await expect(fila.getByText("Activa", { exact: true })).toBeVisible();
  });

  /*
   * La reserva es de otro día: en un test de navegador no se puede fijar el
   * reloj de la API para tener un turno que empiece en menos de 2 horas. Que
   * un ADMIN cancele **sin el plazo** lo prueba el e2e de la API ("Administrador
   * fuera de plazo"); acá se prueba que la pantalla lo deja hacer, con motivo.
   */
  test("Cancelación desde la administración: el ADMIN cancela la reserva de un socio con motivo", async ({
    page,
    context,
    request,
  }) => {
    const socio = await socioNuevo(request);
    const fecha = proximoViernes();
    const consulta = await request.get(`${API}/disponibilidad?fecha=${fecha}`);
    const { canchas } = (await consulta.json()) as {
      canchas: { canchaId: number; slots: { horaInicio: string }[] }[];
    };
    const libre = canchas.find((c) => c.slots.length > 0);
    expect(libre, `No hay turnos libres el ${fecha}.`).toBeDefined();
    const creada = await request.post(`${API}/reservas`, {
      headers: { Authorization: `Bearer ${socio.token}` },
      data: { canchaId: libre!.canchaId, fecha, horaInicio: libre!.slots[0].horaInicio },
    });
    expect(creada.status(), await creada.text()).toBe(201);
    const { codigo } = (await creada.json()) as { codigo: string };

    await conSesion(page, context, await token(request, ADMIN));
    await page.goto(`/admin/reservas?q=${codigo}`);
    await page.getByRole("link", { name: `Ver detalle de ${codigo}` }).click();

    await expect(page.getByText(`${socio.nombre} ${socio.apellido}`)).toBeVisible();
    await page.getByLabel("Motivo (opcional)").fill("Mantenimiento de la cancha");
    await page.getByRole("button", { name: "Cancelar esta reserva" }).click();

    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(page.getByText("Mantenimiento de la cancha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar esta reserva" })).toHaveCount(0);
  });
});
