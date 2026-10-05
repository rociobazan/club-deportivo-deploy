import { Prisma } from '@prisma/client';
import { aNumero } from '../catalogo/mapeadores';
import { minutosEntre, sumarDias } from '../common/fechas';
import { generarGrilla } from '../common/grilla';
import { HorarioDelClub, ventanaDelDia } from '../common/horario';
import type { Momento } from '../common/reloj';

/*
 * El panel del club (RF-11) como función pura: recibe lo que el servicio leyó
 * de la base y arma el `PanelAdmin` del contrato. No toca Prisma ni el reloj,
 * así que los escenarios de la spec se prueban con sus números exactos sin
 * base (design.md, decisión 4).
 */

/** Una cancha activa, con la duración del turno de su disciplina. */
export type CanchaDelPanel = {
  id: number;
  nombre: string;
  disciplina: string;
  duracionTurnoMin: number;
};

/** Una reserva no cancelada, de la fecha consultada o de alguno de los 6 días anteriores. */
export type ReservaDelPanel = {
  id: number;
  canchaId: number;
  cancha: string;
  disciplina: string;
  cliente: string;
  fecha: string;
  horaInicio: string;
  cantidadJugadores: number | null;
  montoTotal: Prisma.Decimal | number;
};

/** Una cancelación hecha el día consultado, con el momento en la hora local del club. */
export type CancelacionDelPanel = {
  fecha: string;
  horaInicio: string;
  canceladaEn: Momento;
};

export type EntradaDelPanel = {
  fecha: string;
  ahora: Momento;
  horario: HorarioDelClub;
  /** `CANCELACION_MINUTOS_MINIMOS`: el plazo con el que una cancelación cuenta como "dentro del plazo". */
  plazoCancelacionMin: number;
  canchas: CanchaDelPanel[];
  reservas: ReservaDelPanel[];
  cancelaciones: CancelacionDelPanel[];
};

export type OcupacionCancha = {
  canchaId: number;
  nombre: string;
  disciplina: string;
  porcentaje: number;
};

export type ProximoTurno = {
  reservaId: number;
  horaInicio: string;
  cancha: string;
  disciplina: string;
  cliente: string;
  cantidadJugadores: number | null;
};

export type PanelAdmin = {
  fecha: string;
  reservasDelDia: number;
  reservasDiaAnterior: number;
  facturacionPrevista: number;
  cancelacionesDelDia: number;
  cancelacionesDentroDelPlazo: number;
  ocupacionDelDia: number;
  ocupacionPromedioSemanal: number;
  ocupacionPorCancha: OcupacionCancha[];
  proximosTurnos: ProximoTurno[];
};

/** Los 7 días que terminan en la fecha consultada, del más viejo al más nuevo. */
export const diasDeLaSemana = (fecha: string) =>
  Array.from({ length: 7 }, (_, i) => sumarDias(fecha, i - 6));

/** Porcentaje entero, redondeado al más cercano y acotado entre 0 y 100. Sin turnos, 0. */
const porcentaje = (ocupados: number, ofrecidos: number) =>
  ofrecidos === 0 ? 0 : Math.min(100, Math.max(0, Math.round((100 * ocupados) / ofrecidos)));

/**
 * Turnos que ofrece una cancha un día: la misma grilla que usa la
 * disponibilidad, así que un sábado ofrece menos y un día cerrado, ninguno.
 */
function turnosOfrecidos(cancha: CanchaDelPanel, fecha: string, horario: HorarioDelClub): number {
  const ventana = ventanaDelDia(fecha, horario);
  if (!ventana) return 0;
  return generarGrilla(ventana.apertura, ventana.cierre, cancha.duracionTurnoMin).length;
}

