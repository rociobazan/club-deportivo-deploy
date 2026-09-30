import { Prisma } from '@prisma/client';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import type { Configuracion } from '../configuracion';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { Reloj } from '../common/reloj';
import { ReservaConDetalle } from './mapeadores';
import { ReservasService } from './reservas.service';

type PrismaFalso = {
  reserva: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    updateMany: jest.Mock;
  };
  notificacion: { count: jest.Mock };
};

const socio: UsuarioAutenticado = { id: 1, rol: 'SOCIO' };
const otroSocio: UsuarioAutenticado = { id: 2, rol: 'SOCIO' };
const admin: UsuarioAutenticado = { id: 9, rol: 'ADMIN' };

const configuracion = { cancelacionMinutosMinimos: 120 } as Configuracion;

function reservaDe(datos: Partial<ReservaConDetalle> = {}): ReservaConDetalle {
  return {
    id: 128,
    codigo: 'RES-A7F3K2',
    usuarioId: 1,
    canchaId: 3,
    fecha: new Date('2026-09-15T00:00:00.000Z'),
    horaInicio: '19:00',
    horaFin: '20:30',
    cantidadJugadores: null,
    estado: 'CONFIRMADA',
    montoCancha: new Prisma.Decimal('14000'),
    montoEquipamiento: new Prisma.Decimal('0'),
    montoTotal: new Prisma.Decimal('14000'),
    creadaEn: new Date('2026-09-01T00:00:00.000Z'),
    canceladaEn: null,
    canceladaPorId: null,
    motivoCancelacion: null,
    usuario: { nombre: 'Bruno', apellido: 'Socio', email: 'bruno@e2e.test' },
    cancha: {
      id: 3,
      disciplinaId: 2,
      nombre: 'Pádel 1',
      superficie: null,
      techada: true,
      precioPorTurno: new Prisma.Decimal('14000'),
      activa: true,
      disciplina: { nombre: 'Pádel' },
    },
    equipamiento: [],
    ...datos,
  };
}

