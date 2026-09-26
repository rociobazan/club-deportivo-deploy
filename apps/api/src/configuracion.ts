import type { JwtSignOptions } from '@nestjs/jwt';

/**
 * Configuración de la API, leída de las variables de entorno una sola vez al
 * arrancar. Si falta algo obligatorio, el arranque corta con un mensaje claro
 * en vez de fallar más tarde en el primer login (design.md, decisión 7).
 *
 * Se expone como provider (CONFIGURACION) y no como constante de módulo, para
 * que los tests puedan fijar las variables antes de crear la app.
 */
export const CONFIGURACION = Symbol('CONFIGURACION');

/** Prefijo de todas las rutas, como declara `servers` en el contrato. */
export const PREFIJO_API = 'api/v1';

/** Lo que acepta jsonwebtoken: segundos o una duración como `1h`, `30m`, `7d`. */
export type VigenciaJwt = NonNullable<JwtSignOptions['expiresIn']>;

export type Configuracion = {
  jwtSecret: string;
  jwtExpiresIn: VigenciaJwt;
  /** Único origen admitido por CORS. Fuera de producción tiene un valor por defecto. */
  frontendUrl: string;
};

const FRONTEND_URL_DESARROLLO = 'http://localhost:3001';

// La gramática de `ms`, que es la que usa jsonwebtoken para `expiresIn`.
const DURACION =
  /^\d+(\.\d+)?\s*(ms|msecs?|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?|y|yrs?|years?)?$/i;

function vigencia(valor: string): VigenciaJwt {
  if (!DURACION.test(valor)) {
    throw new Error(
      `JWT_EXPIRES_IN tiene un valor inválido ("${valor}"): usá segundos o una duración como 1h, 30m o 7d.`,
    );
  }
  // jsonwebtoken interpreta un string sin unidad en MILISEGUNDOS ("3600" = 3,6 s);
  // los dígitos sueltos se convierten a número, que sí son segundos.
  if (/^\d+$/.test(valor)) return Number(valor);
  // Validado recién arriba; jsonwebtoken lo vuelve a chequear al firmar.
  return valor as VigenciaJwt;
}

export function leerConfiguracion(
  entorno: NodeJS.ProcessEnv = process.env,
): Configuracion {
  const obligatoria = (nombre: string): string => {
    const valor = entorno[nombre]?.trim();
    if (!valor) {
      throw new Error(
        `Falta la variable de entorno ${nombre}. Copiá apps/api/.env.example a apps/api/.env y completala.`,
      );
    }
    return valor;
  };

  const enProduccion = entorno.NODE_ENV === 'production';

  return {
    jwtSecret: obligatoria('JWT_SECRET'),
    jwtExpiresIn: vigencia(obligatoria('JWT_EXPIRES_IN')),
    frontendUrl: enProduccion
      ? obligatoria('FRONTEND_URL')
      : entorno.FRONTEND_URL?.trim() || FRONTEND_URL_DESARROLLO,
  };
}

export const proveedorDeConfiguracion = {
  provide: CONFIGURACION,
  useFactory: (): Configuracion => leerConfiguracion(),
};
