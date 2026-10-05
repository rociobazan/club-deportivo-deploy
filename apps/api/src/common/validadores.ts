import { IsNumber, IsPositive, Max, registerDecorator, ValidationOptions } from 'class-validator';
import { esFechaValida, esHoraValida } from './fechas';

/**
 * El mayor valor de una columna `Int` de PostgreSQL (32 bits). Un id o una
 * cantidad más grande pasaba `@IsInt()` y la base lo rechazaba con un error
 * que salía como 500. Va como `@Max()` en cada entero que llega a una consulta.
 */
export const ENTERO_MAXIMO_DB = 2_147_483_647;

/** `YYYY-MM-DD` y que la fecha exista. Para query y body: reservas (1.3) lo reutiliza. */
export function EsFecha(opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) => {
    registerDecorator({
      name: 'esFecha',
      target: objeto.constructor,
      propertyName: propiedad,
      options: { message: `${propiedad} tiene que ser una fecha válida con formato YYYY-MM-DD`, ...opciones },
      validator: { validate: (valor: unknown) => typeof valor === 'string' && esFechaValida(valor) },
    });
  };
}

/** `HH:MM`, el patrón de `horaInicio` del contrato. */
export function EsHora(opciones?: ValidationOptions) {
  return (objeto: object, propiedad: string) => {
    registerDecorator({
      name: 'esHora',
      target: objeto.constructor,
      propertyName: propiedad,
      options: { message: `${propiedad} tiene que ser una hora con formato HH:MM`, ...opciones },
      validator: { validate: (valor: unknown) => typeof valor === 'string' && esHoraValida(valor) },
    });
  };
}

/** El mayor valor de una columna `Decimal(10,2)`: ocho enteros y dos decimales. */
export const PRECIO_MAXIMO_DB = 99_999_999.99;

/**
 * Un precio del contrato: número mayor que 0, con hasta dos decimales y que
 * entre en `Decimal(10,2)`. Uno más grande pasaba `@IsNumber()` y la base lo
 * rechazaba con un 500, igual que los enteros de `ENTERO_MAXIMO_DB`; uno con
 * más decimales se habría redondeado en silencio al guardarlo.
 */
export function EsPrecio() {
  return (objeto: object, propiedad: string) => {
    IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })(objeto, propiedad);
    IsPositive()(objeto, propiedad);
    Max(PRECIO_MAXIMO_DB)(objeto, propiedad);
  };
}

/**
 * Para `@ValidateIf(enviado)`: solo `undefined` significa "no vino". A
 * diferencia de `@IsOptional()`, que también deja pasar `null` sin validar, un
 * `null` se valida y da 400 en vez de llegar a la base como un 500 (decisión 33).
 */
export const enviado = (_objeto: object, valor: unknown) => valor !== undefined;
