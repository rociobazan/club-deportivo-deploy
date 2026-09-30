import { Prisma } from '@prisma/client';
import { CorreoNoEnviadoError } from '../common/correo/correo';
import type { Correo } from '../common/correo/correo';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService, ReservaParaNotificar } from './notificaciones.service';

type PrismaFalso = { notificacion: { create: jest.Mock } };

const configuracion = { cancelacionMinutosMinimos: 120 } as Configuracion;

const reserva: ReservaParaNotificar = {
  id: 128,
  codigo: 'RES-A7F3K2',
  fecha: new Date('2026-09-15T00:00:00.000Z'),
  horaInicio: '19:00',
  horaFin: '20:30',
  cantidadJugadores: 4,
  montoTotal: new Prisma.Decimal('19000'),
  motivoCancelacion: null,
  cancha: { nombre: 'Pádel 1', superficie: 'Cemento' },
  usuario: { email: 'socio@e2e.test' },
  equipamiento: [{ cantidad: 2, equipamiento: { nombre: 'Paleta de pádel' } }],
};

describe('NotificacionesService', () => {
  let correo: { enviar: jest.Mock };
  let prisma: PrismaFalso;
  let servicio: NotificacionesService;

  beforeEach(() => {
    correo = { enviar: jest.fn().mockResolvedValue(undefined) };
    prisma = { notificacion: { create: jest.fn().mockResolvedValue({}) } };
    servicio = new NotificacionesService(
      correo as unknown as Correo,
      configuracion,
      prisma as unknown as PrismaService,
    );
  });

  describe('enviarConfirmacion', () => {
    it('Contenido del mail de confirmación: incluye código, cancha, superficie, horario, jugadores, equipamiento, total y plazo', async () => {
      await servicio.enviarConfirmacion(reserva);

      expect(correo.enviar).toHaveBeenCalledWith({
        para: 'socio@e2e.test',
        asunto: 'Tu turno en Deploy está confirmado · RES-A7F3K2',
        texto: expect.stringContaining('RES-A7F3K2'),
      });
      const { texto } = correo.enviar.mock.calls[0][0] as { texto: string };
      expect(texto).toContain('Pádel 1');
      expect(texto).toContain('Cemento');
      expect(texto).toContain('19:00 a 20:30');
      expect(texto).toContain('Jugadores: 4');
      expect(texto).toContain('Paleta de pádel x2');
      expect(texto).toContain('19000');
      expect(texto).toContain('2 horas');
    });

    it('Envío exitoso registrado: notificación CONFIRMACION en estado ENVIADA', async () => {
      await servicio.enviarConfirmacion(reserva);

      expect(prisma.notificacion.create).toHaveBeenCalledWith({
        data: {
          reservaId: 128,
          tipo: 'CONFIRMACION',
          destinatario: 'socio@e2e.test',
          estado: 'ENVIADA',
          reenvio: false,
        },
      });
    });

    it('Proveedor caído al crear: no lanza y persiste FALLIDA con el error', async () => {
      correo.enviar.mockRejectedValue(new CorreoNoEnviadoError('el proveedor rechazó el envío'));

      await expect(servicio.enviarConfirmacion(reserva)).resolves.toBe('FALLIDA');
      expect(prisma.notificacion.create).toHaveBeenCalledWith({
        data: {
          reservaId: 128,
          tipo: 'CONFIRMACION',
          destinatario: 'socio@e2e.test',
          estado: 'FALLIDA',
          reenvio: false,
          error: 'el proveedor rechazó el envío',
        },
      });
    });

    it('un error inesperado del proveedor tampoco se propaga: devuelve FALLIDA y lo registra', async () => {
      correo.enviar.mockRejectedValue(new Error('otra falla'));

      await expect(servicio.enviarConfirmacion(reserva)).resolves.toBe('FALLIDA');
      expect(prisma.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ estado: 'FALLIDA', error: expect.stringContaining('otra falla') }),
      });
    });

    /*
     * RN-14: quien llama ya persistió su operación. Si además de fallar el mail
     * falla la escritura de la notificación, lo único que queda es el log; lo
     * que no puede pasar es que el error suba y convierta un 200 en un 500.
     */
    it('si tampoco se puede registrar la notificación, no se propaga nada', async () => {
      correo.enviar.mockRejectedValue(new CorreoNoEnviadoError('el proveedor rechazó el envío'));
      prisma.notificacion.create.mockRejectedValue(new Error('la base no responde'));

      await expect(servicio.enviarConfirmacion(reserva)).resolves.toBe('FALLIDA');
    });

    it('un fallo al registrar un envío exitoso tampoco se propaga', async () => {
      prisma.notificacion.create.mockRejectedValue(new Error('la base no responde'));

      await expect(servicio.enviarConfirmacion(reserva)).resolves.toBe('ENVIADA');
    });
  });

  describe('enviarCancelacion', () => {
    it('arma el asunto de cancelación y registra el tipo CANCELACION', async () => {
      await servicio.enviarCancelacion({ ...reserva, motivoCancelacion: 'Se suspendió por lluvia' });

      expect(correo.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ asunto: 'Cancelamos tu turno en Deploy · RES-A7F3K2' }),
      );
      const { texto } = correo.enviar.mock.calls[0][0] as { texto: string };
      expect(texto).toContain('Se suspendió por lluvia');
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'CANCELACION' }) }),
      );
    });

    it('Proveedor caído al cancelar: no lanza y persiste FALLIDA', async () => {
      correo.enviar.mockRejectedValue(new CorreoNoEnviadoError('caído'));
      await expect(servicio.enviarCancelacion(reserva)).resolves.toBe('FALLIDA');
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'FALLIDA' }) }),
      );
    });
  });

  describe('reenviar', () => {
    it('Reenvío de la confirmación: activa=true arma el asunto de confirmación y marca reenvio', async () => {
      await servicio.reenviar(reserva, true);

      expect(correo.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ asunto: 'Tu turno en Deploy está confirmado · RES-A7F3K2' }),
      );
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reenvio: true, tipo: 'CONFIRMACION' }) }),
      );
    });

    it('Reenvío del aviso de cancelación: activa=false arma el asunto de cancelación', async () => {
      await servicio.reenviar(reserva, false);

      expect(correo.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ asunto: 'Cancelamos tu turno en Deploy · RES-A7F3K2' }),
      );
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reenvio: true, tipo: 'CANCELACION' }) }),
      );
    });

    it('Proveedor caído al reenviar: no lanza y persiste FALLIDA', async () => {
      correo.enviar.mockRejectedValue(new CorreoNoEnviadoError('caído'));
      await expect(servicio.reenviar(reserva, true)).resolves.toBe('FALLIDA');
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'FALLIDA', reenvio: true }) }),
      );
    });
  });
});
