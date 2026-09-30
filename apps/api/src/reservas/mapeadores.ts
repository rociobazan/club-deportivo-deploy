import type { Cancha, Equipamiento, Reserva, ReservaEquipamiento, Usuario } from '@prisma/client';
import { aNumero } from '../catalogo/mapeadores';
import { comparar, deFechaDb } from '../common/fechas';
import type { Momento } from '../common/reloj';

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
    equipamiento: reserva.equipamiento.map((item) => ({
      equipamientoId: item.equipamientoId,
      nombre: item.equipamiento.nombre,
      cantidad: item.cantidad,
      precioUnitario: aNumero(item.precioUnitario),
      subtotal: aNumero(item.precioUnitario) * item.cantidad,
    })),
    montoCancha: aNumero(reserva.montoCancha),
    montoEquipamiento: aNumero(reserva.montoEquipamiento),
    montoTotal: aNumero(reserva.montoTotal),
    creadaEn: reserva.creadaEn.toISOString(),
    canceladaEn: reserva.canceladaEn?.toISOString() ?? null,
    motivoCancelacion: reserva.motivoCancelacion,
  };
}
