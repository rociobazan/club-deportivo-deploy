import { randomInt } from 'node:crypto';

/*
 * Código legible para el cliente: `<prefijo>-XXXXXX` (spec de `reservas`). El
 * prefijo sale de la configuración y ya viene validado a 2-5 letras mayúsculas,
 * así que el código entra en el VarChar(12) de `reserva.codigo`.
 *
 * La unicidad no la garantiza esto: la garantiza la columna, que es `@unique`.
 * Acá solo hace falta que las colisiones sean raras; el servicio reintenta.
 */

/** Sin letras ni números ambiguos aparte: el código se dicta por teléfono. */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LARGO_SUFIJO = 6;

export function generarCodigo(prefijo: string): string {
  let sufijo = '';
  for (let i = 0; i < LARGO_SUFIJO; i += 1) {
    // randomInt y no Math.random: es un identificador que se comparte, no un
    // número cualquiera, y el costo de la fuente criptográfica es irrelevante.
    sufijo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return `${prefijo}-${sufijo}`;
}
