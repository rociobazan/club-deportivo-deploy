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
  /** Horario de atención, `HH:MM`. La grilla de turnos arranca en la apertura. */
  horaApertura: string;
  horaCierre: string;
  /** Zona IANA en la que se evalúan "hoy" y "ahora" (design archivado, decisión 5). */
  zonaHoraria: string;
};

const FRONTEND_URL_DESARROLLO = 'http://localhost:3001';
const HORA_APERTURA_POR_DEFECTO = '08:00';
const HORA_CIERRE_POR_DEFECTO = '23:00';
const ZONA_HORARIA_POR_DEFECTO = 'America/Argentina/Cordoba';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function hora(nombre: string, valor: string | undefined, porDefecto: string): string {
  const v = valor?.trim() || porDefecto;
  if (!HORA.test(v)) {
    throw new Error(`${nombre} tiene un valor inválido ("${v}"): usá el formato HH:MM, por ejemplo 08:00.`);
  }
  return v;
}

function zonaHoraria(valor: string | undefined): string {
  const v = valor?.trim() || ZONA_HORARIA_POR_DEFECTO;
  try {
    new Intl.DateTimeFormat('es-AR', { timeZone: v });
  } catch {
    throw new Error(
      `ZONA_HORARIA_CLUB tiene un valor inválido ("${v}"): usá un nombre IANA como America/Argentina/Cordoba.`,
    );
  }
  return v;
}

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

  const horaApertura = hora('HORA_APERTURA', entorno.HORA_APERTURA, HORA_APERTURA_POR_DEFECTO);
  const horaCierre = hora('HORA_CIERRE', entorno.HORA_CIERRE, HORA_CIERRE_POR_DEFECTO);
  if (horaApertura >= horaCierre) {
    throw new Error(
      `HORA_APERTURA (${horaApertura}) tiene que ser anterior a HORA_CIERRE (${horaCierre}).`,
    );
  }

  return {
    jwtSecret: obligatoria('JWT_SECRET'),
    jwtExpiresIn: vigencia(obligatoria('JWT_EXPIRES_IN')),
    frontendUrl: enProduccion
      ? obligatoria('FRONTEND_URL')
      : entorno.FRONTEND_URL?.trim() || FRONTEND_URL_DESARROLLO,
    horaApertura,
    horaCierre,
    zonaHoraria: zonaHoraria(entorno.ZONA_HORARIA_CLUB),
  };
}

export const proveedorDeConfiguracion = {
  provide: CONFIGURACION,
  useFactory: (): Configuracion => leerConfiguracion(),
};
