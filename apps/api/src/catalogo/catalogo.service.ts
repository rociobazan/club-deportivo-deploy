import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorDeApi } from '../common/error-de-api';
import { esViolacionDe } from '../common/errores-de-prisma';
import { aFechaDb } from '../common/fechas';
import { exigirRol, SolicitudConUsuario } from '../common/usuario-actual';
import { ENTERO_MAXIMO_DB } from '../common/validadores';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarCanchaDto } from './dto/actualizar-cancha.dto';
import { ActualizarEquipamientoDto } from './dto/actualizar-equipamiento.dto';
import { CrearCanchaDto } from './dto/crear-cancha.dto';
import { CrearEquipamientoDto } from './dto/crear-equipamiento.dto';
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

/**
 * Columnas del único `(disciplina_id, nombre)` de `cancha` y de `equipamiento`,
 * como las informa Prisma en el `P2002` (verificado con una sonda, tarea 1.3).
 */
export const COLUMNAS_NOMBRE_POR_DISCIPLINA = ['disciplina_id', 'nombre'] as const;

const INCLUDE_DISCIPLINA = { disciplina: { select: { nombre: true } } } as const;

const noEncontrado = (detalle: string) =>
  new ErrorDeApi(404, 'NO_ENCONTRADO', 'No encontramos lo que pediste', detalle);

/**
 * El precio entra como `number` y se guarda en `Decimal(10,2)`. Se arma desde
 * el texto y no desde el número, para que 15000.1 no termine como 15000.0999…
 */
const aDecimal = (precio: number) => new Prisma.Decimal(String(precio));

/**
 * Un `PATCH` sin ningún campo es 400 y no 200: responder que sí sin haber
 * guardado nada es un éxito silencioso. Se cuentan los valores distintos de
 * `undefined` y no las claves, porque la instancia que arma el pipe trae todas
 * las propiedades declaradas (la trampa de la decisión 30).
 */
