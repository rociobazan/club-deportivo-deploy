import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aFechaDb } from '../src/common/fechas';
import { Momento, Reloj } from '../src/common/reloj';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Un `describe` por requisito de creación de `openspec/specs/reservas/spec.md` y
 * un `it` por escenario, más algunos tests extra marcados como tales, que
 * custodian decisiones del `design.md` sin corresponder a un escenario.
 *
 * El Reloj se reemplaza por uno fijo para que "hoy" no dependa del runner, y las
 * fechas están elegidas por su día de la semana: el 2030-01-15 es martes, el 19
 * sábado y el 20 domingo. Datos propios (`e2e …`, `@e2e.test`) y las reservas de
 * esos usuarios se borran después de cada test, así RN-07 no arrastra estado.
 */
describe('reservas: creación (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const HOY = '2030-01-15';
  const MANIANA = '2030-01-16';
  const SABADO = '2030-01-19';
  const DOMINGO = '2030-01-20';
  /** Hoy más el horizonte por defecto (30 días): el límite es inclusivo. */
  const ULTIMO_DIA = '2030-02-14';
  const PASADO_EL_HORIZONTE = '2030-02-15';
  const momento: Momento = { fecha: HOY, hora: '10:00' };

  const api = () => request(app.getHttpServer());
  const bearer = (usuarioId: number, rol: 'ADMIN' | 'SOCIO' = 'SOCIO') =>
    `Bearer ${jwt.sign({ sub: usuarioId, rol })}`;

  let socioId: number;
  let otroSocioId: number;
  let adminId: number;
  let tenisId: number;
  let padelId: number;
  let tenis1: number;
  let tenis2: number;
  let padel1: number;
  let padel2: number;
  let canchaInactiva: number;
  let paleta: number;
  let paletaDeBaja: number;

  type Cuerpo = {
    canchaId: number;
    fecha: string;
    horaInicio: string;
    cantidadJugadores?: number;
    equipamiento?: { equipamientoId: number; cantidad: number }[];
  };

  const reservar = (cuerpo: Cuerpo, usuarioId = socioId, rol: 'ADMIN' | 'SOCIO' = 'SOCIO') =>
    api().post('/api/v1/reservas').set('Authorization', bearer(usuarioId, rol)).send(cuerpo);

  /** Un turno de tenis válido en cualquier día hábil: 11:00 a 12:00. */
  const turno = (extra: Partial<Cuerpo> = {}): Cuerpo => ({
    canchaId: tenis1,
    fecha: MANIANA,
    horaInicio: '11:00',
    ...extra,
  });

  /** Reserva puesta a mano, para armar el estado previo de un escenario. */
  let contador = 0;
  const reservaEnLaBase = (datos: {
    canchaId: number;
    fecha: string;
    horaInicio: string;
    usuarioId?: number;
    horaFin?: string;
    estado?: 'CONFIRMADA' | 'CANCELADA';
    equipamiento?: { equipamientoId: number; cantidad: number; precioUnitario?: number }[];
  }) =>
    prisma.reserva.create({
      data: {
        codigo: `E2E-R${(++contador).toString().padStart(4, '0')}`,
        usuarioId: datos.usuarioId ?? socioId,
        canchaId: datos.canchaId,
        fecha: aFechaDb(datos.fecha),
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin ?? '12:00',
        estado: datos.estado ?? 'CONFIRMADA',
        montoCancha: 9000,
        montoEquipamiento: 0,
        montoTotal: 9000,
        ...(datos.equipamiento
          ? {
              equipamiento: {
                // El precio no importa en los escenarios que usan este helper:
                // lo que se mide es la cantidad que consume stock.
                create: datos.equipamiento.map((item) => ({
                  ...item,
                  precioUnitario: item.precioUnitario ?? 2500,
                })),
              },
            }
          : {}),
      },
    });

  const activasEnElSlot = (canchaId: number, fecha: string, horaInicio: string) =>
    prisma.reserva.count({
      where: { canchaId, fecha: aFechaDb(fecha), horaInicio, estado: { not: 'CANCELADA' } },
    });

  /** Las reservas hechas por la API llevan código RES-…, así que se borran por usuario. */
  const limpiarReservas = () =>
    prisma.reserva.deleteMany({ where: { usuario: { email: { endsWith: '@e2e.test' } } } });

  async function limpiarTodo() {
    await limpiarReservas();
    await prisma.equipamiento.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.cancha.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.disciplina.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
  }

  async function crearApp(): Promise<INestApplication<App>> {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Reloj)
      .useValue({ ahora: () => momento })
      .compile();
    const nueva: INestApplication<App> = modulo.createNestApplication();
    await configurarApp(nueva);
    return nueva;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.JWT_EXPIRES_IN = '1h';
    // Otro archivo e2e pudo haberlas dejado seteadas: acá se quieren los defaults.
    for (const variable of [
      'HORA_APERTURA',
      'HORA_CIERRE',
      'HORA_CIERRE_SABADO',
      'DIAS_CERRADOS',
      'HORIZONTE_RESERVA_DIAS',
      'MAX_RESERVAS_ACTIVAS_SOCIO',
      'PREFIJO_CODIGO_RESERVA',
    ]) {
      delete process.env[variable];
    }

    app = await crearApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await limpiarTodo();

    const crearUsuario = (email: string, apellido: string) =>
      prisma.usuario.create({
        data: { nombre: 'E2E', apellido, email, passwordHash: 'x' },
      });
    socioId = (await crearUsuario('socio-reservas@e2e.test', 'Socio')).id;
    otroSocioId = (await crearUsuario('otro-socio-reservas@e2e.test', 'Otro')).id;
    adminId = (await crearUsuario('admin-reservas@e2e.test', 'Admin')).id;

    tenisId = (await prisma.disciplina.create({
      data: { nombre: 'e2e Tenis reservas', duracionTurnoMin: 60 },
    })).id;
    padelId = (await prisma.disciplina.create({
      data: { nombre: 'e2e Pádel reservas', duracionTurnoMin: 90 },
    })).id;

    const crearCancha = (disciplinaId: number, nombre: string, precio: number, activa = true) =>
      prisma.cancha.create({ data: { disciplinaId, nombre, precioPorTurno: precio, activa } });
    tenis1 = (await crearCancha(tenisId, 'e2e Tenis 1', 9000)).id;
    tenis2 = (await crearCancha(tenisId, 'e2e Tenis 2', 8000)).id;
    padel1 = (await crearCancha(padelId, 'e2e Pádel 1', 14000)).id;
    padel2 = (await crearCancha(padelId, 'e2e Pádel 2', 14000)).id;
    canchaInactiva = (await crearCancha(tenisId, 'e2e Tenis de baja', 9000, false)).id;

    const crearEquipamiento = (
      disciplinaId: number,
      nombre: string,
      stockTotal: number,
      precio: number,
      activo = true,
    ) =>
      prisma.equipamiento.create({
        data: { disciplinaId, nombre, stockTotal, precioPorTurno: precio, activo },
      });
    paleta = (await crearEquipamiento(padelId, 'e2e Paleta de pádel', 6, 2500)).id;
    // Equipamiento de tenis, para que la disciplina tenga stock propio en la base.
    await crearEquipamiento(tenisId, 'e2e Raqueta de tenis', 4, 1500);
    paletaDeBaja = (await crearEquipamiento(padelId, 'e2e Paleta de baja', 6, 2500, false)).id;
  });

  afterEach(limpiarReservas);

  afterAll(async () => {
    await limpiarTodo();
    await app.close();
  });

  describe('Creación de reserva a nombre del usuario autenticado', () => {
    // Escenario "Reserva de un turno libre".
    it('un SOCIO reserva un turno libre y recibe 201 con Location', async () => {
      const { body, headers } = await reservar(
        turno({ canchaId: padel1, horaInicio: '20:00' }),
      ).expect(201);

      expect(body).toMatchObject({
        clienteId: socioId,
        canchaId: padel1,
        fecha: MANIANA,
        horaInicio: '20:00',
        // Pádel son turnos de 90 minutos.
        horaFin: '21:30',
        estado: 'CONFIRMADA',
        montoTotal: 14000,
      });
      expect(body.codigo).toMatch(/^RES-[A-Z0-9]{6}$/);
      expect(headers.location).toBe(`/api/v1/reservas/${body.id}`);
    });

    // Escenario "Creación sin token".
    it('sin token responde 401 y no crea nada', async () => {
      const { body } = await api()
        .post('/api/v1/reservas')
        .send(turno())
        .expect(401);

      expect(body).toMatchObject({ tipo: 'NO_AUTENTICADO', estado: 401 });
      await expect(activasEnElSlot(tenis1, MANIANA, '11:00')).resolves.toBe(0);
    });

    // Escenario "Intento de reservar a nombre de otro".
    it('un clienteId en el body responde 400 y no crea nada', async () => {
      const { body } = await reservar({
        ...turno(),
        clienteId: otroSocioId,
      } as Cuerpo).expect(400);

      expect(body).toMatchObject({ tipo: 'SOLICITUD_INVALIDA', estado: 400 });
      await expect(activasEnElSlot(tenis1, MANIANA, '11:00')).resolves.toBe(0);
    });

    // Escenario "Cancha inexistente o inactiva".
    it('una cancha inexistente o inactiva responde 404', async () => {
      const inexistente = await reservar(turno({ canchaId: 999_999 })).expect(404);
      expect(inexistente.body).toMatchObject({ tipo: 'NO_ENCONTRADO', estado: 404 });

      const inactiva = await reservar(turno({ canchaId: canchaInactiva })).expect(404);
      expect(inactiva.body).toMatchObject({ tipo: 'NO_ENCONTRADO' });
    });
  });

  describe('Código de reserva legible', () => {
    // Escenario "Código con el prefijo por defecto".
    it('sin PREFIJO_CODIGO_RESERVA el código arranca con RES', async () => {
      const { body } = await reservar(turno()).expect(201);
      expect(body.codigo).toMatch(/^RES-[A-Z0-9]{6}$/);
    });

    // Escenario "Códigos distintos".
    it('dos reservas tienen códigos distintos', async () => {
      const una = await reservar(turno({ horaInicio: '11:00' })).expect(201);
      const otra = await reservar(turno({ horaInicio: '12:00' })).expect(201);
      expect(una.body.codigo).not.toBe(otra.body.codigo);
    });

    // Escenario "Código con prefijo configurado": app aparte, porque la
    // configuración se lee una sola vez al arrancar.
    it('con PREFIJO_CODIGO_RESERVA en CUM el código arranca con CUM', async () => {
      process.env.PREFIJO_CODIGO_RESERVA = 'CUM';
      const otraApp = await crearApp();
      await otraApp.init();

      try {
        const { body } = await request(otraApp.getHttpServer())
          .post('/api/v1/reservas')
          .set('Authorization', bearer(socioId))
          .send(turno({ horaInicio: '13:00' }))
          .expect(201);
        expect(body.codigo).toMatch(/^CUM-[A-Z0-9]{6}$/);
      } finally {
        await otraApp.close();
        delete process.env.PREFIJO_CODIGO_RESERVA;
      }
    });
  });

  describe('Un solo turno activo por cancha (RN-01)', () => {
    // Escenario "Turno ya reservado".
    it('un turno ya reservado responde 409 SLOT_NO_DISPONIBLE', async () => {
      await reservaEnLaBase({ canchaId: tenis1, fecha: MANIANA, horaInicio: '19:00' });

      const { body } = await reservar(turno({ horaInicio: '19:00' }), otroSocioId).expect(409);
      expect(body).toMatchObject({ tipo: 'SLOT_NO_DISPONIBLE', estado: 409 });
      await expect(activasEnElSlot(tenis1, MANIANA, '19:00')).resolves.toBe(1);
    });

    /*
     * Escenario "Dos solicitudes simultáneas por el mismo turno". Es el único
     * test que prueba RN-01 bajo concurrencia real, sin mocks.
     *
     * Los dos POST salen de **socios distintos** a propósito: con el mismo socio,
     * el lock `FOR UPDATE` de la fila de usuario (design.md §3) los serializaría.
     *
     * Ojo con lo que este test prueba y lo que no. Prueba el resultado que pide la
     * spec: un 201, un 409 y una sola fila. **No** prueba que el árbitro sea el
     * índice: se comprobó desactivando el `catch` del P2002 y el test seguía
     * pasando, porque en la práctica la primera transacción commitea antes de que
     * la segunda llegue al pre-chequeo. Quien prueba el camino del índice es el
     * test siguiente, que lo fuerza de forma determinista.
     */
    it('dos solicitudes simultáneas dejan exactamente un 201, un 409 y una sola fila', async () => {
      const cuerpo = turno({ horaInicio: '21:00' });

      const respuestas = await Promise.all([
        reservar(cuerpo, socioId),
        reservar(cuerpo, otroSocioId),
      ]);

      expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
      const rechazada = respuestas.find((r) => r.status === 409);
      expect(rechazada?.body).toMatchObject({ tipo: 'SLOT_NO_DISPONIBLE', estado: 409 });
      await expect(activasEnElSlot(tenis1, MANIANA, '21:00')).resolves.toBe(1);
    });

    /*
     * Extra, no es un escenario de la spec, y es el test que de verdad prueba que
     * RN-01 lo garantiza el índice y no el pre-chequeo. Fuerza el camino que la
     * carrera de arriba no alcanza, de forma determinista:
     *
     * 1. Una transacción aparte inserta la fila del turno y **queda abierta**.
     * 2. Con aislamiento *read committed*, el pre-chequeo del pedido HTTP no ve
     *    esa fila sin commitear, así que pasa.
     * 3. Su INSERT choca contra `ux_reserva_slot_activo` y PostgreSQL lo deja
     *    esperando hasta que la otra transacción resuelva.
     * 4. Al commitear la primera, el INSERT falla con P2002 y sale el 409.
     *
     * Si se comenta el `catch` del P2002 en `insertar()`, este test devuelve 500 y
     * falla. Es el candado de la decisión 2 del design.
     */
    it('extra: el índice es el árbitro y el INSERT bloqueado termina en 409', async () => {
      const cuerpo = turno({ canchaId: tenis2, horaInicio: '15:00' });

      let liberar = () => {};
      const commitear = new Promise<void>((resolver) => {
        liberar = resolver;
      });

      const bloqueante = prisma.$transaction(
        async (tx) => {
          await tx.reserva.create({
            data: {
              codigo: 'E2E-BLOQ01',
              usuarioId: otroSocioId,
              canchaId: tenis2,
              fecha: aFechaDb(MANIANA),
              horaInicio: '15:00',
              horaFin: '16:00',
              montoCancha: 8000,
              montoEquipamiento: 0,
              montoTotal: 8000,
            },
          });
          await commitear;
        },
        { timeout: 20_000 },
      );

      const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));
      // Que la fila ya esté insertada y la transacción siga abierta.
      await esperar(250);

      /*
       * El `.then()` no es decorativo: el `Test` de supertest es un thenable que
       * recién manda el pedido cuando alguien lo consume. Sin esto, el pedido
       * saldría después del commit y el 409 vendría del pre-chequeo, con lo cual
       * el test pasaría sin ejercitar el índice. Pasó de verdad mientras se
       * escribía.
       */
      const enVuelo = reservar(cuerpo, socioId).then((respuesta) => respuesta);
      // Que el pedido llegue hasta su INSERT y quede esperando en el índice.
      await esperar(400);
      liberar();
      await bloqueante;

      const { status, body } = await enVuelo;
      expect(status).toBe(409);
      expect(body).toMatchObject({ tipo: 'SLOT_NO_DISPONIBLE', estado: 409 });
      await expect(activasEnElSlot(tenis2, MANIANA, '15:00')).resolves.toBe(1);
    });

    // Escenario "Turno liberado por una cancelación".
    it('un turno cuya reserva se canceló se puede reservar de nuevo', async () => {
      await reservaEnLaBase({
        canchaId: tenis1,
        fecha: MANIANA,
        horaInicio: '18:00',
        estado: 'CANCELADA',
      });

      await reservar(turno({ horaInicio: '18:00' }), otroSocioId).expect(201);
    });
  });

  describe('Turno dentro de la grilla y del horario de atención (RN-09)', () => {
    // Escenario "Hora que no coincide con un turno".
    it('una hora que no es el inicio de un turno responde 422', async () => {
      const tenis = await reservar(turno({ horaInicio: '19:15' })).expect(422);
      expect(tenis.body).toMatchObject({ tipo: 'HORARIO_FUERA_DE_TURNO', estado: 422 });

      // En pádel los turnos son de 90 minutos desde las 08:00: 09:00 no existe.
      const padel = await reservar(turno({ canchaId: padel1, horaInicio: '09:00' })).expect(422);
      expect(padel.body).toMatchObject({ tipo: 'HORARIO_FUERA_DE_TURNO' });
    });

    // Escenario "Hora fuera del horario de atención".
    it('antes de la apertura responde 422', async () => {
      const { body } = await reservar(turno({ horaInicio: '07:00' })).expect(422);
      expect(body).toMatchObject({ tipo: 'HORARIO_FUERA_DE_TURNO' });
    });

    // Escenario "Sábado después del cierre propio".
    it('un sábado a las 19:00 responde 422, aunque el lunes ese turno exista', async () => {
      const sabado = await reservar(turno({ fecha: SABADO, horaInicio: '19:00' })).expect(422);
      expect(sabado.body).toMatchObject({ tipo: 'HORARIO_FUERA_DE_TURNO' });

      await reservar(turno({ horaInicio: '19:00' })).expect(201);
    });

    // Escenario "Día cerrado".
    it('un domingo responde 422 y no crea nada', async () => {
      const { body } = await reservar(turno({ fecha: DOMINGO, horaInicio: '11:00' })).expect(422);
      expect(body).toMatchObject({ tipo: 'HORARIO_FUERA_DE_TURNO' });
      await expect(activasEnElSlot(tenis1, DOMINGO, '11:00')).resolves.toBe(0);
    });
  });

  describe('Fecha y hora reservables (RN-02, RN-03)', () => {
    // Escenario "Horario ya transcurrido": el reloj está fijo en las 10:00 de hoy.
    it('un turno de hoy que ya empezó responde 422', async () => {
      const { body } = await reservar(turno({ fecha: HOY, horaInicio: '09:00' })).expect(422);
      expect(body).toMatchObject({ tipo: 'FECHA_EN_EL_PASADO', estado: 422 });
    });

    // Escenario "Fecha más allá del horizonte".
    it('pasado el horizonte responde 422', async () => {
      const { body } = await reservar(turno({ fecha: PASADO_EL_HORIZONTE })).expect(422);
      expect(body).toMatchObject({ tipo: 'HORIZONTE_EXCEDIDO', estado: 422 });
    });

    // Escenario "Último día del horizonte": el límite es inclusivo.
    it('el último día del horizonte se puede reservar', async () => {
      await reservar(turno({ fecha: ULTIMO_DIA })).expect(201);
    });
  });

  describe('Límite de reservas activas por socio (RN-07)', () => {
    const tresActivas = (usuarioId: number) =>
      Promise.all([
        reservaEnLaBase({ canchaId: tenis1, fecha: MANIANA, horaInicio: '08:00', usuarioId }),
        reservaEnLaBase({ canchaId: tenis1, fecha: MANIANA, horaInicio: '09:00', usuarioId }),
        reservaEnLaBase({ canchaId: tenis1, fecha: MANIANA, horaInicio: '10:00', usuarioId }),
      ]);

    // Escenario "Cuarta reserva de un socio".
    it('la cuarta reserva activa de un socio responde 422', async () => {
      await tresActivas(socioId);

      const { body } = await reservar(turno({ horaInicio: '14:00' })).expect(422);
      expect(body).toMatchObject({ tipo: 'LIMITE_RESERVAS_ACTIVAS', estado: 422 });
      await expect(activasEnElSlot(tenis1, MANIANA, '14:00')).resolves.toBe(0);
    });

    // Escenario "Administrador sin límite".
    it('un ADMIN con cinco activas puede crear otra', async () => {
      await tresActivas(adminId);
      await reservaEnLaBase({ canchaId: tenis2, fecha: MANIANA, horaInicio: '08:00', usuarioId: adminId });
      await reservaEnLaBase({ canchaId: tenis2, fecha: MANIANA, horaInicio: '09:00', usuarioId: adminId });

      await reservar(turno({ horaInicio: '16:00' }), adminId, 'ADMIN').expect(201);
    });

    // Escenario "Reservas canceladas y ya jugadas no cuentan".
    it('con dos activas, una cancelada y una ya jugada, el socio puede reservar', async () => {
      await reservaEnLaBase({ canchaId: tenis1, fecha: MANIANA, horaInicio: '08:00' });
      await reservaEnLaBase({ canchaId: tenis1, fecha: MANIANA, horaInicio: '09:00' });
      await reservaEnLaBase({
        canchaId: tenis1,
        fecha: MANIANA,
        horaInicio: '10:00',
        estado: 'CANCELADA',
      });
      // Turno de hoy ya terminado: el reloj está en las 10:00.
      await reservaEnLaBase({
        canchaId: tenis1,
        fecha: HOY,
        horaInicio: '08:00',
        horaFin: '09:00',
      });

      await reservar(turno({ horaInicio: '17:00' })).expect(201);
    });
  });

  describe('Equipamiento de la reserva (RN-05, RN-08)', () => {
    const conPaletas = (cantidad: number, canchaId = padel1, horaInicio = '20:00') =>
      turno({ canchaId, horaInicio, equipamiento: [{ equipamientoId: paleta, cantidad }] });

    // Escenario "Stock insuficiente en el turno".
    it('pedir más unidades de las disponibles responde 409', async () => {
      await reservaEnLaBase({
        canchaId: padel2,
        fecha: MANIANA,
        horaInicio: '20:00',
        horaFin: '21:30',
        equipamiento: [{ equipamientoId: paleta, cantidad: 4 }],
      });

      const { body } = await reservar(conPaletas(4)).expect(409);
      expect(body).toMatchObject({ tipo: 'STOCK_INSUFICIENTE', estado: 409 });
      expect(body.detalle).toContain('hay 2 disponibles');
    });

    // Escenario "Stock consumido desde otra cancha".
    it('el stock alquilado en otra cancha del mismo turno también cuenta', async () => {
      await reservaEnLaBase({
        canchaId: padel2,
        fecha: MANIANA,
        horaInicio: '20:00',
        horaFin: '21:30',
        equipamiento: [{ equipamientoId: paleta, cantidad: 4 }],
      });

      const { body } = await reservar(conPaletas(3)).expect(409);
      expect(body).toMatchObject({ tipo: 'STOCK_INSUFICIENTE' });
      // Dos sí entran: el stock es 6 y hay 4 alquiladas.
      await reservar(conPaletas(2)).expect(201);
    });

    // Escenario "Equipamiento de otra disciplina".
    it('equipamiento de otra disciplina responde 422', async () => {
      const { body } = await reservar(
        turno({ equipamiento: [{ equipamientoId: paleta, cantidad: 1 }] }),
      ).expect(422);

      expect(body).toMatchObject({ tipo: 'EQUIPAMIENTO_DE_OTRA_DISCIPLINA', estado: 422 });
      await expect(activasEnElSlot(tenis1, MANIANA, '11:00')).resolves.toBe(0);
    });

    // Escenario "Equipamiento inexistente o dado de baja".
    it('equipamiento inexistente o de baja responde 404', async () => {
      const inexistente = await reservar(
        turno({ canchaId: padel1, horaInicio: '20:00', equipamiento: [{ equipamientoId: 999_999, cantidad: 1 }] }),
      ).expect(404);
      expect(inexistente.body).toMatchObject({ tipo: 'NO_ENCONTRADO', estado: 404 });

      const deBaja = await reservar(
        turno({ canchaId: padel1, horaInicio: '20:00', equipamiento: [{ equipamientoId: paletaDeBaja, cantidad: 1 }] }),
      ).expect(404);
      expect(deBaja.body).toMatchObject({ tipo: 'NO_ENCONTRADO' });
    });

    // Escenario "Ítem repetido".
    it('el mismo equipamientoId dos veces responde 400', async () => {
      const { body } = await reservar(
        turno({
          canchaId: padel1,
          horaInicio: '20:00',
          equipamiento: [
            { equipamientoId: paleta, cantidad: 1 },
            { equipamientoId: paleta, cantidad: 2 },
          ],
        }),
      ).expect(400);

      expect(body).toMatchObject({ tipo: 'SOLICITUD_INVALIDA', estado: 400 });
    });
  });

  describe('Monto calculado con precio plano y congelado (RN-06)', () => {
    // Escenario "Monto con equipamiento".
    it('el monto es la cancha más cantidad por precio de cada ítem', async () => {
      const { body } = await reservar(
        turno({
          canchaId: padel1,
          horaInicio: '20:00',
          equipamiento: [{ equipamientoId: paleta, cantidad: 2 }],
        }),
      ).expect(201);

      expect(body.montoCancha).toBe(14000);
      expect(body.montoEquipamiento).toBe(5000);
      expect(body.montoTotal).toBe(19000);
      // El contrato promete números, no strings.
      expect(typeof body.montoTotal).toBe('number');
    });

    // Escenario "La cantidad de jugadores no cambia el precio".
    it('dos reservas con 2 y con 4 jugadores tienen el mismo montoCancha', async () => {
      const dos = await reservar(turno({ horaInicio: '11:00', cantidadJugadores: 2 })).expect(201);
      const cuatro = await reservar(turno({ horaInicio: '12:00', cantidadJugadores: 4 })).expect(201);

      expect(dos.body.montoCancha).toBe(9000);
      expect(cuatro.body.montoCancha).toBe(dos.body.montoCancha);
    });

    // Escenario "Cantidad de jugadores no habitual".
    it('una cancha de tenis con 3 jugadores se acepta y lo registra', async () => {
      const { body } = await reservar(turno({ cantidadJugadores: 3 })).expect(201);
      expect(body.cantidadJugadores).toBe(3);
    });

    // Escenario "Sin cantidad de jugadores".
    it('sin cantidad de jugadores la reserva informa null', async () => {
      const { body } = await reservar(turno()).expect(201);
      expect(body.cantidadJugadores).toBeNull();
    });

    // Escenario "Cantidad de jugadores inválida".
    it('cantidadJugadores en 0 responde 400', async () => {
      const { body } = await reservar(turno({ cantidadJugadores: 0 })).expect(400);
      expect(body).toMatchObject({ tipo: 'SOLICITUD_INVALIDA', estado: 400 });
    });

    // Escenario "Cambio de precio posterior".
    it('cambiar el precio después no toca los montos de la reserva creada', async () => {
      const { body } = await reservar(
        turno({
          canchaId: padel1,
          horaInicio: '20:00',
          equipamiento: [{ equipamientoId: paleta, cantidad: 2 }],
        }),
      ).expect(201);

      await prisma.cancha.update({ where: { id: padel1 }, data: { precioPorTurno: 16000 } });
      await prisma.equipamiento.update({ where: { id: paleta }, data: { precioPorTurno: 3000 } });

      try {
        const guardada = await prisma.reserva.findUniqueOrThrow({
          where: { id: body.id },
          include: { equipamiento: true },
        });
        expect(Number(guardada.montoCancha)).toBe(14000);
        expect(Number(guardada.montoEquipamiento)).toBe(5000);
        expect(Number(guardada.montoTotal)).toBe(19000);
        expect(Number(guardada.equipamiento[0].precioUnitario)).toBe(2500);
      } finally {
        await prisma.cancha.update({ where: { id: padel1 }, data: { precioPorTurno: 14000 } });
        await prisma.equipamiento.update({ where: { id: paleta }, data: { precioPorTurno: 2500 } });
      }
    });
  });
});
