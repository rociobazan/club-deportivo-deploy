import { Inject, Injectable } from '@nestjs/common';
import { aFechaDb, deFechaDb, sumarDias } from '../common/fechas';
import { Reloj } from '../common/reloj';
import { CONFIGURACION } from '../configuracion';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { calcularPanel, PanelAdmin } from './panel';

/**
 * `GET /admin/panel` (RF-11): lee lo que hace falta en tres consultas y deja
 * el cálculo a `calcularPanel`, que es una función pura (design.md, decisión 4).
 * Nada se guarda: el panel se calcula en cada consulta.
 */
@Injectable()
export class AdministracionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
  ) {}

  async panel(fechaPedida?: string): Promise<PanelAdmin> {
    const ahora = this.reloj.ahora();
    const fecha = fechaPedida ?? ahora.fecha;

    const [canchas, reservas, canceladas] = await Promise.all([
      this.prisma.cancha.findMany({
        where: { activa: true },
        include: { disciplina: { select: { nombre: true, duracionTurnoMin: true } } },
      }),
      // Los 7 días que terminan en la fecha, que ya incluyen el día anterior.
      this.prisma.reserva.findMany({
        where: {
          estado: { not: 'CANCELADA' },
          fecha: { gte: aFechaDb(sumarDias(fecha, -6)), lte: aFechaDb(fecha) },
        },
        include: {
          cancha: { select: { nombre: true, disciplina: { select: { nombre: true } } } },
          usuario: { select: { nombre: true, apellido: true } },
        },
      }),
      /*
       * Las cancelaciones se cuentan por la fecha **local** de `cancelada_en`,
       * que es un instante UTC. En lugar de convertir "este día en Córdoba" a
       * un rango UTC, se trae una ventana holgada de tres días y se filtra con
       * `Reloj.ahora(instante)`, que es la única conversión de zona del repo
       * (design.md, decisión 4). Son pocas filas de más.
       */
      this.prisma.reserva.findMany({
        where: {
          estado: 'CANCELADA',
          canceladaEn: { gte: aFechaDb(sumarDias(fecha, -1)), lt: aFechaDb(sumarDias(fecha, 2)) },
        },
        select: { fecha: true, horaInicio: true, canceladaEn: true },
      }),
    ]);

    const cancelaciones = canceladas
      .map((c) => ({
        fecha: deFechaDb(c.fecha),
        horaInicio: c.horaInicio,
        canceladaEn: this.reloj.ahora(c.canceladaEn!),
      }))
      .filter((c) => c.canceladaEn.fecha === fecha);

    return calcularPanel({
      fecha,
      ahora,
      horario: {
        apertura: this.configuracion.horaApertura,
        cierre: this.configuracion.horaCierre,
        cierreSabado: this.configuracion.horaCierreSabado,
        diasCerrados: this.configuracion.diasCerrados,
      },
      plazoCancelacionMin: this.configuracion.cancelacionMinutosMinimos,
      canchas: canchas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        disciplina: c.disciplina.nombre,
        duracionTurnoMin: c.disciplina.duracionTurnoMin,
      })),
      reservas: reservas.map((r) => ({
        id: r.id,
        canchaId: r.canchaId,
        cancha: r.cancha.nombre,
        disciplina: r.cancha.disciplina.nombre,
        cliente: `${r.usuario.nombre} ${r.usuario.apellido}`,
        fecha: deFechaDb(r.fecha),
        horaInicio: r.horaInicio,
        cantidadJugadores: r.cantidadJugadores,
        montoTotal: r.montoTotal,
      })),
      cancelaciones,
    });
  }
}
