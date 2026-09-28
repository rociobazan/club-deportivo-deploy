import { Inject, Injectable } from '@nestjs/common';
import { aNumero } from '../catalogo/mapeadores';
import { ErrorDeApi } from '../common/error-de-api';
import { aFechaDb, comparar } from '../common/fechas';
import { Bloque, generarGrilla } from '../common/grilla';
import { Reloj } from '../common/reloj';
import { CONFIGURACION } from '../configuracion';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto';

/** `DisponibilidadCancha` y `DisponibilidadResponse` del contrato. */
export type DisponibilidadCancha = {
  canchaId: number;
  nombre: string;
  disciplina: string;
  precioPorTurno: number;
  slots: Bloque[];
};

export type RespuestaDisponibilidad = {
  fecha: string;
  canchas: DisponibilidadCancha[];
};

/**
 * La disponibilidad es un cálculo, no un registro (spec): grilla del día por
 * cancha menos las reservas no canceladas y, si es hoy, menos los turnos ya
 * empezados. Dos consultas y el resto en memoria (design.md, decisión 5).
 */
@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
  ) {}

  async consultar(filtros: ConsultarDisponibilidadDto): Promise<RespuestaDisponibilidad> {
    const hoy = this.reloj.ahora();
    if (comparar(filtros.fecha, hoy.fecha) < 0) {
      throw new ErrorDeApi(
        400,
        'SOLICITUD_INVALIDA',
        'La solicitud tiene datos inválidos',
        `La fecha ${filtros.fecha} ya pasó: consultá desde hoy (${hoy.fecha}).`,
      );
    }

    const canchas = await this.prisma.cancha.findMany({
      where: {
        activa: true,
        disciplina: { activa: true },
        ...(filtros.disciplinaId === undefined ? {} : { disciplinaId: filtros.disciplinaId }),
        ...(filtros.canchaId === undefined ? {} : { id: filtros.canchaId }),
      },
      include: { disciplina: { select: { nombre: true, duracionTurnoMin: true } } },
      orderBy: { id: 'asc' },
    });

    const ocupadas =
      canchas.length === 0
        ? []
        : await this.prisma.reserva.findMany({
            where: {
              fecha: aFechaDb(filtros.fecha),
              estado: { not: 'CANCELADA' },
              canchaId: { in: canchas.map((cancha) => cancha.id) },
            },
            select: { canchaId: true, horaInicio: true },
          });

    const ocupadoPorCancha = new Map<number, Set<string>>();
    for (const reserva of ocupadas) {
      const horas = ocupadoPorCancha.get(reserva.canchaId) ?? new Set<string>();
      horas.add(reserva.horaInicio);
      ocupadoPorCancha.set(reserva.canchaId, horas);
    }

    const esHoy = filtros.fecha === hoy.fecha;
    const { horaApertura, horaCierre } = this.configuracion;

    return {
      fecha: filtros.fecha,
      canchas: canchas.map((cancha) => {
        const ocupado = ocupadoPorCancha.get(cancha.id) ?? new Set<string>();
        const slots = generarGrilla(horaApertura, horaCierre, cancha.disciplina.duracionTurnoMin).filter(
          (bloque) =>
            !ocupado.has(bloque.horaInicio) &&
            (!esHoy || comparar(bloque.horaInicio, hoy.hora) >= 0),
        );
        return {
          canchaId: cancha.id,
          nombre: cancha.nombre,
          disciplina: cancha.disciplina.nombre,
          precioPorTurno: aNumero(cancha.precioPorTurno),
          slots,
        };
      }),
    };
  }
}
