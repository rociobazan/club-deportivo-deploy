import { Inject, Injectable } from '@nestjs/common';
import type { TipoNotificacion } from '@prisma/client';
import { ErrorDeApi } from '../common/error-de-api';
import { aFechaDb, deFechaDb } from '../common/fechas';
import { Reloj } from '../common/reloj';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import { CONFIGURACION } from '../configuracion';
import type { Configuracion } from '../configuracion';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';
import { ListarReservasDto } from './dto/listar-reservas.dto';
import { aReserva, ReservaConDetalle, ReservaPublica, turnoTermino } from './mapeadores';

/** `ReenvioMailResponse` del contrato. */
export type ReenvioMailRespuesta = { mensaje: string; tipo: TipoNotificacion; destinatario: string };

const MAXIMO_REENVIOS_POR_HORA = 3;
const VENTANA_REENVIO_MS = 60 * 60 * 1000;

const INCLUDE = {
  usuario: { select: { nombre: true, apellido: true, email: true } },
  cancha: { include: { disciplina: { select: { nombre: true } } } },
  equipamiento: { include: { equipamiento: { select: { nombre: true } } } },
} as const;

const noEncontrada = (id: number) =>
  new ErrorDeApi(404, 'NO_ENCONTRADO', 'No encontramos lo que pediste', `No existe una reserva con id ${id}.`);

/**
 * RF-05 (listado y detalle), RF-06 (cancelación) y el reenvío de mail
 * (spec `notificaciones`). La creación (`POST /reservas`, 1.3) no vive acá
 * todavía: cuando llegue, va a agregar su propio método a este service.
 */
