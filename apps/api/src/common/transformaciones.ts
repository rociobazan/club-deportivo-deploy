/**
 * Transformaciones para query params, que llegan como texto. El ValidationPipe
 * global no convierte solo (design.md de disponibilidad, decisión 6): `true` y
 * `false` pasan a booleano y cualquier otra cosa queda para que `@IsBoolean()`
 * la rechace.
 */
export const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
