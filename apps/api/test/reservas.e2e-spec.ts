import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { aFechaDb } from '../src/common/fechas';
import { CORREO, CorreoNoEnviadoError } from '../src/common/correo/correo';
import { Momento, Reloj } from '../src/common/reloj';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Un `describe` por requisito de `openspec/specs/reservas/spec.md` (los de
 * consulta y cancelación) y de `openspec/specs/notificaciones/spec.md` (el
 * reenvío). El Reloj se reemplaza por uno fijo, como en disponibilidad, y el
 * cliente de mail por un doble propio para poder simular una falla del
 * proveedor. No hay `POST /reservas` todavía (1.3): las reservas se siembran
 * directo con Prisma. Datos propios (`e2e …`, `E2E-…`, `@e2e.test`), borrados
 * solo esos al terminar.
 */
describe('reservas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const HOY = '2030-01-15';
  const momento: Momento = { fecha: HOY, hora: '10:00' };
  const correoFalso = { enviar: jest.fn().mockResolvedValue(undefined) };

  const api = () => request(app.getHttpServer());
  const bearer = (id: number, rol: 'ADMIN' | 'SOCIO') => `Bearer ${jwt.sign({ sub: id, rol })}`;

  let titular: { id: number };
  let otro: { id: number };
  let admin: { id: number };
  let padel1: { id: number };
  let paleta: { id: number };
  let contador = 0;

  async function limpiar() {
    await prisma.notificacion.deleteMany({ where: { reserva: { codigo: { startsWith: 'E2E-' } } } });
    await prisma.reserva.deleteMany({ where: { codigo: { startsWith: 'E2E-' } } });
    await prisma.equipamiento.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.cancha.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.disciplina.deleteMany({ where: { nombre: { startsWith: 'e2e ' } } });
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
  }

  const reservar = (datos: {
    usuarioId: number;
    horaInicio: string;
    horaFin: string;
    estado?: 'CONFIRMADA' | 'CANCELADA';
    equipamientoId?: number;
    cantidad?: number;
  }) =>
    prisma.reserva.create({
      data: {
        codigo: `E2E-${++contador}`,
        usuarioId: datos.usuarioId,
        canchaId: padel1.id,
        fecha: aFechaDb(HOY),
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin,
        estado: datos.estado ?? 'CONFIRMADA',
        montoCancha: 14000,
        montoEquipamiento: 0,
        montoTotal: 14000,
        ...(datos.equipamientoId
          ? { equipamiento: { create: [{ equipamientoId: datos.equipamientoId, cantidad: datos.cantidad ?? 1, precioUnitario: 2500 }] } }
          : {}),
      },
    });

  const reenviosPrevios = (reservaId: number, cantidad: number, enviadaEn: Date) =>
    prisma.notificacion.createMany({
      data: Array.from({ length: cantidad }, () => ({
        reservaId,
        tipo: 'CONFIRMACION' as const,
        destinatario: 'titular@e2e.test',
        estado: 'ENVIADA' as const,
        reenvio: true,
        enviadaEn,
      })),
    });

  async function crearApp(): Promise<INestApplication<App>> {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Reloj)
      .useValue({
        ahora: () => momento,
        instante: () => new Date(`${momento.fecha}T${momento.hora}:00.000Z`),
      })
      .overrideProvider(CORREO)
      .useValue(correoFalso)
      .compile();
    const nueva: INestApplication<App> = modulo.createNestApplication();
    await configurarApp(nueva);
    return nueva;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.JWT_EXPIRES_IN = '1h';

    app = await crearApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await limpiar();

    titular = await prisma.usuario.create({
      data: { nombre: 'Bruno', apellido: 'Socio', email: 'titular@e2e.test', passwordHash: 'x' },
    });
    otro = await prisma.usuario.create({
      data: { nombre: 'Otro', apellido: 'Socio', email: 'otro@e2e.test', passwordHash: 'x' },
    });
    admin = await prisma.usuario.create({
      data: { nombre: 'Ana', apellido: 'Admin', email: 'admin@e2e.test', passwordHash: 'x', rol: 'ADMIN' },
    });

    const padel = await prisma.disciplina.create({ data: { nombre: 'e2e Pádel', duracionTurnoMin: 90 } });
    padel1 = await prisma.cancha.create({
      data: { disciplinaId: padel.id, nombre: 'e2e Pádel 1', techada: true, precioPorTurno: 14000 },
    });
    paleta = await prisma.equipamiento.create({
      data: { disciplinaId: padel.id, nombre: 'e2e Paleta', stockTotal: 6, precioPorTurno: 2500 },
    });
  });

  beforeEach(() => {
    momento.fecha = HOY;
    momento.hora = '10:00';
    correoFalso.enviar.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await prisma.notificacion.deleteMany({ where: { reserva: { codigo: { startsWith: 'E2E-' } } } });
    await prisma.reserva.deleteMany({ where: { codigo: { startsWith: 'E2E-' } } });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('Listado de reservas acotado por rol', () => {
    it('Socio sin filtros: solo ve las propias', async () => {
      const propia = await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });
      await reservar({ usuarioId: otro.id, horaInicio: '20:00', horaFin: '21:30' });

      const { body } = await api()
        .get('/api/v1/reservas')
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(body.map((r: { id: number }) => r.id)).toEqual([propia.id]);
    });

    it('Socio que pide reservas de otro: la respuesta solo trae las propias', async () => {
      const propia = await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });
      await reservar({ usuarioId: otro.id, horaInicio: '20:00', horaFin: '21:30' });

      const { body } = await api()
        .get(`/api/v1/reservas?clienteId=${otro.id}`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(body.map((r: { id: number }) => r.id)).toEqual([propia.id]);
    });

    it('Administrador filtra por cliente', async () => {
      await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });
      const deOtro = await reservar({ usuarioId: otro.id, horaInicio: '20:00', horaFin: '21:30' });

      const { body } = await api()
        .get(`/api/v1/reservas?clienteId=${otro.id}`)
        .set('Authorization', bearer(admin.id, 'ADMIN'))
        .expect(200);
      expect(body.map((r: { id: number }) => r.id)).toEqual([deOtro.id]);
    });

    it('Nombre del titular en el listado', async () => {
      await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });

      const { body } = await api()
        .get('/api/v1/reservas')
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(body[0].cliente).toBe('Bruno Socio');
    });

    it('Filtro por estado', async () => {
      await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30', estado: 'CANCELADA' });
      await reservar({ usuarioId: titular.id, horaInicio: '20:00', horaFin: '21:30' });

      const { body } = await api()
        .get('/api/v1/reservas?estado=CANCELADA')
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(body.every((r: { estado: string }) => r.estado === 'CANCELADA')).toBe(true);
      expect(body.length).toBe(1);
    });

    it('Reserva ya jugada: aparece en COMPLETADA y no en CONFIRMADA', async () => {
      await reservar({ usuarioId: titular.id, horaInicio: '08:00', horaFin: '09:00' });

      const completadas = await api()
        .get('/api/v1/reservas?estado=COMPLETADA')
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(completadas.body.length).toBe(1);
      expect(completadas.body[0].estado).toBe('COMPLETADA');

      const confirmadas = await api()
        .get('/api/v1/reservas?estado=CONFIRMADA')
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(confirmadas.body.length).toBe(0);
    });

    it('Listado sin token: 401 NO_AUTENTICADO', async () => {
      const { body } = await api().get('/api/v1/reservas').expect(401);
      expect(body).toMatchObject({ tipo: 'NO_AUTENTICADO', instancia: '/reservas' });
    });
  });

  describe('Detalle de reserva sin revelar reservas ajenas', () => {
    it('Detalle con equipamiento', async () => {
      const reserva = await reservar({
        usuarioId: titular.id,
        horaInicio: '19:00',
        horaFin: '20:30',
        equipamientoId: paleta.id,
        cantidad: 2,
      });

      const { body } = await api()
        .get(`/api/v1/reservas/${reserva.id}`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(body.equipamiento).toEqual([
        { equipamientoId: paleta.id, nombre: 'e2e Paleta', cantidad: 2, precioUnitario: 2500, subtotal: 5000 },
      ]);
    });

    it('Reserva ajena: 404 NO_ENCONTRADO', async () => {
      const reserva = await reservar({ usuarioId: otro.id, horaInicio: '19:00', horaFin: '20:30' });

      const { body } = await api()
        .get(`/api/v1/reservas/${reserva.id}`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(404);
      expect(body.tipo).toBe('NO_ENCONTRADO');
    });

    it('Reserva inexistente: mismo tipo que una ajena', async () => {
      const { body } = await api()
        .get('/api/v1/reservas/999999')
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(404);
      expect(body.tipo).toBe('NO_ENCONTRADO');
    });

    /*
     * La spec pide que las dos respuestas sean indistinguibles salvo
     * `instancia`. Compararlas entre sí, y no cada una contra un `tipo`
     * esperado, es lo único que impide que alguien agregue después un detalle
     * servicial tipo "esta reserva no es tuya": eso convertiría la API en un
     * oráculo para averiguar qué ids existen, y los tests seguirían en verde.
     */
    it('Reserva ajena y reserva inexistente devuelven el mismo cuerpo', async () => {
      const ajena = await reservar({ usuarioId: otro.id, horaInicio: '19:00', horaFin: '20:30' });

      const respuestaAjena = await api()
        .get(`/api/v1/reservas/${ajena.id}`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(404);
      const respuestaInexistente = await api()
        .get('/api/v1/reservas/999999')
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(404);

      /*
       * Se normalizan `instancia` y el id que aparece en `detalle`: los dos
       * salen de lo que el solicitante mandó, así que no le revelan nada que no
       * supiera. Lo que no puede diferir es el resto.
       */
      const comparable = (cuerpo: Record<string, unknown>) => ({
        ...cuerpo,
        instancia: undefined,
        detalle: typeof cuerpo.detalle === 'string' ? cuerpo.detalle.replace(/\d+/g, '<id>') : cuerpo.detalle,
      });

      expect(comparable(respuestaAjena.body)).toEqual(comparable(respuestaInexistente.body));
    });

    it('Administrador consulta una reserva ajena', async () => {
      const reserva = await reservar({ usuarioId: otro.id, horaInicio: '19:00', horaFin: '20:30' });

      await api()
        .get(`/api/v1/reservas/${reserva.id}`)
        .set('Authorization', bearer(admin.id, 'ADMIN'))
        .expect(200);
    });
  });

  describe('Cancelación con plazo mínimo', () => {
    it('Cancelación con anticipación suficiente', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '13:00', horaFin: '14:30' });

      const { body } = await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(body.estado).toBe('CANCELADA');
    });

    it('Socio fuera de plazo: 422 y la reserva sigue CONFIRMADA', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '11:30', horaFin: '13:00' });

      const { body } = await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(422);
      expect(body.tipo).toBe('PLAZO_CANCELACION_VENCIDO');

      const detalle = await api()
        .get(`/api/v1/reservas/${reserva.id}`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(detalle.body.estado).toBe('CONFIRMADA');
    });

    it('Límite exacto: a 120 minutos se permite', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '12:00', horaFin: '13:30' });

      await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
    });

    it('Administrador fuera de plazo: cancela igual', async () => {
      const reserva = await reservar({ usuarioId: otro.id, horaInicio: '10:30', horaFin: '12:00' });

      await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(admin.id, 'ADMIN'))
        .expect(200);
    });

    it('Reserva ya cancelada: 409', async () => {
      const reserva = await reservar({
        usuarioId: titular.id,
        horaInicio: '19:00',
        horaFin: '20:30',
        estado: 'CANCELADA',
      });

      const { body } = await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(409);
      expect(body.tipo).toBe('RESERVA_NO_CANCELABLE');
    });

    it('Reserva ya jugada: 409', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '08:00', horaFin: '09:00' });

      const { body } = await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(409);
      expect(body.tipo).toBe('RESERVA_NO_CANCELABLE');
    });

    it('Socio cancela una reserva ajena: 404 y la reserva no cambia', async () => {
      const reserva = await reservar({ usuarioId: otro.id, horaInicio: '19:00', horaFin: '20:30' });

      await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(404);

      const detalle = await api()
        .get(`/api/v1/reservas/${reserva.id}`)
        .set('Authorization', bearer(otro.id, 'SOCIO'))
        .expect(200);
      expect(detalle.body.estado).toBe('CONFIRMADA');
    });

    it('Motivo demasiado largo: 400', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });

      const { body } = await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .send({ motivo: 'a'.repeat(201) })
        .expect(400);
      expect(body.tipo).toBe('SOLICITUD_INVALIDA');
    });
  });

  describe('La cancelación conserva el registro', () => {
    it('Reserva cancelada consultable, con motivo y fecha de cancelación', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '13:00', horaFin: '14:30' });

      await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .send({ motivo: 'Se suspendió por lluvia' })
        .expect(200);

      const { body } = await api()
        .get(`/api/v1/reservas/${reserva.id}`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);
      expect(body.estado).toBe('CANCELADA');
      expect(body.motivoCancelacion).toBe('Se suspendió por lluvia');
      expect(body.canceladaEn).not.toBeNull();
    });

    it('Registro de quién canceló: un ADMIN cancela la reserva de un SOCIO', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '13:00', horaFin: '14:30' });

      await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(admin.id, 'ADMIN'))
        .expect(200);

      const enLaBase = await prisma.reserva.findUnique({ where: { id: reserva.id } });
      expect(enLaBase?.canceladaPorId).toBe(admin.id);
    });

    it('la cancelación envía el mail correspondiente', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '13:00', horaFin: '14:30' });

      await api()
        .patch(`/api/v1/reservas/${reserva.id}/cancelacion`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(200);

      expect(correoFalso.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ para: 'titular@e2e.test', asunto: expect.stringContaining('Cancelamos') }),
      );
    });
  });

  describe('Reenvío del mail de una reserva', () => {
    it('Reenvío de la confirmación', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });

      const { body } = await api()
        .post(`/api/v1/reservas/${reserva.id}/reenvio-mail`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(202);
      expect(body.tipo).toBe('CONFIRMACION');
      expect(correoFalso.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ asunto: expect.stringContaining('está confirmado') }),
      );
    });

    it('Reenvío del aviso de cancelación', async () => {
      const reserva = await reservar({
        usuarioId: titular.id,
        horaInicio: '19:00',
        horaFin: '20:30',
        estado: 'CANCELADA',
      });

      const { body } = await api()
        .post(`/api/v1/reservas/${reserva.id}/reenvio-mail`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(202);
      expect(body.tipo).toBe('CANCELACION');
    });

    it('Reserva ya jugada: 409 REENVIO_NO_DISPONIBLE', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '08:00', horaFin: '09:00' });

      const { body } = await api()
        .post(`/api/v1/reservas/${reserva.id}/reenvio-mail`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(409);
      expect(body.tipo).toBe('REENVIO_NO_DISPONIBLE');
    });

    it('Reenvío pedido por un administrador: el destinatario es el socio titular', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });

      const { body } = await api()
        .post(`/api/v1/reservas/${reserva.id}/reenvio-mail`)
        .set('Authorization', bearer(admin.id, 'ADMIN'))
        .expect(202);
      expect(body.destinatario).toBe('titular@e2e.test');
    });

    it('Reserva ajena: 404', async () => {
      const reserva = await reservar({ usuarioId: otro.id, horaInicio: '19:00', horaFin: '20:30' });

      await api()
        .post(`/api/v1/reservas/${reserva.id}/reenvio-mail`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(404);
    });

    it('Cuarto reenvío en una hora: 429', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });
      await reenviosPrevios(reserva.id, 3, new Date(`${HOY}T09:30:00.000Z`));

      const { body } = await api()
        .post(`/api/v1/reservas/${reserva.id}/reenvio-mail`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(429);
      expect(body.tipo).toBe('DEMASIADAS_SOLICITUDES');
    });

    it('un reenvío de hace más de una hora no cuenta para el límite', async () => {
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });
      await reenviosPrevios(reserva.id, 3, new Date(`${HOY}T08:00:00.000Z`));

      await api()
        .post(`/api/v1/reservas/${reserva.id}/reenvio-mail`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(202);
    });

    it('Proveedor caído al reenviar: 202 igual, sin romper la respuesta', async () => {
      correoFalso.enviar.mockRejectedValue(new CorreoNoEnviadoError('el proveedor rechazó el envío'));
      const reserva = await reservar({ usuarioId: titular.id, horaInicio: '19:00', horaFin: '20:30' });

      await api()
        .post(`/api/v1/reservas/${reserva.id}/reenvio-mail`)
        .set('Authorization', bearer(titular.id, 'SOCIO'))
        .expect(202);

      const notificaciones = await prisma.notificacion.findMany({ where: { reservaId: reserva.id } });
      expect(notificaciones.some((n) => n.estado === 'FALLIDA')).toBe(true);
    });
  });
});