export function calcularPanel(entrada: EntradaDelPanel): PanelAdmin {
  const { fecha, ahora, horario, canchas, reservas, cancelaciones } = entrada;
  const diaAnterior = sumarDias(fecha, -1);
  const delDia = reservas.filter((r) => r.fecha === fecha);

  /*
   * Ocupación: turnos con reserva no cancelada sobre turnos ofrecidos, por
   * cancha y por día. Solo cuentan las reservas de canchas activas: una cancha
   * dada de baja no está en el denominador, y si estuviera en el numerador el
   * porcentaje podría pasar de 100 (design.md, decisión 5).
   */
  const ocupadosPorCanchaYDia = new Map<string, number>();
  for (const reserva of reservas) {
    const clave = `${reserva.canchaId}|${reserva.fecha}`;
    ocupadosPorCanchaYDia.set(clave, (ocupadosPorCanchaYDia.get(clave) ?? 0) + 1);
  }
  const ocupados = (canchaId: number, dia: string) =>
    ocupadosPorCanchaYDia.get(`${canchaId}|${dia}`) ?? 0;

  const dias = diasDeLaSemana(fecha).map((dia) => {
    const ofrecidos = canchas.reduce((total, c) => total + turnosOfrecidos(c, dia, horario), 0);
    const ocupadosDelDia = canchas.reduce((total, c) => total + ocupados(c.id, dia), 0);
    return { dia, ofrecidos, ocupados: ocupadosDelDia };
  });

  // Un día que no ofrece turnos (cerrado, o sin canchas activas) no entra en el
  // promedio: dividiría por cero y bajaría el promedio sin que nadie faltara.
  const diasAbiertos = dias.filter((d) => d.ofrecidos > 0);
  const ocupacionPromedioSemanal =
    diasAbiertos.length === 0
      ? 0
      : Math.round(
          (100 * diasAbiertos.reduce((suma, d) => suma + d.ocupados / d.ofrecidos, 0)) /
            diasAbiertos.length,
        );
  const hoy = dias[dias.length - 1];

  const ocupacionPorCancha = canchas
    .map((cancha) => {
      const ofrecidos = dias.reduce((t, d) => t + turnosOfrecidos(cancha, d.dia, horario), 0);
      const tomados = dias.reduce((t, d) => t + ocupados(cancha.id, d.dia), 0);
      return {
        canchaId: cancha.id,
        nombre: cancha.nombre,
        disciplina: cancha.disciplina,
        porcentaje: porcentaje(tomados, ofrecidos),
      };
    })
    .sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'es') || a.nombre.localeCompare(b.nombre, 'es'));

  // Si la fecha es hoy, solo lo que todavía no empezó: uno que empieza justo
  // ahora ya empezó.
  const proximosTurnos = delDia
    .filter((r) => fecha !== ahora.fecha || r.horaInicio > ahora.hora)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.cancha.localeCompare(b.cancha, 'es'))
    .map((r) => ({
      reservaId: r.id,
      horaInicio: r.horaInicio,
      cancha: r.cancha,
      disciplina: r.disciplina,
      cliente: r.cliente,
      cantidadJugadores: r.cantidadJugadores,
    }));

  const facturacion = delDia.reduce(
    (suma, r) => suma.add(new Prisma.Decimal(r.montoTotal)),
    new Prisma.Decimal(0),
  );

  const dentroDelPlazo = cancelaciones.filter(
    (c) =>
      minutosEntre(c.canceladaEn, { fecha: c.fecha, hora: c.horaInicio }) >=
      entrada.plazoCancelacionMin,
  );

  return {
    fecha,
    reservasDelDia: delDia.length,
    reservasDiaAnterior: reservas.filter((r) => r.fecha === diaAnterior).length,
    facturacionPrevista: aNumero(facturacion),
    cancelacionesDelDia: cancelaciones.length,
    cancelacionesDentroDelPlazo: dentroDelPlazo.length,
    ocupacionDelDia: porcentaje(hoy.ocupados, hoy.ofrecidos),
    ocupacionPromedioSemanal,
    ocupacionPorCancha,
    proximosTurnos,
  };
}
