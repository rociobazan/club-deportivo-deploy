import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { aNumero } from '../catalogo/mapeadores';
import { CORREO, CorreoNoEnviadoError } from '../common/correo/correo';
import type { Correo } from '../common/correo/correo';
import { deFechaDb } from '../common/fechas';
import { CONFIGURACION } from '../configuracion';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lo mínimo que hace falta para armar los dos mails (spec `notificaciones`).
 * Un tipo propio, no el de `reservas/mapeadores.ts`: este módulo tiene que
 * poder usarse sin depender del módulo `reservas` (design.md, decisión 1), y
 * en particular sin esperar a que exista `POST /reservas` (1.3).
 */
export type ReservaParaNotificar = {
  id: number;
  codigo: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  cantidadJugadores: number | null;
  montoTotal: Prisma.Decimal | number;
  motivoCancelacion?: string | null;
  cancha: { nombre: string; superficie: string | null };
  usuario: { email: string };
  equipamiento: { cantidad: number; equipamiento: { nombre: string } }[];
};

/**
 * Compone y envía los mails de reserva (spec `notificaciones`). El envío
 * nunca revierte la operación que lo dispara (RN-14): una falla se registra
 * como notificación `FALLIDA` con el error, y `enviarConfirmacion`,
 * `enviarCancelacion` y `reenviar` no relanzan esa falla. `enviarConfirmacion`
 * queda disponible para que el ítem 1.3 (creación de reserva) la invoque
 * después de confirmar la transacción.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @Inject(CORREO) private readonly correo: Correo,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
    private readonly prisma: PrismaService,
  ) {}

  async enviarConfirmacion(reserva: ReservaParaNotificar): Promise<void> {
    await this.enviar(reserva, 'CONFIRMACION', false);
  }

  async enviarCancelacion(reserva: ReservaParaNotificar): Promise<void> {
    await this.enviar(reserva, 'CANCELACION', false);
  }

  /**
   * Reenvía el mail que corresponde al estado actual: confirmación si la
   * reserva está activa, cancelación si está `CANCELADA` (spec "Reenvío del
   * mail de una reserva"). `ReservasService.reenviarMail` ya validó el estado
   * y el límite de 3 por hora (RN-16); acá solo se decide qué plantilla usar.
   */
  async reenviar(reserva: ReservaParaNotificar, activa: boolean): Promise<void> {
    await this.enviar(reserva, activa ? 'CONFIRMACION' : 'CANCELACION', true);
  }

  private async enviar(
    reserva: ReservaParaNotificar,
    tipo: 'CONFIRMACION' | 'CANCELACION',
    reenvio: boolean,
  ): Promise<void> {
    const asunto =
      tipo === 'CONFIRMACION'
        ? `Tu turno en Deploy está confirmado · ${reserva.codigo}`
        : `Cancelamos tu turno en Deploy · ${reserva.codigo}`;
    const texto = tipo === 'CONFIRMACION' ? this.cuerpoConfirmacion(reserva) : this.cuerpoCancelacion(reserva);

    try {
      await this.correo.enviar({ para: reserva.usuario.email, asunto, texto });
      await this.registrar(reserva.id, tipo, reserva.usuario.email, 'ENVIADA', reenvio);
    } catch (causa) {
      if (!(causa instanceof CorreoNoEnviadoError)) throw causa;

      this.logger.error(
        `No se pudo enviar el mail de ${tipo.toLowerCase()} de la reserva ${reserva.codigo}: ${causa.message}`,
      );
      await this.registrar(reserva.id, tipo, reserva.usuario.email, 'FALLIDA', reenvio, causa.message);
    }
  }

  private registrar(
    reservaId: number,
    tipo: 'CONFIRMACION' | 'CANCELACION',
    destinatario: string,
    estado: 'ENVIADA' | 'FALLIDA',
    reenvio: boolean,
    error?: string,
  ) {
    return this.prisma.notificacion.create({
      data: { reservaId, tipo, destinatario, estado, reenvio, ...(error ? { error } : {}) },
    });
  }

  private cuerpoConfirmacion(reserva: ReservaParaNotificar): string {
    return [
      `Código: ${reserva.codigo}`,
      `Cancha: ${reserva.cancha.nombre}${reserva.cancha.superficie ? ` (${reserva.cancha.superficie})` : ''}`,
      `Día: ${deFechaDb(reserva.fecha)}`,
      `Horario: ${reserva.horaInicio} a ${reserva.horaFin}`,
      ...(reserva.cantidadJugadores ? [`Jugadores: ${reserva.cantidadJugadores}`] : []),
      ...this.lineasDeEquipamiento(reserva),
      `Total a pagar en el club: ${aNumero(reserva.montoTotal)}`,
      `Podés cancelar sin costo hasta ${this.configuracion.cancelacionMinutosMinimos / 60} horas antes del turno.`,
    ].join('\n');
  }

  private cuerpoCancelacion(reserva: ReservaParaNotificar): string {
    return [
      `Código: ${reserva.codigo}`,
      `Cancha: ${reserva.cancha.nombre}`,
      `Día: ${deFechaDb(reserva.fecha)}`,
      `Horario: ${reserva.horaInicio} a ${reserva.horaFin}`,
      ...(reserva.motivoCancelacion ? [`Motivo: ${reserva.motivoCancelacion}`] : []),
    ].join('\n');
  }

  private lineasDeEquipamiento(reserva: ReservaParaNotificar): string[] {
    if (reserva.equipamiento.length === 0) return [];
    return [
      'Equipamiento:',
      ...reserva.equipamiento.map((item) => `- ${item.equipamiento.nombre} x${item.cantidad}`),
    ];
  }
}