@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
    private readonly notificaciones: NotificacionesService,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
  ) {}

  /** Un SOCIO recibe siempre las propias, ignorando un `clienteId` ajeno (RN-13). */
  async listar(filtros: ListarReservasDto, usuario: UsuarioAutenticado): Promise<ReservaPublica[]> {
    const clienteId = usuario.rol === 'SOCIO' ? usuario.id : filtros.clienteId;
    // COMPLETADA no se persiste (decisión 9): se pide CONFIRMADA y se filtra ya mapeada.
    const estadoEnLaBase = filtros.estado === undefined || filtros.estado === 'COMPLETADA' ? 'CONFIRMADA' : filtros.estado;

    const reservas = await this.prisma.reserva.findMany({
      where: {
        ...(clienteId === undefined ? {} : { usuarioId: clienteId }),
        ...(filtros.fecha === undefined ? {} : { fecha: aFechaDb(filtros.fecha) }),
        ...(filtros.estado === undefined ? {} : { estado: estadoEnLaBase }),
      },
      include: INCLUDE,
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });

    const ahora = this.reloj.ahora();
    const mapeadas = reservas.map((reserva) => aReserva(reserva, ahora));
    return filtros.estado === undefined ? mapeadas : mapeadas.filter((r) => r.estado === filtros.estado);
  }

  /** 404 idéntico si no existe o pertenece a otro SOCIO (RN-13). */
  async obtener(id: number, usuario: UsuarioAutenticado): Promise<ReservaPublica> {
    const reserva = await this.buscar(id, usuario);
    return aReserva(reserva, this.reloj.ahora());
  }

  async cancelar(
    id: number,
    usuario: UsuarioAutenticado,
    { motivo }: CancelarReservaDto,
  ): Promise<ReservaPublica> {
    const reserva = await this.buscar(id, usuario);
    const ahora = this.reloj.ahora();

    if (reserva.estado === 'CANCELADA') {
      throw new ErrorDeApi(
        409,
        'RESERVA_NO_CANCELABLE',
        'Esta reserva ya no se puede cancelar',
        `La reserva ${reserva.codigo} ya está cancelada.`,
      );
    }
    if (turnoTermino(deFechaDb(reserva.fecha), reserva.horaFin, ahora)) {
      throw new ErrorDeApi(
        409,
        'RESERVA_NO_CANCELABLE',
        'Esta reserva ya no se puede cancelar',
        `La reserva ${reserva.codigo} ya se jugó.`,
      );
    }
    // Un ADMIN cancela sin plazo, incluso reservas de otros usuarios (RN-04).
    if (usuario.rol === 'SOCIO' && this.minutosHastaElTurno(reserva, ahora) < this.configuracion.cancelacionMinutosMinimos) {
      throw new ErrorDeApi(
        422,
        'PLAZO_CANCELACION_VENCIDO',
        'Ya no es posible cancelar esta reserva',
        `La cancelación debe hacerse con al menos ${this.configuracion.cancelacionMinutosMinimos / 60} horas de anticipación.`,
      );
    }

    const cancelada = await this.prisma.reserva.update({
      where: { id: reserva.id },
      data: {
        estado: 'CANCELADA',
        canceladaEn: new Date(),
        canceladaPorId: usuario.id,
        motivoCancelacion: motivo ?? null,
      },
      include: INCLUDE,
    });

    // Después de persistir, fuera de la transacción (RN-14): un fallo del
    // proveedor no revierte la cancelación (NotificacionesService lo garantiza).
    await this.notificaciones.enviarCancelacion(cancelada);

    return aReserva(cancelada, this.reloj.ahora());
  }

  async reenviarMail(id: number, usuario: UsuarioAutenticado): Promise<ReenvioMailRespuesta> {
    const reserva = await this.buscar(id, usuario);
    const ahora = this.reloj.ahora();

    if (turnoTermino(deFechaDb(reserva.fecha), reserva.horaFin, ahora)) {
      throw new ErrorDeApi(
        409,
        'REENVIO_NO_DISPONIBLE',
        'No hay mail para reenviar',
        `El turno de la reserva ${reserva.codigo} ya terminó.`,
      );
    }

    const reenviosEnLaUltimaHora = await this.prisma.notificacion.count({
      where: {
        reservaId: reserva.id,
        reenvio: true,
        enviadaEn: { gte: new Date(this.reloj.instante().getTime() - VENTANA_REENVIO_MS) },
      },
    });
    if (reenviosEnLaUltimaHora >= MAXIMO_REENVIOS_POR_HORA) {
      throw new ErrorDeApi(
        429,
        'DEMASIADAS_SOLICITUDES',
        'Ya reenviamos este mail varias veces',
        `Se admiten hasta ${MAXIMO_REENVIOS_POR_HORA} reenvíos por hora. Volvé a intentar más tarde.`,
      );
    }

    const activa = reserva.estado !== 'CANCELADA';
    await this.notificaciones.reenviar(reserva, activa);

    return {
      mensaje: 'Te reenviamos el mail de tu reserva.',
      tipo: activa ? 'CONFIRMACION' : 'CANCELACION',
      destinatario: reserva.usuario.email,
    };
  }

  /** 404, no 403: una reserva ajena no se distingue de una inexistente (RN-13). */
  private async buscar(id: number, usuario: UsuarioAutenticado): Promise<ReservaConDetalle> {
    const reserva = await this.prisma.reserva.findUnique({ where: { id }, include: INCLUDE });
    if (!reserva || (usuario.rol === 'SOCIO' && reserva.usuarioId !== usuario.id)) {
      throw noEncontrada(id);
    }
    return reserva;
  }

  /** Minutos entre ahora y el inicio del turno; negativo si ya empezó. */
  private minutosHastaElTurno(reserva: { fecha: Date; horaInicio: string }, ahora: { fecha: string; hora: string }): number {
    const comoInstante = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00.000Z`).getTime();
    const turno = comoInstante(deFechaDb(reserva.fecha), reserva.horaInicio);
    const actual = comoInstante(ahora.fecha, ahora.hora);
    return Math.round((turno - actual) / 60_000);
  }
}
