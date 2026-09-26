import { Injectable } from '@nestjs/common';
import { ErrorDeApi } from '../common/error-de-api';
import { aFechaDb } from '../common/fechas';
import { exigirRol, SolicitudConUsuario } from '../common/usuario-actual';
import { PrismaService } from '../prisma/prisma.service';
import { ListarCanchasDto } from './dto/listar-canchas.dto';
import { ListarEquipamientoDto } from './dto/listar-equipamiento.dto';
import {
  aCancha,
  aDisciplina,
  aEquipamiento,
  CanchaPublica,
  DisciplinaPublica,
  EquipamientoPublico,
} from './mapeadores';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async disciplinas(): Promise<DisciplinaPublica[]> {
    const lista = await this.prisma.disciplina.findMany({
      where: { activa: true },
      orderBy: { id: 'asc' },
    });
    return lista.map(aDisciplina);
  }

  /**
   * Público. `incluirInactivas=true` es la variante de administración: el guard
   * dejó al usuario si vino un token válido y acá se exige ADMIN (spec
   * "Administración de canchas").
   */
  async listarCanchas(
    filtros: ListarCanchasDto,
    solicitud: SolicitudConUsuario,
  ): Promise<CanchaPublica[]> {
    if (filtros.incluirInactivas) exigirRol(solicitud, 'ADMIN');

    const lista = await this.prisma.cancha.findMany({
      where: {
        ...(filtros.incluirInactivas ? {} : { activa: true }),
        ...(filtros.disciplinaId === undefined ? {} : { disciplinaId: filtros.disciplinaId }),
        ...(filtros.techada === undefined ? {} : { techada: filtros.techada }),
      },
      include: { disciplina: { select: { nombre: true } } },
      orderBy: { id: 'asc' },
    });
    return lista.map(aCancha);
  }

  /**
   * Público. Con `fecha` y `horaInicio` cada ítem suma `stockDisponible`:
   * el total menos lo alquilado en reservas no canceladas de ese turno, en
   * cualquier cancha (RN-05), contado en una sola consulta agrupada.
   */
  async listarEquipamiento(
    filtros: ListarEquipamientoDto,
    solicitud: SolicitudConUsuario,
  ): Promise<EquipamientoPublico[]> {
    if (filtros.incluirInactivos) exigirRol(solicitud, 'ADMIN');

    const conFecha = filtros.fecha !== undefined;
    const conHora = filtros.horaInicio !== undefined;
    if (conFecha !== conHora) {
      throw new ErrorDeApi(
        400,
        'SOLICITUD_INVALIDA',
        'La solicitud tiene datos inválidos',
        'fecha y horaInicio van juntos: mandá los dos o ninguno.',
      );
    }

    const lista = await this.prisma.equipamiento.findMany({
      where: {
        ...(filtros.incluirInactivos ? {} : { activo: true }),
        ...(filtros.disciplinaId === undefined ? {} : { disciplinaId: filtros.disciplinaId }),
      },
      orderBy: { id: 'asc' },
    });

    if (!conFecha) return lista.map((item) => aEquipamiento(item));

    const alquilado = await this.prisma.reservaEquipamiento.groupBy({
      by: ['equipamientoId'],
      where: {
        reserva: {
          fecha: aFechaDb(filtros.fecha!),
          horaInicio: filtros.horaInicio,
          estado: { not: 'CANCELADA' },
        },
      },
      _sum: { cantidad: true },
    });
    const unidadesPorItem = new Map(
      alquilado.map((fila) => [fila.equipamientoId, fila._sum.cantidad ?? 0]),
    );

    return lista.map((item) =>
      aEquipamiento(item, Math.max(0, item.stockTotal - (unidadesPorItem.get(item.id) ?? 0))),
    );
  }
}
