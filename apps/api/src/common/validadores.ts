import { registerDecorator, ValidationOptions } from 'class-validator';
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
