import { registerDecorator, ValidationOptions } from 'class-validator';
import { esFechaValida, esHoraValida } from './fechas';

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
