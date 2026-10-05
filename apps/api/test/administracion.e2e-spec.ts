import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aFechaDb } from '../src/common/fechas';
import { Momento, Reloj } from '../src/common/reloj';
import type { Configuracion } from '../src/configuracion';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Un `describe` por requisito de `openspec/specs/administracion/spec.md` y un
 * `it` por escenario.
 *
 * El panel suma **todas** las canchas activas de la base, así que este suite:
 * - levanta la app con todos los días abiertos y el mismo horario, que es lo
 *   que suponen los escenarios (75 turnos en un día, 70 de una cancha de pádel
 *   en la semana), y devuelve las variables como estaban al terminar;
 * - da de baja mientras corre las canchas que no son suyas, y las reactiva al
 *   terminar. En el CI no hay ninguna (el job `api` no corre el seed), pero en
 *   local están las del seed;
 * - usa una fecha propia y lejana por escenario, separadas por más de 7 días,
 *   para que la ventana de una semana de un escenario no vea las de otro.
 */
describe('administracion (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const api = () => request(app.getHttpServer());
  const bearer = (rol: 'ADMIN' | 'SOCIO') => `Bearer ${jwt.sign({ sub: usuarioId, rol })}`;
  const panel = (consulta = '', rol: 'ADMIN' | 'SOCIO' = 'ADMIN') =>
    api().get(`/api/v1/admin/panel${consulta}`).set('Authorization', bearer(rol));

  /** "Hoy" para la app de este suite: un martes a las 19:40, hora del club. */
  const HOY = '2031-03-11';
  const MANANA = '2031-03-12';
  const momento: Momento = { fecha: HOY, hora: '19:40' };

  // Lunes, cada uno a dos semanas del anterior.
  const METRICAS = '2031-03-24';
  const CANCELACIONES = '2031-04-07';
  const OCUPACION_DIA = '2031-04-21';
  const OCUPACION_SEMANA = '2031-05-05';
  const SIN_RESERVAS = '2031-05-19';

  const VARIABLES = ['DIAS_CERRADOS', 'HORA_CIERRE', 'HORA_CIERRE_SABADO'] as const;
  const anteriores = new Map<string, string | undefined>();
  let ajenas: number[] = [];

  let usuarioId: number;
  let padel1: { id: number };
  let contador = 0;

  async function limpiar() {
    await prisma.reserva.deleteMany({
      where: {
        OR: [{ codigo: { startsWith: 'E2E-' } }, { usuario: { email: { endsWith: '@e2e.test' } } }],
      },
    });
    await prisma.cancha.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.disciplina.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
  }

  /** Una reserva no cancelada, sembrada directo: el panel solo lee. */
  const reservar = (datos: {
    fecha: string;
    horaInicio: string;
    canchaId?: number;
    montoTotal?: number;
    cantidadJugadores?: number;
  }) =>
    prisma.reserva.create({
      data: {
        codigo: `E2E-A${String(++contador).padStart(4, '0')}`,
        usuarioId,
        canchaId: datos.canchaId ?? padel1.id,
        fecha: aFechaDb(datos.fecha),
        horaInicio: datos.horaInicio,
        horaFin: '23:00',
        cantidadJugadores: datos.cantidadJugadores ?? null,
        montoCancha: datos.montoTotal ?? 0,
        montoTotal: datos.montoTotal ?? 0,
      },
    });

  /** Una reserva cancelada; `canceladaEn` es la hora local del club, Córdoba, UTC-3. */
  const cancelada = (fecha: string, horaInicio: string, canceladaEn: Momento) =>
    prisma.reserva.create({
      data: {
        codigo: `E2E-A${String(++contador).padStart(4, '0')}`,
        usuarioId,
        canchaId: padel1.id,
        fecha: aFechaDb(fecha),
        horaInicio,
        horaFin: '23:00',
        estado: 'CANCELADA',
        canceladaEn: new Date(`${canceladaEn.fecha}T${canceladaEn.hora}:00-03:00`),
        canceladaPorId: usuarioId,
        montoCancha: 0,
        montoTotal: 0,
      },
    });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.JWT_EXPIRES_IN = '1h';
    for (const nombre of VARIABLES) anteriores.set(nombre, process.env[nombre]);
    process.env.DIAS_CERRADOS = '';
    process.env.HORA_CIERRE = '23:00';
    process.env.HORA_CIERRE_SABADO = '23:00';

    // El reloj fija "ahora", pero sigue convirtiendo instantes de verdad: el
    // panel lo usa para pasar `cancelada_en` a la hora del club.
    const reloj = new Reloj({ zonaHoraria: 'America/Argentina/Cordoba' } as Configuracion);
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Reloj)
      .useValue({
        ahora: (instante?: Date) => (instante ? reloj.ahora(instante) : momento),
        instante: () => new Date(`${momento.fecha}T${momento.hora}:00-03:00`),
      })
      .compile();
    app = modulo.createNestApplication();
    await configurarApp(app);
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    await limpiar();

    const deOtros = await prisma.cancha.findMany({
      where: { activa: true, nombre: { not: { startsWith: 'e2e ' } } },
      select: { id: true },
    });
    ajenas = deOtros.map((c) => c.id);
    await prisma.cancha.updateMany({ where: { id: { in: ajenas } }, data: { activa: false } });

    const usuario = await prisma.usuario.create({
      data: { nombre: 'Bruno', apellido: 'Socio', email: 'panel@e2e.test', passwordHash: 'x' },
    });
    usuarioId = usuario.id;

    // Las seis canchas del escenario: 15 turnos las de 60 minutos y 10 las de 90; 75 en total.
    const tenis = await prisma.disciplina.create({ data: { nombre: 'e2e Tenis', duracionTurnoMin: 60 } });
    const padel = await prisma.disciplina.create({ data: { nombre: 'e2e Pádel', duracionTurnoMin: 90 } });
    const futbol = await prisma.disciplina.create({ data: { nombre: 'e2e Fútbol 5', duracionTurnoMin: 60 } });
    const cancha = (disciplinaId: number, nombre: string) =>
      prisma.cancha.create({ data: { disciplinaId, nombre, precioPorTurno: 1000 } });
    await cancha(tenis.id, 'e2e Tenis 1');
    await cancha(tenis.id, 'e2e Tenis 2');
    await cancha(futbol.id, 'e2e Sintética');
    padel1 = await cancha(padel.id, 'e2e Pádel 1');
    await cancha(padel.id, 'e2e Pádel 2');
    await cancha(padel.id, 'e2e Pádel 3');
  });

  afterAll(async () => {
    await limpiar();
    await prisma.cancha.updateMany({ where: { id: { in: ajenas } }, data: { activa: true } });
    for (const [nombre, valor] of anteriores) {
      if (valor === undefined) delete process.env[nombre];
      else process.env[nombre] = valor;
    }
    await app.close();
  });

  describe('Panel exclusivo del administrador', () => {
    it('Consulta del panel por un administrador: sin fecha, 200 con el día de hoy del club', async () => {
      const { body } = await panel().expect(200);
      expect(body.fecha).toBe(HOY);
      expect(Object.keys(body).sort()).toEqual(
        [
          'cancelacionesDelDia',
          'cancelacionesDentroDelPlazo',
          'facturacionPrevista',
          'fecha',
          'ocupacionDelDia',
          'ocupacionPorCancha',
          'ocupacionPromedioSemanal',
          'proximosTurnos',
          'reservasDelDia',
          'reservasDiaAnterior',
        ].sort(),
      );
    });

    it('Socio sin permiso: 403 SIN_PERMISOS', async () => {
      const { body } = await panel('', 'SOCIO').expect(403);
      expect(body.tipo).toBe('SIN_PERMISOS');
    });

    it('Sin token: 401 NO_AUTENTICADO', async () => {
      const { body } = await api().get('/api/v1/admin/panel').expect(401);
      expect(body.tipo).toBe('NO_AUTENTICADO');
    });

    it('Fecha mal formada: 400 SOLICITUD_INVALIDA', async () => {
      const { body } = await panel('?fecha=14-09-2026').expect(400);
      expect(body.tipo).toBe('SOLICITUD_INVALIDA');
    });
  });

  describe('Métricas del día', () => {
    it('Reservas y facturación: 3 del día, 2 del anterior y 46000 previstos', async () => {
      await reservar({ fecha: METRICAS, horaInicio: '08:00', montoTotal: 14000 });
      await reservar({ fecha: METRICAS, horaInicio: '09:30', montoTotal: 9000 });
      await reservar({ fecha: METRICAS, horaInicio: '11:00', montoTotal: 23000 });
      await cancelada(METRICAS, '12:30', { fecha: '2031-03-20', hora: '10:00' });
      await reservar({ fecha: '2031-03-23', horaInicio: '08:00' });
      await reservar({ fecha: '2031-03-23', horaInicio: '09:30' });

      const { body } = await panel(`?fecha=${METRICAS}`).expect(200);
      expect(body).toMatchObject({ reservasDelDia: 3, reservasDiaAnterior: 2, facturacionPrevista: 46000 });
    });

    it('Cancelaciones dentro y fuera del plazo: 2 cancelaciones, 1 dentro del plazo', async () => {
      // 5 horas antes de un turno de las 20:00, y un ADMIN 30 minutos antes de uno de las 18:30.
      await cancelada(CANCELACIONES, '20:00', { fecha: CANCELACIONES, hora: '15:00' });
      await cancelada(CANCELACIONES, '18:30', { fecha: CANCELACIONES, hora: '18:00' });

      const { body } = await panel(`?fecha=${CANCELACIONES}`).expect(200);
      expect(body).toMatchObject({ cancelacionesDelDia: 2, cancelacionesDentroDelPlazo: 1 });
    });
  });

  describe('Ocupación de las canchas', () => {
    const cincoEnPadel1 = (fecha: string) =>
      Promise.all(
        ['08:00', '09:30', '11:00', '12:30', '14:00'].map((horaInicio) => reservar({ fecha, horaInicio })),
      );

    it('Ocupación del día: 5 reservas en Pádel 1 sobre 75 turnos dan 7', async () => {
      await cincoEnPadel1(OCUPACION_DIA);
      const { body } = await panel(`?fecha=${OCUPACION_DIA}`).expect(200);
      expect(body.ocupacionDelDia).toBe(7);
      expect(body.ocupacionPorCancha).toHaveLength(6);
    });

    it('Ocupación de una cancha en la semana: Pádel 1 con 5 reservas sobre 70 turnos da 7', async () => {
      for (const fecha of ['2031-04-29', '2031-04-30', '2031-05-01', '2031-05-02', '2031-05-03']) {
        await reservar({ fecha, horaInicio: '08:00' });
      }
      const { body } = await panel(`?fecha=${OCUPACION_SEMANA}`).expect(200);
      expect(body.ocupacionPorCancha).toContainEqual({
        canchaId: padel1.id,
        nombre: 'e2e Pádel 1',
        disciplina: 'e2e Pádel',
        porcentaje: 7,
      });
    });

    it('Día sin reservas: ocupación del día 0', async () => {
      const { body } = await panel(`?fecha=${SIN_RESERVAS}`).expect(200);
      expect(body.ocupacionDelDia).toBe(0);
    });
  });

  describe('Próximos turnos', () => {
    it('Turnos restantes de hoy: a las 19:40 lista primero la de las 20:00 y después la de las 21:30', async () => {
      await reservar({ fecha: HOY, horaInicio: '18:30' });
      await reservar({ fecha: HOY, horaInicio: '21:30' });
      const ocho = await reservar({ fecha: HOY, horaInicio: '20:00', cantidadJugadores: 4 });

      const { body } = await panel().expect(200);
      expect(body.proximosTurnos.map((t: { horaInicio: string }) => t.horaInicio)).toEqual(['20:00', '21:30']);
      expect(body.proximosTurnos[0]).toEqual({
        reservaId: ocho.id,
        horaInicio: '20:00',
        cancha: 'e2e Pádel 1',
        disciplina: 'e2e Pádel',
        cliente: 'Bruno Socio',
        cantidadJugadores: 4,
      });
    });

    it('Otra fecha: el panel de mañana lista las de las 09:00 y las 18:30, en ese orden', async () => {
      await reservar({ fecha: MANANA, horaInicio: '18:30' });
      await reservar({ fecha: MANANA, horaInicio: '09:00' });

      const { body } = await panel(`?fecha=${MANANA}`).expect(200);
      expect(body.proximosTurnos.map((t: { horaInicio: string }) => t.horaInicio)).toEqual(['09:00', '18:30']);
    });
  });
});
