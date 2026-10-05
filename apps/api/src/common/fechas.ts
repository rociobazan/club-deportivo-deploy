/** `YYYY-MM-DD`, el formato de `reserva.fecha` y del parámetro `fecha` del contrato. */
export const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** `HH:MM` de 00:00 a 23:59, el patrón de `horaInicio` en el contrato. */
export const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Formato correcto y fecha que existe: `2026-02-30` no pasa. */
export function esFechaValida(valor: string): boolean {
  if (!FORMATO_FECHA.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

export function esHoraValida(valor: string): boolean {
  return FORMATO_HORA.test(valor);
}

/**
 * `reserva.fecha` es `@db.Date`: Prisma la lee y escribe como un `Date` a las
 * 00:00 UTC. Estas dos funciones son el único puente entre ese `Date` y el
 * `YYYY-MM-DD` del contrato, para que ninguna zona horaria se meta en el medio.
 */
export function aFechaDb(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function deFechaDb(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Negativo si `a` es anterior a `b`, 0 si son iguales, positivo si es posterior.
 * Con `YYYY-MM-DD` y `HH:MM`, comparar como texto es comparar en el tiempo.
 */
export function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * `fecha` más `dias`, en el calendario. Se hace en UTC por lo mismo que
 * `diaDeLaSemana`: la fecha ya viene resuelta en la zona del club, así que
 * pasarla por el huso del servidor la correría un día. Lo usa el horizonte de
 * reserva (RN-03).
 */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

/**
 * Minutos que van de `desde` a `hasta`, dos momentos en la hora local del club;
 * negativo si `hasta` es anterior. Se arman los dos en UTC a propósito: ya
 * vienen resueltos en la zona del club, y pasarlos por el huso del servidor
 * movería los dos igual, salvo en un cambio de horario. Lo usan el plazo de
 * cancelación (RN-04) y las cancelaciones "dentro del plazo" del panel.
 */
export function minutosEntre(
  desde: { fecha: string; hora: string },
  hasta: { fecha: string; hora: string },
): number {
  const comoInstante = ({ fecha, hora }: { fecha: string; hora: string }) =>
    new Date(`${fecha}T${hora}:00.000Z`).getTime();
  return Math.round((comoInstante(hasta) - comoInstante(desde)) / 60_000);
}

/**
 * Un plazo en minutos, como lo leería una persona: "2 horas", "1 hora" o
 * "90 minutos". Dividir por 60 a secas daba "1.5 horas" o "1 horas" apenas el
 * plazo no era un múltiplo de dos horas.
 */
export function duracionLegible(minutos: number): string {
  if (minutos % 60 === 0) {
    const horas = minutos / 60;
    return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }
  return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
}
