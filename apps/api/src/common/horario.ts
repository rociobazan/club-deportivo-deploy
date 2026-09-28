/**
 * El horario de atención no es el mismo todos los días: de lunes a viernes el
 * club cierra a `horaCierre`, los sábados antes, y hay días en los que no abre.
 * Se modela con dos valores más sobre la configuración que ya existía, en lugar
 * de una tabla de siete días, porque es lo que el club necesita hoy.
 *
 * `apps/web/lib/club.ts` tiene la misma lógica: el sitio dibuja la grilla
 * completa y necesita saber qué días hay turnos sin preguntarle a la API.
 */

/** Índice del día de la semana, 0 domingo a 6 sábado, como `Date#getUTCDay`. */
export const DOMINGO = 0;
export const SABADO = 6;

export type HorarioDelClub = {
  apertura: string;
  /** Cierre de lunes a viernes. */
  cierre: string;
  cierreSabado: string;
  /** Días en los que el club no abre, 0 domingo a 6 sábado. */
  diasCerrados: readonly number[];
};

/** La ventana de atención de un día, o `null` si ese día el club no abre. */
export type VentanaDelDia = { apertura: string; cierre: string } | null;

/**
 * El día de la semana de una fecha `YYYY-MM-DD`, interpretada como fecha local
 * del club. Se arma en UTC a propósito: la fecha ya viene resuelta en la zona
 * del club, así que meterla por el huso del servidor la correría un día.
 */
export function diaDeLaSemana(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

export function ventanaDelDia(fecha: string, horario: HorarioDelClub): VentanaDelDia {
  const dia = diaDeLaSemana(fecha);
  if (horario.diasCerrados.includes(dia)) return null;

  return {
    apertura: horario.apertura,
    cierre: dia === SABADO ? horario.cierreSabado : horario.cierre,
  };
}
