/**
 * Si un segmento de la URL puede ser un id de la base: un entero de 1 a
 * 2^31 − 1, lo que entra en una columna `Int`. Lo que no lo es no puede ser
 * un recurso existente, así que la página responde 404 sin preguntarle a la
 * API, y no un "Reintentar" que va a fallar siempre igual. Lo comparten los
 * detalles de reserva de "Mis reservas" y de la administración.
 */
const ID_MAXIMO = 2_147_483_647;

export function esIdDeBase(valor: string): boolean {
  return /^\d{1,10}$/.test(valor) && Number(valor) >= 1 && Number(valor) <= ID_MAXIMO;
}
