import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorDeApi } from '../common/error-de-api';
import { aFechaDb, comparar, sumarDias } from '../common/fechas';
import { Bloque, generarGrilla } from '../common/grilla';
import { ventanaDelDia } from '../common/horario';
import { Reloj } from '../common/reloj';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import { CONFIGURACION } from '../configuracion';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { generarCodigo } from './codigo';
import { CrearReservaDto, ItemEquipamientoDto } from './dto/crear-reserva.dto';
import { COLUMNAS_CODIGO, COLUMNAS_SLOT_ACTIVO, esViolacionDe } from './errores-de-prisma';
import { aReserva, ReservaPublica } from './mapeadores';

/**
 * Creación de reservas: los ocho requisitos de creación de la spec `reservas`.
 *
 * El orden de las validaciones está fijado en design.md §1 y no es casual,
 * porque decide qué código HTTP gana cuando fallan dos cosas a la vez: primero
 * lo que se contesta sin tocar la base, después lo que depende de una consulta,
 * y al final lo que depende del estado de **otras** reservas, que es lo único
 * que puede cambiar entre que se valida y se escribe.
 *
 * Esas últimas tres validaciones (RN-07, RN-05 y RN-01) viven adentro de la
 * transacción, después de los locks. Afuera, el lock no protegería nada.
 */

/** Colisiones de código: con 36^6 combinaciones, tres intentos sobran. */
const INTENTOS_POR_CODIGO = 3;

type CanchaDelTurno = Prisma.CanchaGetPayload<{
  include: { disciplina: { select: { id: true; nombre: true; duracionTurnoMin: true } } };
}>;

/** Un ítem pedido, ya resuelto contra la base: nombre, stock y precio congelado. */
type ItemPedido = {
  equipamientoId: number;
  cantidad: number;
  nombre: string;
  stockTotal: number;
  precioUnitario: Prisma.Decimal;
};

type DatosDeReserva = {
  dto: CrearReservaDto;
  usuario: UsuarioAutenticado;
  horaFin: string;
  pedidos: ItemPedido[];
  montoCancha: Prisma.Decimal;
  montoEquipamiento: Prisma.Decimal;
};

const INCLUDE_DETALLE = {
  cancha: { select: { nombre: true } },
  equipamiento: { include: { equipamiento: { select: { nombre: true } } } },
} as const;

