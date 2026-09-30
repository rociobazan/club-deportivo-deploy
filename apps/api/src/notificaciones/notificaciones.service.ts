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
 * Cómo terminó un envío. Se devuelve en lugar de `void` para que quien lo pide
 * pueda decir la verdad: sin esto, la respuesta de un reenvío afirmaba que el
 * mail había salido aunque el proveedor lo hubiera rechazado.
 */
export type ResultadoDeEnvio = 'ENVIADA' | 'FALLIDA';

/**
 * Compone y envía los mails de reserva (spec `notificaciones`). El envío
 * nunca revierte la operación que lo dispara (RN-14): una falla se registra
 * como notificación `FALLIDA` con el error, y `enviarConfirmacion`,
 * `enviarCancelacion` y `reenviar` **no propagan ninguna excepción**, ni del
 * proveedor ni de la escritura en base; devuelven `'FALLIDA'`.
 * `enviarConfirmacion` queda disponible para que el ítem 1.3 (creación de
 * reserva) la invoque después de confirmar la transacción.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @Inject(CORREO) private readonly correo: Correo,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
    private readonly prisma: PrismaService,
  ) {}

  async enviarConfirmacion(reserva: ReservaParaNotificar): Promise<ResultadoDeEnvio> {
    return this.enviar(reserva, 'CONFIRMACION', false);
  }

  async enviarCancelacion(reserva: ReservaParaNotificar): Promise<ResultadoDeEnvio> {
    return this.enviar(reserva, 'CANCELACION', false);
  }

  /**
   * Reenvía el mail que corresponde al estado actual: confirmación si la
   * reserva está activa, cancelación si está `CANCELADA` (spec "Reenvío del
   * mail de una reserva"). `ReservasService.reenviarMail` ya validó el estado
   * y el límite de 3 por hora (RN-16); acá solo se decide qué plantilla usar.
   */
  async reenviar(reserva: ReservaParaNotificar, activa: boolean): Promise<ResultadoDeEnvio> {
    return this.enviar(reserva, activa ? 'CONFIRMACION' : 'CANCELACION', true);
  }

  /**
   * Devuelve cómo terminó el envío y **no propaga nada**: quien la llama ya
   * persistió su operación, así que un problema acá no puede convertirse en un
   * error de la respuesta (RN-14). Por eso el perímetro cubre también la
   * composición del mensaje y la escritura de la notificación, no solo la
   * llamada al proveedor: cualquiera de las tres puede fallar y ninguna
   * justifica decirle a la persona que su cancelación no se hizo.
   */
  private async enviar(
    reserva: ReservaParaNotificar,
    tipo: 'CONFIRMACION' | 'CANCELACION',
    reenvio: boolean,
  ): Promise<ResultadoDeEnvio> {
    try {
      const asunto =
        tipo === 'CONFIRMACION'
          ? `Tu turno en Deploy está confirmado · ${reserva.codigo}`
          : `Cancelamos tu turno en Deploy · ${reserva.codigo}`;
      const texto = tipo === 'CONFIRMACION' ? this.cuerpoConfirmacion(reserva) : this.cuerpoCancelacion(reserva);

      await this.correo.enviar({ para: reserva.usuario.email, asunto, texto });
      await this.registrar(reserva.id, tipo, reserva.usuario.email, 'ENVIADA', reenvio);
      return 'ENVIADA';
    } catch (causa) {
      const motivo = causa instanceof CorreoNoEnviadoError ? causa.message : `Error inesperado: ${String(causa)}`;

      this.logger.error(
        `No se pudo enviar el mail de ${tipo.toLowerCase()} de la reserva ${reserva.codigo}: ${motivo}`,
        causa instanceof Error ? causa.stack : undefined,
      );
      await this.registrar(reserva.id, tipo, reserva.usuario.email, 'FALLIDA', reenvio, motivo);
      return 'FALLIDA';
    }
  }

  /**
   * Si la escritura falla, el log es el único rastro que queda: lleva todo lo
   * que haría falta para reconstruir el envío a mano.
   */
  private async registrar(
    reservaId: number,
    tipo: 'CONFIRMACION' | 'CANCELACION',
    destinatario: string,
    estado: 'ENVIADA' | 'FALLIDA',
    reenvio: boolean,
    error?: string,
  ): Promise<void> {
    try {
      await this.prisma.notificacion.create({
        data: { reservaId, tipo, destinatario, estado, reenvio, ...(error ? { error } : {}) },
      });
    } catch (causa) {
      this.logger.error(
        `No se pudo registrar la notificación ${tipo} de la reserva ${reservaId} para ${destinatario} ` +
          `(estado ${estado}, reenvío ${reenvio}${error ? `, error del envío: ${error}` : ''}): ${String(causa)}`,
        causa instanceof Error ? causa.stack : undefined,
      );
    }
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
