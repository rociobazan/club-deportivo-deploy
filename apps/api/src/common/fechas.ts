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
 * Negativo si `a` es anterior a `b`, 0 si son iguales, positivo si es posterior.
 * Con `YYYY-MM-DD` y `HH:MM`, comparar como texto es comparar en el tiempo.
 */
export function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