function exigirAlgunCampo(datos: object, campos: string) {
  if (Object.values(datos).every((valor) => valor === undefined)) {
    throw new ErrorDeApi(
      400,
      'SOLICITUD_INVALIDA',
      'No hay nada para cambiar',
      `Mandá al menos uno de ${campos}.`,
    );
  }
}

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

  /**
   * `POST /canchas` (RF-12). La cancha se crea activa. El nombre repetido en la
   * disciplina lo decide la base, no una consulta previa: entre el SELECT y el
   * INSERT entra otra solicitud, y la base tendría igual la última palabra.
   */
  async crearCancha(datos: CrearCanchaDto): Promise<CanchaPublica> {
    const disciplina = await this.disciplinaActiva(datos.disciplinaId);
    try {
      const cancha = await this.prisma.cancha.create({
        data: {
          disciplinaId: disciplina.id,
          nombre: datos.nombre,
          // Ausente, `null` o solo espacios (ya recortado a "") es "sin superficie".
          superficie: datos.superficie || null,
          techada: datos.techada ?? false,
          precioPorTurno: aDecimal(datos.precioPorTurno),
        },
        include: INCLUDE_DISCIPLINA,
      });
      return aCancha(cancha);
    } catch (error) {
      throw this.nombreDuplicado(error, 'una cancha', disciplina.nombre, datos.nombre);
    }
  }

  /**
   * `PATCH /canchas/{id}` (RF-12): solo cambia lo que vino. `activa: false` da
   * de baja la cancha sin tocar sus reservas (RN-15), y un precio nuevo no
   * cambia montos ya creados, porque la reserva los copió al crearse (RN-06).
   */
  async actualizarCancha(id: number, datos: ActualizarCanchaDto): Promise<CanchaPublica> {
    exigirAlgunCampo(datos, 'nombre, superficie, techada, precioPorTurno o activa');

    const actual = await this.buscarPorId(id, (idValido) =>
      this.prisma.cancha.findUnique({ where: { id: idValido }, include: INCLUDE_DISCIPLINA }),
    );
    if (!actual) throw noEncontrado(`No existe una cancha con id ${id}.`);

    const cambios: Prisma.CanchaUpdateInput = {};
    if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
    if (datos.superficie !== undefined) cambios.superficie = datos.superficie || null;
    if (datos.techada !== undefined) cambios.techada = datos.techada;
    if (datos.precioPorTurno !== undefined) cambios.precioPorTurno = aDecimal(datos.precioPorTurno);
    if (datos.activa !== undefined) cambios.activa = datos.activa;

    try {
      const cancha = await this.prisma.cancha.update({
        where: { id },
        data: cambios,
        include: INCLUDE_DISCIPLINA,
      });
      return aCancha(cancha);
    } catch (error) {
      throw this.nombreDuplicado(error, 'una cancha', actual.disciplina.nombre, datos.nombre);
    }
  }

  /** `POST /equipamiento` (RF-13). El ítem se crea activo; el nombre repetido es 409, igual que en canchas. */
  async crearEquipamiento(datos: CrearEquipamientoDto): Promise<EquipamientoPublico> {
    const disciplina = await this.disciplinaActiva(datos.disciplinaId);
    try {
      const item = await this.prisma.equipamiento.create({
        data: {
          disciplinaId: disciplina.id,
          nombre: datos.nombre,
          stockTotal: datos.stockTotal,
          precioPorTurno: aDecimal(datos.precioPorTurno),
        },
      });
      return aEquipamiento(item);
    } catch (error) {
      throw this.nombreDuplicado(error, 'un ítem', disciplina.nombre, datos.nombre);
    }
  }

  /**
   * `PATCH /equipamiento/{id}` (RF-13). Ni la baja ni un stock más chico tocan
   * las reservas que ya lo alquilaron (RN-15): el stock disponible de un turno
   * se calcula al consultar y se acota a 0. Un precio nuevo no cambia el
   * `precioUnitario` que cada reserva copió al crearse (RN-06).
   */
  async actualizarEquipamiento(
    id: number,
    datos: ActualizarEquipamientoDto,
  ): Promise<EquipamientoPublico> {
    exigirAlgunCampo(datos, 'nombre, stockTotal, precioPorTurno o activo');

    const actual = await this.buscarPorId(id, (idValido) =>
      this.prisma.equipamiento.findUnique({
        where: { id: idValido },
        include: INCLUDE_DISCIPLINA,
      }),
    );
    if (!actual) throw noEncontrado(`No existe un ítem de equipamiento con id ${id}.`);

    const cambios: Prisma.EquipamientoUpdateInput = {};
    if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
    if (datos.stockTotal !== undefined) cambios.stockTotal = datos.stockTotal;
    if (datos.precioPorTurno !== undefined) cambios.precioPorTurno = aDecimal(datos.precioPorTurno);
    if (datos.activo !== undefined) cambios.activo = datos.activo;

    try {
      return aEquipamiento(await this.prisma.equipamiento.update({ where: { id }, data: cambios }));
    } catch (error) {
      throw this.nombreDuplicado(error, 'un ítem', actual.disciplina.nombre, datos.nombre);
    }
  }

  /** Una cancha o un ítem solo se dan de alta en una disciplina que existe y está activa. */
  private async disciplinaActiva(id: number) {
    const disciplina = await this.prisma.disciplina.findUnique({ where: { id } });
    if (!disciplina || !disciplina.activa) {
      throw noEncontrado(`No existe una disciplina activa con id ${id}.`);
    }
    return disciplina;
  }

  /**
   * El id de la ruta pasa `ParseIntPipe`, que acepta el signo y cualquier
   * tamaño; fuera del rango de un `Int` la base respondería con un 500, y por
   * debajo de 1 no hay ids posibles. Los dos casos son "no existe".
   */
  private async buscarPorId<T>(id: number, buscar: (id: number) => Promise<T | null>) {
    if (id < 1 || id > ENTERO_MAXIMO_DB) return null;
    return buscar(id);
  }

  /** El `P2002` del único por disciplina pasa a 409; cualquier otro error sigue de largo. */
  private nombreDuplicado(error: unknown, recurso: string, disciplina: string, nombre?: string) {
    if (!esViolacionDe(error, COLUMNAS_NOMBRE_POR_DISCIPLINA)) return error;
    return new ErrorDeApi(
      409,
      'NOMBRE_DUPLICADO',
      `Ya existe ${recurso} con ese nombre`,
      `En ${disciplina} ya hay ${recurso} con el nombre "${nombre}".`,
    );
  }
}