type ReservaConDetalle = Prisma.ReservaGetPayload<{ include: typeof INCLUDE_DETALLE }>;

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
  ) {}

  async crear(dto: CrearReservaDto, usuario: UsuarioAutenticado): Promise<ReservaPublica> {
    // Pasos 2 a 5: nada de esto depende de otras reservas, así que va afuera de
    // la transacción, para que la transacción dure lo menos posible.
    const cancha = await this.buscarCancha(dto.canchaId);
    const bloque = this.bloqueDelTurno(dto.fecha, dto.horaInicio, cancha);
    this.validarFechaReservable(dto.fecha, dto.horaInicio);
    const pedidos = await this.itemsPedidos(dto.equipamiento ?? [], cancha);

    const montoCancha = cancha.precioPorTurno;
    const montoEquipamiento = pedidos.reduce(
      // Aritmética de Decimal y no de number: es dinero (design.md §5).
      (total, pedido) => total.add(pedido.precioUnitario.mul(pedido.cantidad)),
      new Prisma.Decimal(0),
    );

    const reserva = await this.persistir({
      dto,
      usuario,
      horaFin: bloque.horaFin,
      pedidos,
      montoCancha,
      montoEquipamiento,
    });

    /*
     * Punto de enganche del ítem 1.4 (RF-08): el mail de confirmación va acá,
     * con la transacción ya commiteada y antes del return. Tiene que ser
     * después del commit porque RN-14 exige que una falla del proveedor no
     * revierta la reserva ni cambie la respuesta.
     *
     * Este cambio no manda mails: la capacidad `notificaciones` es del ítem 1.4.
     */

    return aReserva(reserva);
  }

  /** Paso 2: existencia. No se puede opinar del horario de una cancha que no existe. */
  private async buscarCancha(canchaId: number): Promise<CanchaDelTurno> {
    const cancha = await this.prisma.cancha.findFirst({
      where: { id: canchaId, activa: true, disciplina: { activa: true } },
      include: { disciplina: { select: { id: true, nombre: true, duracionTurnoMin: true } } },
    });

    if (!cancha) {
      throw new ErrorDeApi(
        404,
        'NO_ENCONTRADO',
        'No encontramos lo que pediste',
        `No existe una cancha activa con id ${canchaId}.`,
      );
    }
    return cancha;
  }

  /**
   * Paso 3 (RN-09): la hora pedida tiene que ser el inicio de un turno de la
   * grilla **de ese día**, y de ahí sale la hora de fin. Un día cerrado no tiene
   * ventana, así que no tiene bloques y cae en el mismo 422, sin un caso
   * especial (design.md §4). Que la reserva y la disponibilidad deriven de las
   * mismas dos funciones es lo que hace que no puedan discrepar.
   */
  private bloqueDelTurno(fecha: string, horaInicio: string, cancha: CanchaDelTurno): Bloque {
    const { horaApertura, horaCierre, horaCierreSabado, diasCerrados } = this.configuracion;
    const ventana = ventanaDelDia(fecha, {
      apertura: horaApertura,
      cierre: horaCierre,
      cierreSabado: horaCierreSabado,
      diasCerrados,
    });

    const bloques = ventana
      ? generarGrilla(ventana.apertura, ventana.cierre, cancha.disciplina.duracionTurnoMin)
      : [];
    const bloque = bloques.find((candidato) => candidato.horaInicio === horaInicio);

    if (!bloque) {
      throw new ErrorDeApi(
        422,
        'HORARIO_FUERA_DE_TURNO',
        'Ese horario no es un turno del club',
        ventana
          ? `El ${fecha} la cancha ${cancha.nombre} abre de ${ventana.apertura} a ${ventana.cierre} en turnos de ${cancha.disciplina.duracionTurnoMin} minutos, y ${horaInicio} no es el inicio de ninguno.`
          : `El ${fecha} el club no abre.`,
      );
    }
    return bloque;
  }

  /** Paso 4 (RN-02 y RN-03), en la hora local del club. */
  private validarFechaReservable(fecha: string, horaInicio: string): void {
    const ahora = this.reloj.ahora();

    const yaPaso =
      comparar(fecha, ahora.fecha) < 0 ||
      (fecha === ahora.fecha && comparar(horaInicio, ahora.hora) < 0);
    if (yaPaso) {
      throw new ErrorDeApi(
        422,
        'FECHA_EN_EL_PASADO',
        'Ese turno ya pasó',
        `Son las ${ahora.hora} del ${ahora.fecha}: no se puede reservar el ${fecha} a las ${horaInicio}.`,
      );
    }

    // Límite inclusivo: el último día del horizonte todavía se puede reservar.
    const ultimoDia = sumarDias(ahora.fecha, this.configuracion.horizonteReservaDias);
    if (comparar(fecha, ultimoDia) > 0) {
      throw new ErrorDeApi(
        422,
        'HORIZONTE_EXCEDIDO',
        'Esa fecha está demasiado lejos',
        `Se puede reservar hasta el ${ultimoDia}, ${this.configuracion.horizonteReservaDias} días desde hoy.`,
      );
    }
  }

  /**
   * Pasos 2 y 5 del equipamiento: existencia y alta (404), y que sea de la
   * disciplina de la cancha (RN-08, 422). El stock es el paso 7 y va adentro de
   * la transacción, porque depende de otras reservas.
   */
  private async itemsPedidos(
    pedidos: ItemEquipamientoDto[],
    cancha: CanchaDelTurno,
  ): Promise<ItemPedido[]> {
    if (pedidos.length === 0) return [];

    const ids = pedidos.map((pedido) => pedido.equipamientoId);
    const items = await this.prisma.equipamiento.findMany({
      where: { id: { in: ids }, activo: true },
    });
    const porId = new Map(items.map((item) => [item.id, item]));

    const faltantes = ids.filter((id) => !porId.has(id));
    if (faltantes.length > 0) {
      throw new ErrorDeApi(
        404,
        'NO_ENCONTRADO',
        'No encontramos lo que pediste',
        `No existe equipamiento activo con id ${faltantes.join(', ')}.`,
      );
    }

    const ajenos = items.filter((item) => item.disciplinaId !== cancha.disciplinaId);
    if (ajenos.length > 0) {
      throw new ErrorDeApi(
        422,
        'EQUIPAMIENTO_DE_OTRA_DISCIPLINA',
        'Ese equipamiento no es de la disciplina de la cancha',
        `${ajenos.map((item) => item.nombre).join(', ')} no se puede alquilar en una cancha de ${cancha.disciplina.nombre}.`,
      );
    }

    return pedidos.map((pedido) => {
      const item = porId.get(pedido.equipamientoId);
      if (!item) throw new Error('Ítem ya validado como existente');
      return {
        equipamientoId: item.id,
        cantidad: pedido.cantidad,
        nombre: item.nombre,
        stockTotal: item.stockTotal,
        // Precio congelado (RN-06): se copia ahora y no se vuelve a leer.
        precioUnitario: item.precioPorTurno,
      };
    });
  }

  /**
   * La transacción, con el reintento del código **por fuera**: si el `INSERT`
   * falla, PostgreSQL aborta la transacción entera y no se puede seguir usando,
   * así que reintentar adentro no funcionaría.
   */
  private async persistir(datos: DatosDeReserva): Promise<ReservaConDetalle> {
    let intento = 0;
    // Sale por `return`, o por `throw` cuando se agotan los intentos.
    for (;;) {
      intento += 1;
      try {
        return await this.prisma.$transaction((tx) => this.enLaTransaccion(tx, datos));
      } catch (error) {
        const codigoRepetido = esViolacionDe(error, COLUMNAS_CODIGO);
        if (!codigoRepetido || intento >= INTENTOS_POR_CODIGO) throw error;
        // No es culpa de quien reserva: se genera otro código y se vuelve a intentar.
        this.logger.warn(`Código de reserva repetido en el intento ${intento}; se genera otro.`);
      }
    }
  }

  private async enLaTransaccion(
    tx: Prisma.TransactionClient,
    datos: DatosDeReserva,
  ): Promise<ReservaConDetalle> {
    await this.tomarLocks(tx, datos);
    await this.validarLimiteDeReservasActivas(tx, datos.usuario);
    await this.validarStock(tx, datos);
    await this.validarTurnoLibre(tx, datos);
    return this.insertar(tx, datos);
  }

  /**
   * Paso previo a todo conteo (design.md §3). Sin esto, con el aislamiento
   * *read committed* que usa PostgreSQL por defecto, dos transacciones
   * simultáneas no ven las filas no commiteadas de la otra y las dos concluyen
   * que hay stock —o que el socio está bajo el límite—. RN-05 y RN-07 no tienen
   * ninguna restricción en la base que las ataje, así que el lock es la única
   * garantía. RN-01 sí la tiene, y por eso no necesita lock.
   *
   * El lock es por socio y por ítem: dos personas reservando cosas distintas no
   * se cruzan nunca. El `ORDER BY id` evita que dos solicitudes con ítems en
   * común pero en distinto orden se traben entre sí.
   */
  private async tomarLocks(tx: Prisma.TransactionClient, datos: DatosDeReserva): Promise<void> {
    await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${datos.usuario.id} FOR UPDATE`;

    if (datos.pedidos.length === 0) return;
    const ids = datos.pedidos.map((pedido) => pedido.equipamientoId);
    await tx.$queryRaw`SELECT id FROM equipamiento WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  }

  /**
   * Paso 6 (RN-07). Una reserva está activa cuando está `CONFIRMADA` y su turno
   * todavía no terminó, así que las canceladas y las ya jugadas no cuentan. Un
   * `ADMIN` no tiene límite.
   */
  private async validarLimiteDeReservasActivas(
    tx: Prisma.TransactionClient,
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    if (usuario.rol !== 'SOCIO') return;

    const ahora = this.reloj.ahora();
    const hoy = aFechaDb(ahora.fecha);
    const activas = await tx.reserva.count({
      where: {
        usuarioId: usuario.id,
        estado: 'CONFIRMADA',
        // `horaFin` es VarChar(5) en HH:MM: comparar como texto es comparar en el tiempo.
        OR: [{ fecha: { gt: hoy } }, { fecha: hoy, horaFin: { gt: ahora.hora } }],
      },
    });

    const tope = this.configuracion.maxReservasActivasSocio;
    if (activas >= tope) {
      throw new ErrorDeApi(
        422,
        'LIMITE_RESERVAS_ACTIVAS',
        'Llegaste al máximo de reservas activas',
        `Ya tenés ${activas} de ${tope} reservas activas. Cancelá una o esperá a que pase el turno.`,
      );
    }
  }

  /**
   * Paso 7 (RN-05). El stock se mide **por turno**, no global: disponible es el
   * `stockTotal` menos lo alquilado en reservas no canceladas de la misma fecha
   * y hora de inicio, en cualquier cancha. Es el mismo `groupBy` que usa
   * `CatalogoService` para el `stockDisponible` del catálogo, así el formulario
   * y la creación cuentan igual.
   */
  private async validarStock(
    tx: Prisma.TransactionClient,
    { dto, pedidos }: DatosDeReserva,
  ): Promise<void> {
    if (pedidos.length === 0) return;

    const alquilado = await tx.reservaEquipamiento.groupBy({
      by: ['equipamientoId'],
      where: {
        reserva: {
          fecha: aFechaDb(dto.fecha),
          horaInicio: dto.horaInicio,
          estado: { not: 'CANCELADA' },
        },
      },
      _sum: { cantidad: true },
    });
    const usadoPorItem = new Map(
      alquilado.map((fila) => [fila.equipamientoId, fila._sum.cantidad ?? 0]),
    );

    for (const pedido of pedidos) {
      const disponible = Math.max(
        0,
        pedido.stockTotal - (usadoPorItem.get(pedido.equipamientoId) ?? 0),
      );
      if (pedido.cantidad > disponible) {
        throw new ErrorDeApi(
          409,
          'STOCK_INSUFICIENTE',
          'No hay stock de equipamiento para ese horario',
          `Se solicitaron ${pedido.cantidad} unidades de "${pedido.nombre}" y hay ${disponible} disponibles.`,
        );
      }
    }
  }

  /**
   * Paso 8 (RN-01), primera mitad. Este pre-chequeo **no garantiza nada**: entre
   * el SELECT y el INSERT entra otra solicitud. Está para dar un mensaje con la
   * cancha y el horario, y para no escribir de más. El árbitro es el índice.
   */
  private async validarTurnoLibre(
    tx: Prisma.TransactionClient,
    { dto }: DatosDeReserva,
  ): Promise<void> {
    const ocupado = await tx.reserva.findFirst({
      where: {
        canchaId: dto.canchaId,
        fecha: aFechaDb(dto.fecha),
        horaInicio: dto.horaInicio,
        estado: { not: 'CANCELADA' },
      },
      select: { id: true },
    });

    if (ocupado) throw this.slotNoDisponible(dto);
  }

  /**
   * Paso 8 (RN-01), segunda mitad y la que de verdad garantiza la regla: el
   * `INSERT` contra `ux_reserva_slot_activo`, que es un índice único parcial. Si
   * dos solicitudes simultáneas pasan las dos el pre-chequeo, una de las dos
   * falla acá, y ese `P2002` es el 409.
   */
  private async insertar(
    tx: Prisma.TransactionClient,
    datos: DatosDeReserva,
  ): Promise<ReservaConDetalle> {
    const { dto, usuario, horaFin, pedidos, montoCancha, montoEquipamiento } = datos;

    try {
      return await tx.reserva.create({
        data: {
          codigo: generarCodigo(this.configuracion.prefijoCodigoReserva),
          usuarioId: usuario.id,
          canchaId: dto.canchaId,
          fecha: aFechaDb(dto.fecha),
          horaInicio: dto.horaInicio,
          horaFin,
          cantidadJugadores: dto.cantidadJugadores ?? null,
          // Solo se persisten CONFIRMADA y CANCELADA: COMPLETADA se deriva al leer.
          estado: 'CONFIRMADA',
          montoCancha,
          montoEquipamiento,
          montoTotal: montoCancha.add(montoEquipamiento),
          equipamiento: {
            create: pedidos.map((pedido) => ({
              equipamientoId: pedido.equipamientoId,
              cantidad: pedido.cantidad,
              precioUnitario: pedido.precioUnitario,
            })),
          },
        },
        include: INCLUDE_DETALLE,
      });
    } catch (error) {
      if (esViolacionDe(error, COLUMNAS_SLOT_ACTIVO)) throw this.slotNoDisponible(dto);
      // El P2002 de `codigo` sigue de largo: lo reintenta `persistir()`.
      throw error;
    }
  }

  private slotNoDisponible(dto: CrearReservaDto): ErrorDeApi {
    return new ErrorDeApi(
      409,
      'SLOT_NO_DISPONIBLE',
      'El horario solicitado ya está reservado',
      `La cancha ${dto.canchaId} ya tiene una reserva activa el ${dto.fecha} a las ${dto.horaInicio}.`,
    );
  }
}
