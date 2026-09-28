import type { Equipamiento, Reserva, ReservaEquipamiento } from '@prisma/client';
import { aNumero } from '../catalogo/mapeadores';
import { deFechaDb } from '../common/fechas';

/*
 * Del registro de Prisma al schema `Reserva` del contrato. El dinero se
 * convierte de `Prisma.Decimal` a `number` con el mismo `aNumero` del catálogo
 * (design.md de 1.2, decisión 7), y la fecha con `deFechaDb`, que es el único
 * puente entre el `@db.Date` y el `YYYY-MM-DD` del contrato.
 */

export type ItemDeReserva = {
  equipamientoId: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type ReservaPublica = {
  id: number;
  codigo: string;
  clienteId: number;
  canchaId: number;
  cancha: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cantidadJugadores: number | null;
  estado: string;
  equipamiento: ItemDeReserva[];
  montoCancha: number;
  montoEquipamiento: number;
  montoTotal: number;
  creadaEn: string;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
};

type ReservaConDetalle = Reserva & {
  cancha: { nombre: string };
  equipamiento: (ReservaEquipamiento & { equipamiento: Pick<Equipamiento, 'nombre'> })[];
};

export function aItemDeReserva(
  item: ReservaEquipamiento & { equipamiento: Pick<Equipamiento, 'nombre'> },
): ItemDeReserva {
  const precioUnitario = aNumero(item.precioUnitario);
  return {
    equipamientoId: item.equipamientoId,
    nombre: item.equipamiento.nombre,
    cantidad: item.cantidad,
    precioUnitario,
    // El subtotal es derivado, pero el contrato lo declara: se calcula del
    // precio congelado, no del precio actual del ítem.
    subtotal: precioUnitario * item.cantidad,
  };
}

export function aReserva(reserva: ReservaConDetalle): ReservaPublica {
  return {
    id: reserva.id,
    codigo: reserva.codigo,
    clienteId: reserva.usuarioId,
    canchaId: reserva.canchaId,
    cancha: reserva.cancha.nombre,
    fecha: deFechaDb(reserva.fecha),
    horaInicio: reserva.horaInicio,
    horaFin: reserva.horaFin,
    // `null` y no `undefined`: el contrato la declara nullable, así que la clave
    // viaja igual (escenario "Sin cantidad de jugadores").
    cantidadJugadores: reserva.cantidadJugadores ?? null,
    estado: reserva.estado,
    equipamiento: reserva.equipamiento.map(aItemDeReserva),
    montoCancha: aNumero(reserva.montoCancha),
    montoEquipamiento: aNumero(reserva.montoEquipamiento),
    montoTotal: aNumero(reserva.montoTotal),
    creadaEn: reserva.creadaEn.toISOString(),
    canceladaEn: reserva.canceladaEn?.toISOString() ?? null,
    motivoCancelacion: reserva.motivoCancelacion ?? null,
  };
}
