import { Prisma } from '@prisma/client';

/*
 * `POST /reservas` puede chocar contra dos restricciones únicas distintas, y la
 * respuesta es opuesta en cada caso: el turno ocupado es un 409 para la persona
 * (RN-01), y el código repetido es un problema interno que se resuelve
 * reintentando. Confundirlos sería devolver "turno ocupado" cuando el turno
 * está libre.
 *
 * Comprobado contra la base antes de escribir esto: Prisma **no** informa el
 * nombre del índice en `meta.target`, informa las columnas. Un choque con
 * `ux_reserva_slot_activo` llega como `["cancha_id", "fecha", "hora_inicio"]` y
 * uno con el único de `codigo` como `["codigo"]`. Por eso el discriminador es
 * el conjunto de columnas. Si una versión de Prisma cambiara esa forma, el que
 * avisa es el e2e de dos solicitudes simultáneas.
 */

/** Columnas de `ux_reserva_slot_activo`, el índice único parcial de RN-01. */
export const COLUMNAS_SLOT_ACTIVO = ['cancha_id', 'fecha', 'hora_inicio'] as const;

/** Columna del único de `reserva.codigo`. */
export const COLUMNAS_CODIGO = ['codigo'] as const;

export function esViolacionDe(error: unknown, columnas: readonly string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;

  const objetivo = (error.meta as { target?: unknown } | undefined)?.target;
  // Se acepta el string suelto además del array: algunos motores informan una
  // sola columna sin envolverla.
  const informadas = typeof objetivo === 'string' ? [objetivo] : objetivo;
  if (!Array.isArray(informadas)) return false;

  return (
    informadas.length === columnas.length &&
    columnas.every((columna) => informadas.includes(columna))
  );
}
