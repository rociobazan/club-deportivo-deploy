import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aFechaDb } from '../src/common/fechas';
import { Momento, Reloj } from '../src/common/reloj';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Un `describe` por requisito de `openspec/specs/disponibilidad/spec.md` y un
 * `it` por escenario. El Reloj se reemplaza por uno fijo para que "hoy" y
 * "ahora" no dependan del runner. Datos propios (`e2e …`, `E2E-…`,
 * `@e2e.test`), borrados solo esos al terminar.
 */
describe('disponibilidad (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  /** "Hoy" fijo y futuro: los datos no se pisan con el paso del tiempo real. */
  const HOY = '2030-01-15';
  const MANIANA = '2030-01-16';
  const momento: Momento = { fecha: HOY, hora: '10:00' };

  const api = () => request(app.getHttpServer());
  const consultar = (query: string) => api().get(`/api/v1/disponibilidad?${query}`);
  const horas = (cancha: { slots: { horaInicio: string }[] }) => cancha.slots.map((s) => s.horaInicio);

  let usuarioId: number;
  let tenis: { id: number };
  let padel: { id: number };
  let tenis1: { id: number };
  let tenis2: { id: number };
  let padel1: { id: number };
  let contador = 0;

  async function limpiar() {
    await prisma.reserva.deleteMany({ where: { codigo: { startsWith: 'E2E-' } } });
    await prisma.cancha.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.disciplina.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
  }

  const reservar = (canchaId: number, fecha: string, horaInicio: string) =>
    prisma.reserva.create({
      data: {
        codigo: `E2E-D${++contador}`,
        usuarioId,
        canchaId,
        fecha: aFechaDb(fecha),
        horaInicio,
        horaFin: '20:00',
        montoCancha: 0,
        montoEquipamiento: 0,
        montoTotal: 0,
      },
    });

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
    delete process.env.HORA_CIERRE;

    app = await crearApp();
    prisma = app.get(PrismaService);
    await limpiar();

    const usuario = await prisma.usuario.create({
      data: { nombre: 'E2E', apellido: 'Disponibilidad', email: 'disponibilidad@e2e.test', passwordHash: 'x' },
    });
    usuarioId = usuario.id;

    tenis = await prisma.disciplina.create({ data: { nombre: 'e2e Tenis', duracionTurnoMin: 60 } });
    padel = await prisma.disciplina.create({ data: { nombre: 'e2e Pádel', duracionTurnoMin: 90 } });
    const inactiva = await prisma.disciplina.create({
      data: { nombre: 'e2e Inactiva', duracionTurnoMin: 60, activa: false },
    });

    tenis1 = await prisma.cancha.create({
      data: { disciplinaId: tenis.id, nombre: 'e2e Cancha 1', precioPorTurno: 9000 },
    });
    tenis2 = await prisma.cancha.create({
      data: { disciplinaId: tenis.id, nombre: 'e2e Cancha 2', precioPorTurno: 8000 },
    });
    padel1 = await prisma.cancha.create({
      data: { disciplinaId: padel.id, nombre: 'e2e Pádel 1', techada: true, precioPorTurno: 14000 },
    });
    await prisma.cancha.create({
      data: { disciplinaId: tenis.id, nombre: 'e2e Baja', precioPorTurno: 1000, activa: false },
    });
    await prisma.cancha.create({
      data: { disciplinaId: inactiva.id, nombre: 'e2e Fantasma', precioPorTurno: 1000 },
    });
  });

  beforeEach(() => {
    momento.fecha = HOY;
    momento.hora = '10:00';
  });

  afterEach(() => prisma.reserva.deleteMany({ where: { codigo: { startsWith: 'E2E-' } } }));

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const canchaDe = (body: { canchas: { canchaId: number; slots: { horaInicio: string; horaFin: string }[] }[] }, id: number) =>
    body.canchas.find((c) => c.canchaId === id)!;

  describe('Cálculo de turnos libres por fecha', () => {
    it('Día sin reservas en una cancha de tenis: 15 turnos, de 08:00-09:00 a 22:00-23:00', async () => {
      const { body } = await consultar(`fecha=${MANIANA}&canchaId=${tenis1.id}`).expect(200);
      const cancha = canchaDe(body, tenis1.id);

      expect(body.fecha).toBe(MANIANA);
      expect(cancha).toMatchObject({ nombre: 'e2e Cancha 1', disciplina: 'e2e Tenis', precioPorTurno: 9000 });
      expect(cancha.slots).toHaveLength(15);
      expect(cancha.slots[0]).toEqual({ horaInicio: '08:00', horaFin: '09:00' });
      expect(cancha.slots[14]).toEqual({ horaInicio: '22:00', horaFin: '23:00' });
    });

    it('Día sin reservas en una cancha de pádel: 10 turnos de 90 minutos, el último 21:30-23:00', async () => {
      const { body } = await consultar(`fecha=${MANIANA}&canchaId=${padel1.id}`).expect(200);
      const cancha = canchaDe(body, padel1.id);

      expect(cancha.slots).toHaveLength(10);
      expect(cancha.slots[0]).toEqual({ horaInicio: '08:00', horaFin: '09:30' });
      expect(cancha.slots[9]).toEqual({ horaInicio: '21:30', horaFin: '23:00' });
    });

    it('Turno ocupado: el de las 19:00 no aparece', async () => {
      await reservar(tenis1.id, MANIANA, '19:00');

      const { body } = await consultar(`fecha=${MANIANA}&canchaId=${tenis1.id}`).expect(200);
      expect(horas(canchaDe(body, tenis1.id))).not.toContain('19:00');
      expect(canchaDe(body, tenis1.id).slots).toHaveLength(14);
    });

    it('Turno liberado por cancelación: vuelve a aparecer', async () => {
      const reserva = await reservar(tenis1.id, MANIANA, '19:00');
      await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'CANCELADA' } });

      const { body } = await consultar(`fecha=${MANIANA}&canchaId=${tenis1.id}`).expect(200);
      expect(horas(canchaDe(body, tenis1.id))).toContain('19:00');
    });

    it('Reserva en otra cancha: la Cancha 2 sigue con las 19:00 libres', async () => {
      await reservar(tenis1.id, MANIANA, '19:00');

      const { body } = await consultar(`fecha=${MANIANA}&disciplinaId=${tenis.id}`).expect(200);
      expect(horas(canchaDe(body, tenis1.id))).not.toContain('19:00');
      expect(horas(canchaDe(body, tenis2.id))).toContain('19:00');
    });
  });

  describe('Horario de atención configurable', () => {
    let appCierre22: INestApplication<App>;

    beforeAll(async () => {
      process.env.HORA_CIERRE = '22:00';
      appCierre22 = await crearApp();
    });

    afterAll(async () => {
      delete process.env.HORA_CIERRE;
      await appCierre22.close();
    });

    it('Cierre anticipado: con cierre a las 22:00 el último turno de tenis es 21:00-22:00', async () => {
      const { body } = await request(appCierre22.getHttpServer())
        .get(`/api/v1/disponibilidad?fecha=${MANIANA}&canchaId=${tenis1.id}`)
        .expect(200);
      const { slots } = canchaDe(body, tenis1.id);
      expect(slots[slots.length - 1]).toEqual({ horaInicio: '21:00', horaFin: '22:00' });
    });

    it('Bloque que no entra antes del cierre: pádel termina en 20:00-21:30 y no ofrece 21:30-23:00', async () => {
      const { body } = await request(appCierre22.getHttpServer())
        .get(`/api/v1/disponibilidad?fecha=${MANIANA}&canchaId=${padel1.id}`)
        .expect(200);
      const { slots } = canchaDe(body, padel1.id);
      expect(slots[slots.length - 1]).toEqual({ horaInicio: '20:00', horaFin: '21:30' });
      expect(slots.some((s) => s.horaInicio === '21:30')).toBe(false);
    });
  });

  describe('Filtros de la consulta', () => {
    it('Filtro por disciplina: todas las canchas son de Pádel', async () => {
      const { body } = await consultar(`fecha=${MANIANA}&disciplinaId=${padel.id}`).expect(200);
      expect(body.canchas.length).toBeGreaterThan(0);
      expect(body.canchas.every((c: { disciplina: string }) => c.disciplina === 'e2e Pádel')).toBe(true);
    });

    it('Filtro por cancha: únicamente la Cancha 1 de tenis', async () => {
      const { body } = await consultar(`fecha=${MANIANA}&canchaId=${tenis1.id}`).expect(200);
      expect(body.canchas.map((c: { canchaId: number }) => c.canchaId)).toEqual([tenis1.id]);
    });

    it('las canchas inactivas y las de disciplinas inactivas no aparecen', async () => {
      const { body } = await consultar(`fecha=${MANIANA}`).expect(200);
      const nombres = body.canchas.map((c: { nombre: string }) => c.nombre);
      expect(nombres).not.toContain('e2e Baja');
      expect(nombres).not.toContain('e2e Fantasma');
    });

    it('Fecha ausente o mal formada: 400 SOLICITUD_INVALIDA', async () => {
      for (const query of ['', 'fecha=15-09-2026', 'fecha=2026-02-30']) {
        const { body } = await consultar(query).expect(400);
        expect(body).toMatchObject({ tipo: 'SOLICITUD_INVALIDA', estado: 400, instancia: '/disponibilidad' });
      }
    });
  });

  describe('Fechas y horarios ya pasados', () => {
    it('Fecha anterior a hoy: 400 SOLICITUD_INVALIDA', async () => {
      const { body } = await consultar('fecha=2030-01-14').expect(400);
      expect(body.tipo).toBe('SOLICITUD_INVALIDA');
      expect(body.detalle).toContain('ya pasó');
    });

    it('Consulta de hoy a media tarde: a las 14:00 el primer turno es 14:00-15:00', async () => {
      momento.hora = '14:00';

      const { body } = await consultar(`fecha=${HOY}&canchaId=${tenis1.id}`).expect(200);
      const { slots } = canchaDe(body, tenis1.id);
      expect(slots[0]).toEqual({ horaInicio: '14:00', horaFin: '15:00' });
      expect(slots.some((s) => s.horaInicio < '14:00')).toBe(false);
    });
  });
});
