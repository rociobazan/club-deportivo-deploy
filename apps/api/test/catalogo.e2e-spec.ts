import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aFechaDb } from '../src/common/fechas';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Un `describe` por requisito público de `openspec/specs/catalogo/spec.md` y
 * un `it` por escenario. El CI aplica las migraciones pero no el seed, así que
 * los escenarios que la spec plantea "con los datos de prueba cargados" se
 * prueban con datos propios (`e2e …`, códigos `E2E-…`, usuario `@e2e.test`),
 * que se crean acá y se borran solo esos al terminar.
 */
describe('catalogo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const api = () => request(app.getHttpServer());
  const bearer = (rol: 'ADMIN' | 'SOCIO') => `Bearer ${jwt.sign({ sub: usuarioId, rol })}`;

  const FECHA = '2030-01-15';
  const HORA = '20:00';
  let usuarioId: number;
  let tenis: { id: number };
  let padel: { id: number };
  let tenis1: { id: number };
  let padel1: { id: number };
  let padel2: { id: number };
  let paleta: { id: number };
  let contador = 0;

  async function limpiar() {
    await prisma.reserva.deleteMany({ where: { codigo: { startsWith: 'E2E-' } } });
    await prisma.equipamiento.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.cancha.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.disciplina.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
  }

  const reservar = (
    canchaId: number,
    items: { equipamientoId: number; cantidad: number }[],
    estado: 'CONFIRMADA' | 'CANCELADA' = 'CONFIRMADA',
  ) =>
    prisma.reserva.create({
      data: {
        codigo: `E2E-${++contador}`,
        usuarioId,
        canchaId,
        fecha: aFechaDb(FECHA),
        horaInicio: HORA,
        horaFin: '21:30',
        estado,
        montoCancha: 0,
        montoEquipamiento: 0,
        montoTotal: 0,
        equipamiento: {
          create: items.map((item) => ({ ...item, precioUnitario: 0 })),
        },
      },
    });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.JWT_EXPIRES_IN = '1h';

    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    await configurarApp(app);
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    await limpiar();

    const usuario = await prisma.usuario.create({
      data: { nombre: 'E2E', apellido: 'Catálogo', email: 'catalogo@e2e.test', passwordHash: 'x' },
    });
    usuarioId = usuario.id;

    tenis = await prisma.disciplina.create({ data: { nombre: 'e2e Tenis', duracionTurnoMin: 60 } });
    padel = await prisma.disciplina.create({ data: { nombre: 'e2e Pádel', duracionTurnoMin: 90 } });
    await prisma.disciplina.create({
      data: { nombre: 'e2e Inactiva', duracionTurnoMin: 60, activa: false },
    });

    tenis1 = await prisma.cancha.create({
      data: { disciplinaId: tenis.id, nombre: 'e2e Cancha 1', techada: false, precioPorTurno: 9000 },
    });
    padel1 = await prisma.cancha.create({
      data: { disciplinaId: padel.id, nombre: 'e2e Pádel 1', techada: true, precioPorTurno: 14000 },
    });
    padel2 = await prisma.cancha.create({
      data: { disciplinaId: padel.id, nombre: 'e2e Pádel 2', techada: true, precioPorTurno: 14000 },
    });
    await prisma.cancha.create({
      data: {
        disciplinaId: tenis.id,
        nombre: 'e2e Baja',
        techada: false,
        precioPorTurno: 1000,
        activa: false,
      },
    });

    paleta = await prisma.equipamiento.create({
      data: { disciplinaId: padel.id, nombre: 'e2e Paleta', stockTotal: 6, precioPorTurno: 2500 },
    });
    await prisma.equipamiento.create({
      data: { disciplinaId: tenis.id, nombre: 'e2e Raqueta', stockTotal: 4, precioPorTurno: 2500 },
    });
    await prisma.equipamiento.create({
      data: {
        disciplinaId: tenis.id,
        nombre: 'e2e Item baja',
        stockTotal: 1,
        precioPorTurno: 100,
        activo: false,
      },
    });
  });

  afterEach(() => prisma.reserva.deleteMany({ where: { codigo: { startsWith: 'E2E-' } } }));

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const propias = <T extends { nombre: string }>(lista: T[]) =>
    lista.filter((x) => x.nombre.startsWith('e2e '));

  describe('Listado público de disciplinas', () => {
    it('Tres disciplinas activas: responde 200 sin token con las activas', async () => {
      const { body } = await api().get('/api/v1/disciplinas').expect(200);
      expect(propias(body).map((d: { nombre: string }) => d.nombre)).toEqual(['e2e Tenis', 'e2e Pádel']);
    });

    it('Disciplina inactiva: no aparece en la respuesta', async () => {
      const { body } = await api().get('/api/v1/disciplinas').expect(200);
      expect(body.some((d: { nombre: string }) => d.nombre === 'e2e Inactiva')).toBe(false);
    });

    it('Duración de turno informada: tenis 60 y pádel 90', async () => {
      const { body } = await api().get('/api/v1/disciplinas').expect(200);
      const disciplinas = propias(body as { nombre: string; duracionTurnoMin: number }[]);
      const porNombre = Object.fromEntries(disciplinas.map((d) => [d.nombre, d.duracionTurnoMin]));
      expect(porNombre).toEqual({ 'e2e Tenis': 60, 'e2e Pádel': 90 });
    });
  });

  describe('Listado público de canchas con precio por turno', () => {
    it('Filtro por disciplina: todas las canchas son de Pádel', async () => {
      const { body } = await api().get(`/api/v1/canchas?disciplinaId=${padel.id}`).expect(200);
      expect(body.length).toBe(2);
      expect(body.every((c: { disciplinaId: number; disciplina: string }) => c.disciplinaId === padel.id && c.disciplina === 'e2e Pádel')).toBe(true);
    });

    it('Disciplina inexistente: 200 con una lista vacía', async () => {
      await api().get('/api/v1/canchas?disciplinaId=9999').expect(200, []);
    });

    it('Filtro por canchas techadas: todas tienen techada en true', async () => {
      const { body } = await api().get('/api/v1/canchas?techada=true').expect(200);
      expect(body.length).toBeGreaterThan(0);
      expect(body.every((c: { techada: boolean }) => c.techada === true)).toBe(true);
    });

    it('Precio plano por cancha: un único precioPorTurno numérico', async () => {
      const { body } = await api().get(`/api/v1/canchas?disciplinaId=${tenis.id}`).expect(200);
      const cancha = body.find((c: { id: number }) => c.id === tenis1.id);
      expect(cancha.precioPorTurno).toBe(9000);
      expect(typeof cancha.precioPorTurno).toBe('number');
      expect(cancha).not.toHaveProperty('precios');
      expect(cancha).not.toHaveProperty('tarifas');
    });

    it('Cancha inactiva: no aparece sin parámetros de administración', async () => {
      const { body } = await api().get('/api/v1/canchas').expect(200);
      expect(body.some((c: { nombre: string }) => c.nombre === 'e2e Baja')).toBe(false);
    });

    it('incluirInactivas sin token responde 401 NO_AUTENTICADO', async () => {
      const { body } = await api().get('/api/v1/canchas?incluirInactivas=true').expect(401);
      expect(body).toMatchObject({ tipo: 'NO_AUTENTICADO', instancia: '/canchas' });
    });

    it('incluirInactivas con SOCIO responde 403 SIN_PERMISOS', async () => {
      const { body } = await api()
        .get('/api/v1/canchas?incluirInactivas=true')
        .set('Authorization', bearer('SOCIO'))
        .expect(403);
      expect(body.tipo).toBe('SIN_PERMISOS');
    });

    it('incluirInactivas con ADMIN incluye la cancha dada de baja', async () => {
      const { body } = await api()
        .get('/api/v1/canchas?incluirInactivas=true')
        .set('Authorization', bearer('ADMIN'))
        .expect(200);
      expect(body.some((c: { nombre: string; activa: boolean }) => c.nombre === 'e2e Baja' && c.activa === false)).toBe(true);
    });

    it('un parámetro mal formado responde 400 SOLICITUD_INVALIDA', async () => {
      const { body } = await api().get('/api/v1/canchas?disciplinaId=abc').expect(400);
      expect(body).toMatchObject({ tipo: 'SOLICITUD_INVALIDA', estado: 400, instancia: '/canchas' });
    });
  });

  describe('Catálogo de equipamiento con stock por turno', () => {
    const consultarTurno = () =>
      api().get(`/api/v1/equipamiento?fecha=${FECHA}&horaInicio=${HORA}`).expect(200);
    const paletaDe = (body: { id: number; stockDisponible?: number }[]) =>
      body.find((e) => e.id === paleta.id)!;

    it('Catálogo sin fecha: stockTotal sin stockDisponible', async () => {
      const { body } = await api().get('/api/v1/equipamiento').expect(200);
      const item = paletaDe(body);
      expect(item).toMatchObject({ stockTotal: 6, precioPorTurno: 2500 });
      expect(item).not.toHaveProperty('stockDisponible');
    });

    it('Stock disponible en un turno con alquileres: 2 alquiladas sobre 6 dan 4', async () => {
      await reservar(padel1.id, [{ equipamientoId: paleta.id, cantidad: 2 }]);

      const { body } = await consultarTurno();
      expect(paletaDe(body).stockDisponible).toBe(4);
    });

    it('Stock compartido entre canchas de la misma disciplina: 2 en Pádel 1 y 1 en Pádel 2 dan 3', async () => {
      await reservar(padel1.id, [{ equipamientoId: paleta.id, cantidad: 2 }]);
      await reservar(padel2.id, [{ equipamientoId: paleta.id, cantidad: 1 }]);

      const { body } = await consultarTurno();
      expect(paletaDe(body).stockDisponible).toBe(3);
    });

    it('Alquiler de una reserva cancelada: no descuenta stock', async () => {
      const reserva = await reservar(padel1.id, [{ equipamientoId: paleta.id, cantidad: 2 }]);
      await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'CANCELADA' } });

      const { body } = await consultarTurno();
      expect(paletaDe(body).stockDisponible).toBe(6);
    });

    it('Filtro por disciplina: todos los ítems son de Tenis', async () => {
      const { body } = await api().get(`/api/v1/equipamiento?disciplinaId=${tenis.id}`).expect(200);
      expect(body.length).toBeGreaterThan(0);
      expect(body.every((e: { disciplinaId: number }) => e.disciplinaId === tenis.id)).toBe(true);
      expect(body.some((e: { nombre: string }) => e.nombre === 'e2e Item baja')).toBe(false);
    });

    it('Fecha sin hora de inicio: 400 SOLICITUD_INVALIDA en los dos sentidos', async () => {
      for (const query of [`fecha=${FECHA}`, `horaInicio=${HORA}`]) {
        const { body } = await api().get(`/api/v1/equipamiento?${query}`).expect(400);
        expect(body).toMatchObject({ tipo: 'SOLICITUD_INVALIDA', instancia: '/equipamiento' });
      }
    });

    it('Hora mal formada: 400 SOLICITUD_INVALIDA', async () => {
      const { body } = await api().get(`/api/v1/equipamiento?fecha=${FECHA}&horaInicio=8pm`).expect(400);
      expect(body.tipo).toBe('SOLICITUD_INVALIDA');
    });

    it('incluirInactivos con ADMIN incluye el ítem dado de baja', async () => {
      const { body } = await api()
        .get('/api/v1/equipamiento?incluirInactivos=true')
        .set('Authorization', bearer('ADMIN'))
        .expect(200);
      expect(body.some((e: { nombre: string }) => e.nombre === 'e2e Item baja')).toBe(true);
    });
  });
});
