import type { Cancha, Equipamiento, Reserva, ReservaEquipamiento, Usuario } from '@prisma/client';
import { aNumero } from '../catalogo/mapeadores';
import { comparar, deFechaDb } from '../common/fechas';
import type { Momento } from '../common/reloj';

/*
 * Del registro de Prisma al schema `Reserva` del contrato. El dinero se
 * convierte de `Prisma.Decimal` a `number` con el mismo `aNumero` del catálogo
 * (design de 1.2, decisión 7), y la fecha con `deFechaDb`, que es el único
 * puente entre el `@db.Date` y el `YYYY-MM-DD` del contrato.
 *
 * Un solo mapeador para las cinco operaciones: creación (1.3), listado, detalle
 * y cancelación (1.4). El `include` de abajo es el que tienen que usar todas.
 */

/** Lo que necesita `aReserva`, con los `include`/`select` de `ReservasService`. */
export type ReservaConDetalle = Reserva & {
  usuario: Pick<Usuario, 'nombre' | 'apellido' | 'email'>;
  cancha: Cancha & { disciplina: { nombre: string } };
  equipamiento: (ReservaEquipamiento & { equipamiento: Pick<Equipamiento, 'nombre'> })[];
};

export type ItemEquipamientoReserva = {
  equipamientoId: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

/** `Reserva` del contrato, con `estado` `COMPLETADA` derivado (decisión 9: no se persiste). */
export type ReservaPublica = {
  id: number;
  codigo: string;
  clienteId: number;
  cliente: string;
  canchaId: number;
  cancha: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cantidadJugadores: number | null;
  estado: 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA';
  equipamiento: ItemEquipamientoReserva[];
  montoCancha: number;
  montoEquipamiento: number;
  montoTotal: number;
  creadaEn: string;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
};

/**
 * `true` cuando el turno que termina a `horaFin` de `fecha` ya pasó respecto
 * de `ahora` (limite inclusivo: termina justo ahora cuenta como terminado).
 * `ReservasService` la reutiliza para "ya jugada" en cancelación y reenvío.
 */
export function turnoTermino(fecha: string, horaFin: string, ahora: Momento): boolean {
  const comparacionFecha = comparar(fecha, ahora.fecha);
  if (comparacionFecha < 0) return true;
  if (comparacionFecha > 0) return false;
  return comparar(horaFin, ahora.hora) <= 0;
}

function estadoDerivado(reserva: Reserva, ahora: Momento): 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA' {
  if (reserva.estado === 'CANCELADA') return 'CANCELADA';
  return turnoTermino(deFechaDb(reserva.fecha), reserva.horaFin, ahora) ? 'COMPLETADA' : 'CONFIRMADA';
}

/**
 * Un ítem del desglose. El subtotal es derivado, pero el contrato lo declara, y
 * se calcula del precio **congelado** en la reserva, no del precio actual del
 * ítem (RN-06).
 */
export function aItemDeReserva(
  item: ReservaEquipamiento & { equipamiento: Pick<Equipamiento, 'nombre'> },
): ItemEquipamientoReserva {
  const precioUnitario = aNumero(item.precioUnitario);
  return {
    equipamientoId: item.equipamientoId,
    nombre: item.equipamiento.nombre,
    cantidad: item.cantidad,
    precioUnitario,
    subtotal: precioUnitario * item.cantidad,
  };
}

export function aReserva(reserva: ReservaConDetalle, ahora: Momento): ReservaPublica {
  return {
    id: reserva.id,
    codigo: reserva.codigo,
    clienteId: reserva.usuarioId,
    cliente: `${reserva.usuario.nombre} ${reserva.usuario.apellido}`,
    canchaId: reserva.canchaId,
    cancha: `${reserva.cancha.nombre} - ${reserva.cancha.disciplina.nombre}`,
    fecha: deFechaDb(reserva.fecha),
    horaInicio: reserva.horaInicio,
    horaFin: reserva.horaFin,
    cantidadJugadores: reserva.cantidadJugadores,
    estado: estadoDerivado(reserva, ahora),
    equipamiento: reserva.equipamiento.map(aItemDeReserva),
    montoCancha: aNumero(reserva.montoCancha),
    montoEquipamiento: aNumero(reserva.montoEquipamiento),
    montoTotal: aNumero(reserva.montoTotal),
    creadaEn: reserva.creadaEn.toISOString(),
    canceladaEn: reserva.canceladaEn?.toISOString() ?? null,
    motivoCancelacion: reserva.motivoCancelacion,
  };
}