describe('ReservasService', () => {
  let prisma: PrismaFalso;
  let reloj: { ahora: jest.Mock; instante: jest.Mock };
  let notificaciones: { enviarCancelacion: jest.Mock; reenviar: jest.Mock };
  let servicio: ReservasService;

  const AHORA = { fecha: '2026-09-15', hora: '10:00' };

  /** Lo último que `updateMany` escribió, para que la relectura lo devuelva. */
  let ultimaEscritura: Record<string, unknown> = {};

  beforeEach(() => {
    ultimaEscritura = {};
    prisma = {
      reserva: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(reservaDe()),
        /*
         * `cancelar` escribe con `updateMany` condicionado al estado y después
         * relee: el mock guarda lo escrito para que la relectura lo devuelva,
         * igual que hacía el `update` que devolvía la fila actualizada.
         */
        updateMany: jest.fn().mockImplementation((args) => {
          ultimaEscritura = args.data;
          return Promise.resolve({ count: 1 });
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve(reservaDe(ultimaEscritura))),
      },
      notificacion: { count: jest.fn().mockResolvedValue(0) },
    };
    reloj = {
      ahora: jest.fn().mockReturnValue(AHORA),
      instante: jest.fn().mockReturnValue(new Date('2026-09-15T13:00:00.000Z')),
    };
    notificaciones = {
      enviarCancelacion: jest.fn().mockResolvedValue('ENVIADA'),
      reenviar: jest.fn().mockResolvedValue('ENVIADA'),
    };
    servicio = new ReservasService(
      prisma as unknown as PrismaService,
      reloj as unknown as Reloj,
      notificaciones as unknown as NotificacionesService,
      configuracion,
    );
  });

  describe('listar', () => {
    it('Socio sin filtros: fuerza su propio id, ignorando un clienteId ajeno', async () => {
      await servicio.listar({ clienteId: otroSocio.id }, socio);
      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ usuarioId: socio.id }) }),
      );
    });

    it('Administrador filtra por cliente', async () => {
      await servicio.listar({ clienteId: 42 }, admin);
      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ usuarioId: 42 }) }),
      );
    });

    it('Administrador sin clienteId no filtra por usuario', async () => {
      await servicio.listar({}, admin);
      expect(prisma.reserva.findMany.mock.calls[0][0].where).not.toHaveProperty('usuarioId');
    });

    it('Filtro por estado: CANCELADA se pide directo a la base', async () => {
      await servicio.listar({ estado: 'CANCELADA' }, admin);
      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ estado: 'CANCELADA' }) }),
      );
    });

    it('Reserva ya jugada: con estado=COMPLETADA pide CONFIRMADA y filtra las vencidas', async () => {
      const vencida = reservaDe({ id: 1, horaFin: '09:00' });
      const vigente = reservaDe({ id: 2, horaFin: '23:00' });
      prisma.reserva.findMany.mockResolvedValue([vencida, vigente]);

      const resultado = await servicio.listar({ estado: 'COMPLETADA' }, admin);

      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ estado: 'CONFIRMADA' }) }),
      );
      expect(resultado.map((r) => r.id)).toEqual([1]);
      expect(resultado[0].estado).toBe('COMPLETADA');
    });

    it('con estado=CONFIRMADA no incluye las que ya terminaron', async () => {
      const vencida = reservaDe({ id: 1, horaFin: '09:00' });
      const vigente = reservaDe({ id: 2, horaFin: '23:00' });
      prisma.reserva.findMany.mockResolvedValue([vencida, vigente]);

      const resultado = await servicio.listar({ estado: 'CONFIRMADA' }, admin);
      expect(resultado.map((r) => r.id)).toEqual([2]);
    });
  });

  describe('obtener', () => {
    it('Reserva ajena: un SOCIO que consulta la reserva de otro recibe 404', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ usuarioId: otroSocio.id }));
      await expect(servicio.obtener(128, socio)).rejects.toMatchObject({ estado: 404, tipo: 'NO_ENCONTRADO' });
    });

    it('Reserva inexistente: 404 con el mismo tipo', async () => {
      prisma.reserva.findUnique.mockResolvedValue(null);
      await expect(servicio.obtener(999, socio)).rejects.toMatchObject({ estado: 404, tipo: 'NO_ENCONTRADO' });
    });

    it('Administrador consulta una reserva ajena: 200 con el detalle', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ usuarioId: otroSocio.id }));
      await expect(servicio.obtener(128, admin)).resolves.toMatchObject({ id: 128 });
    });

    it('el titular consulta su propia reserva sin problema', async () => {
      await expect(servicio.obtener(128, socio)).resolves.toMatchObject({ id: 128 });
    });
  });

  describe('cancelar', () => {
    it('Cancelación con anticipación suficiente: a más de 2 horas se permite', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaInicio: '13:00' }));
      const resultado = await servicio.cancelar(128, socio, {});
      expect(resultado.estado).toBe('CANCELADA');
      expect(notificaciones.enviarCancelacion).toHaveBeenCalled();
    });

    it('Socio fuera de plazo: a 90 minutos, 422', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaInicio: '11:30' }));
      await expect(servicio.cancelar(128, socio, {})).rejects.toMatchObject({
        estado: 422,
        tipo: 'PLAZO_CANCELACION_VENCIDO',
      });
      expect(prisma.reserva.updateMany).not.toHaveBeenCalled();
    });

    it('Límite exacto: a exactamente 120 minutos se permite', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaInicio: '12:00' }));
      await expect(servicio.cancelar(128, socio, {})).resolves.toMatchObject({ estado: 'CANCELADA' });
    });

    it('Administrador fuera de plazo: cancela sin límite una reserva de otro usuario', async () => {
      prisma.reserva.findUnique.mockResolvedValue(
        reservaDe({ usuarioId: otroSocio.id, horaInicio: '10:30' }),
      );
      await expect(servicio.cancelar(128, admin, {})).resolves.toMatchObject({ estado: 'CANCELADA' });
    });

    it('Reserva ya cancelada: 409', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ estado: 'CANCELADA' }));
      await expect(servicio.cancelar(128, socio, {})).rejects.toMatchObject({
        estado: 409,
        tipo: 'RESERVA_NO_CANCELABLE',
      });
    });

    it('Reserva ya jugada: 409', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaFin: '09:00' }));
      await expect(servicio.cancelar(128, socio, {})).rejects.toMatchObject({
        estado: 409,
        tipo: 'RESERVA_NO_CANCELABLE',
      });
    });

    it('Socio cancela una reserva ajena: 404 y no cambia nada', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ usuarioId: otroSocio.id }));
      await expect(servicio.cancelar(128, socio, {})).rejects.toMatchObject({ estado: 404 });
      expect(prisma.reserva.updateMany).not.toHaveBeenCalled();
    });

    it('persiste el motivo y quién canceló', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaInicio: '13:00' }));
      await servicio.cancelar(128, socio, { motivo: 'Se suspendió por lluvia' });
      expect(prisma.reserva.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: 'CANCELADA',
            canceladaPorId: socio.id,
            motivoCancelacion: 'Se suspendió por lluvia',
          }),
        }),
      );
    });

    it('la escritura va condicionada al estado CONFIRMADA', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaInicio: '13:00' }));

      await servicio.cancelar(128, socio, {});

      expect(prisma.reserva.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 128, estado: 'CONFIRMADA' } }),
      );
    });

    /*
     * Dos cancelaciones simultáneas: la segunda llega al `updateMany` cuando la
     * fila ya está CANCELADA, así que no actualiza nada. Sin la condición en el
     * `where`, las dos escribían, se mandaban dos mails y el registro de quién
     * canceló quedaba pisado por la última (RN-10).
     */
    it('si otra cancelación ganó la carrera, devuelve 409 y no manda un segundo mail', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaInicio: '13:00' }));
      prisma.reserva.updateMany.mockResolvedValue({ count: 0 });

      await expect(servicio.cancelar(128, socio, {})).rejects.toMatchObject({
        estado: 409,
        tipo: 'RESERVA_NO_CANCELABLE',
      });
      expect(notificaciones.enviarCancelacion).not.toHaveBeenCalled();
    });

    it('el reloj de canceladaEn sale de Reloj, no del sistema', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaInicio: '13:00' }));

      await servicio.cancelar(128, socio, {});

      expect(prisma.reserva.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ canceladaEn: new Date('2026-09-15T13:00:00.000Z') }),
        }),
      );
    });
  });

  describe('reenviarMail', () => {
    it('Reserva ya jugada: 409 REENVIO_NO_DISPONIBLE', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ horaFin: '09:00' }));
      await expect(servicio.reenviarMail(128, socio)).rejects.toMatchObject({
        estado: 409,
        tipo: 'REENVIO_NO_DISPONIBLE',
      });
    });

    it('Reenvío pedido por un administrador: el destinatario es el socio titular', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ usuarioId: otroSocio.id }));
      const respuesta = await servicio.reenviarMail(128, admin);
      expect(respuesta.destinatario).toBe('bruno@e2e.test');
      expect(notificaciones.reenviar).toHaveBeenCalledWith(expect.objectContaining({ id: 128 }), true);
    });

    it('Reserva ajena: un SOCIO no puede reenviar el mail de otro', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ usuarioId: otroSocio.id }));
      await expect(servicio.reenviarMail(128, socio)).rejects.toMatchObject({ estado: 404 });
    });

    it('Cuarto reenvío en una hora: 429', async () => {
      prisma.notificacion.count.mockResolvedValue(3);
      await expect(servicio.reenviarMail(128, socio)).rejects.toMatchObject({
        estado: 429,
        tipo: 'DEMASIADAS_SOLICITUDES',
      });
      expect(notificaciones.reenviar).not.toHaveBeenCalled();
    });

    it('cuenta los reenvíos de la última hora contra el instante de Reloj, no Date.now', async () => {
      await servicio.reenviarMail(128, socio);
      expect(prisma.notificacion.count).toHaveBeenCalledWith({
        where: {
          reservaId: 128,
          reenvio: true,
          // Solo los que salieron: un reenvío fallido no gasta la cuota.
          estado: 'ENVIADA',
          enviadaEn: { gte: new Date('2026-09-15T12:00:00.000Z') },
        },
      });
    });

    /*
     * La respuesta sigue siendo 202 aunque el proveedor falle (RN-14), pero no
     * puede afirmar que el mail salió: antes decía siempre "te reenviamos el
     * mail" y la persona leía tres confirmaciones seguidas sin recibir nada.
     */
    it('si el envío falló, el mensaje no afirma que el mail salió', async () => {
      notificaciones.reenviar.mockResolvedValue('FALLIDA');

      const respuesta = await servicio.reenviarMail(128, socio);

      expect(respuesta.mensaje).not.toContain('Te reenviamos');
      expect(respuesta.mensaje).toContain('No pudimos entregar');
    });

    it('una reserva cancelada reenvía el aviso de cancelación, no la confirmación', async () => {
      prisma.reserva.findUnique.mockResolvedValue(reservaDe({ estado: 'CANCELADA' }));
      const respuesta = await servicio.reenviarMail(128, socio);
      expect(respuesta.tipo).toBe('CANCELACION');
      expect(notificaciones.reenviar).toHaveBeenCalledWith(expect.anything(), false);
    });
  });
});
