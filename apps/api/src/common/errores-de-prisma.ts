import { Prisma } from '@prisma/client';

/*
 * Reconoce el choque contra una restricción única (`P2002`) por las columnas
 * que la forman. Lo usan los módulos donde la base es la que decide: RN-01 y el
 * código en `reservas`, y el nombre por disciplina en `catalogo`.
 *
 * Comprobado contra la base antes de escribir esto: Prisma **no** informa el
 * nombre del índice en `meta.target`, informa las columnas. Un choque con
 * `ux_reserva_slot_activo` llega como `["cancha_id", "fecha", "hora_inicio"]`,
 * uno con el único de `codigo` como `["codigo"]` y uno con el único por
 * disciplina de `cancha` o `equipamiento` como `["disciplina_id", "nombre"]`.
 * Por eso el discriminador es el conjunto de columnas. Si una versión de Prisma
 * cambiara esa forma, el que avisa es el e2e de cada caso.
 */
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
