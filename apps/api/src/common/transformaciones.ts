/**
 * Transformaciones para query params, que llegan como texto. El ValidationPipe
 * global no convierte solo (design.md de disponibilidad, decisión 6): `true` y
 * `false` pasan a booleano y cualquier otra cosa queda para que `@IsBoolean()`
 * la rechace.
 */
export const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/**
 * Recorta el texto **antes** de validar.
 *
 * Sin esto, `"   "` pasa `@IsNotEmpty()` y `@MinLength()` —son caracteres, al
 * fin y al cabo— y recién después el servicio lo recorta a cadena vacía. La
 * validación juzga un valor y la base guarda otro distinto, así que lo que el
 * DTO garantiza no vale para lo que termina persistido.
 *
 * Se aplica con `@Transform(recortar)` en cada campo de texto.
 */
export const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
