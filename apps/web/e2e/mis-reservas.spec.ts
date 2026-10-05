import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * Spec `reservas`, requisitos de "Mis reservas" y su detalle (ítem 1.4).
 *
 * Cada corrida se registra su propio usuario con el prefijo `@e2e.test`, igual
 * que `perfil.spec.ts`: no hace falta sembrar nada y los tests no dependen del
 * seed ni de otra corrida.
 *
 * Los casos **con reservas** (la lista, las pestañas y la cancelación) crean
 * las reservas por la API con `POST /reservas`, que existe desde el ítem 1.3, y
 * prueban en el navegador solo esta pantalla. Reservar desde la interfaz ya lo
 * cubre `reservar.spec.ts`; repetirlo acá haría estos tests más lentos y
 * dependientes de otra pantalla.
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
async function registrarse(page: Page) {
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

/*
 * Martes, miércoles y jueves: `reservar.spec.ts` reserva los lunes, y la base
 * es compartida. Cada reserva igual busca un turno libre en la API, así que un
 * choque no rompe el test, pero en días distintos ni siquiera compiten.
 */
const MARTES = 2;
const MIERCOLES = 3;
const JUEVES = 4;

type Reserva = { id: number; codigo: string; cancha: string; horaInicio: string };

/**
 * Socio nuevo, registrado e ingresado por la API, con la cookie de sesión ya
 * puesta en el navegador. Es la misma cookie que deja el login de la interfaz.
 */
async function socioConSesion(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
): Promise<string> {
  const usuario = usuarioDePrueba();
  const registro = await request.post(`${API}/auth/registro`, { data: usuario });
  expect(registro.ok(), "No se pudo registrar el socio de prueba por la API.").toBe(true);

  const login = await request.post(`${API}/auth/login`, {
    data: { email: usuario.email, password: usuario.password },
  });
  expect(login.ok(), "No se pudo ingresar con el socio de prueba por la API.").toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };

  await page.goto("/");
  await context.addCookies([{ name: "sesion", value: accessToken, url: page.url() }]);
  return accessToken;
}

/** Reserva el primer turno libre de ese día, en cualquier cancha. */
async function reservar(
  request: APIRequestContext,
  token: string,
  fecha: string,
): Promise<Reserva> {
  const consulta = await request.get(`${API}/disponibilidad?fecha=${fecha}`);
  expect(consulta.ok(), "La API no respondió la disponibilidad.").toBe(true);
  const { canchas } = (await consulta.json()) as {
    canchas: { canchaId: number; slots: { horaInicio: string }[] }[];
  };
  const libre = canchas.find((cancha) => cancha.slots.length > 0);
  expect(libre, `No hay turnos libres el ${fecha}.`).toBeDefined();

  const respuesta = await request.post(`${API}/reservas`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { canchaId: libre!.canchaId, fecha, horaInicio: libre!.slots[0].horaInicio },
  });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return (await respuesta.json()) as Reserva;
}

async function cancelarPorApi(request: APIRequestContext, token: string, id: number) {
  const respuesta = await request.patch(`${API}/reservas/${id}/cancelacion`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
}

/** La tarjeta de una reserva en la lista, ubicada por su código. */
const tarjeta = (page: Page, codigo: string) =>
  page.getByRole("listitem").filter({ hasText: codigo });

/** Deja una cookie de sesión que existe pero no vale, sin pasar por el login. */
async function conSesionInvalida(
  page: Page,
  context: BrowserContext,
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

  test("Socio con reservas: cada una muestra cancha, horario, código y el acceso al detalle", async ({
    page,
    context,
    request,
  }) => {
    const token = await socioConSesion(page, context, request);
    const reserva = await reservar(request, token, proximo(MARTES));

    await page.goto("/mis-reservas");

    const fila = tarjeta(page, reserva.codigo);
    await expect(fila).toBeVisible();
    await expect(fila.getByText(reserva.cancha)).toBeVisible();
    await expect(fila.getByText(new RegExp(`${reserva.horaInicio} a `))).toBeVisible();
    await expect(fila.getByText("Confirmada")).toBeVisible();

    await fila.getByRole("link", { name: "Ver detalle" }).click();
    await expect(page).toHaveURL(`/mis-reservas/${reserva.id}`);
    await expect(page.getByText(reserva.codigo)).toBeVisible();
  });

  test("las pestañas separan las activas de las canceladas", async ({ page, context, request }) => {
    const token = await socioConSesion(page, context, request);
    const activa = await reservar(request, token, proximo(MARTES));
    const cancelada = await reservar(request, token, proximo(MIERCOLES));
    await cancelarPorApi(request, token, cancelada.id);

    await page.goto("/mis-reservas");

    // Arranca en "Activas": la cancelada no aparece.
    await expect(page.getByRole("tab", { name: "Activas (1)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(tarjeta(page, activa.codigo)).toBeVisible();
    await expect(tarjeta(page, cancelada.codigo)).toHaveCount(0);

    await page.getByRole("tab", { name: "Historial (1)" }).click();

    await expect(tarjeta(page, cancelada.codigo)).toBeVisible();
    await expect(tarjeta(page, cancelada.codigo).getByText("Cancelada")).toBeVisible();
    await expect(tarjeta(page, activa.codigo)).toHaveCount(0);
  });

  test("cancelar desde el detalle deja la reserva cancelada y la pasa al historial", async ({
    page,
    context,
    request,
  }) => {
    const token = await socioConSesion(page, context, request);
    const reserva = await reservar(request, token, proximo(JUEVES));

    await page.goto(`/mis-reservas/${reserva.id}`);
    await page.getByRole("button", { name: "Cancelar esta reserva" }).click();

    // La misma página vuelve con los datos nuevos: badge cancelado y sin botón.
    await expect(page.getByText("Cancelada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar esta reserva" })).toHaveCount(0);

    await page.getByRole("link", { name: "← Mis reservas" }).click();
    await expect(page.getByRole("tab", { name: "Activas (0)" })).toBeVisible();
    await page.getByRole("tab", { name: "Historial (1)" }).click();
    await expect(tarjeta(page, reserva.codigo)).toBeVisible();
  });

  test("reenviar el mail desde el detalle confirma a qué dirección salió", async ({
    page,
    context,
    request,
  }) => {
    const token = await socioConSesion(page, context, request);
    const reserva = await reservar(request, token, proximo(MIERCOLES));

    await page.goto(`/mis-reservas/${reserva.id}`);
    await page.getByRole("button", { name: "Reenviar el mail" }).click();

    await expect(page.getByRole("status")).toContainText("Te reenviamos el mail a ");
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
