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
  /** Cierre de lunes a viernes. */
  horaCierre: string;
  /** Los sábados el club cierra antes. */
  horaCierreSabado: string;
  /** Días en los que no abre, 0 domingo a 6 sábado. */
  diasCerrados: readonly number[];
  /** Zona IANA en la que se evalúan "hoy" y "ahora" (design archivado, decisión 5). */
  zonaHoraria: string;
  /** Remitente de todos los mails que manda el sistema. */
  mailFrom: string;
  /** Casilla del club que recibe los mensajes del formulario de contacto. */
  mailContacto: string;
  /** Días hacia adelante que se pueden reservar, contando hoy (RN-03). El límite es inclusivo. */
  horizonteReservaDias: number;
  /** Reservas activas que puede tener un SOCIO al mismo tiempo (RN-07). No aplica a ADMIN. */
  maxReservasActivasSocio: number;
  /** Prefijo del código de reserva: `<prefijo>-XXXXXX`. Máximo 5 letras, porque la columna es VarChar(12). */
  prefijoCodigoReserva: string;
  /**
   * Anticipación mínima con la que un SOCIO puede cancelar (RN-04). La lee el
   * ítem 1.4, que implementa la cancelación; acá se valida y se expone para que
   * no tenga que volver a tocar este archivo.
   */
  cancelacionMinutosMinimos: number;
  /**
   * Clave de Resend. Sin ella el cliente de mail es un doble, así cualquiera
   * puede levantar la API sin pedir una clave (design.md, decisión 1). En
   * producción es obligatoria.
   */
  resendApiKey?: string;
};

const FRONTEND_URL_DESARROLLO = 'http://localhost:3001';
const HORA_APERTURA_POR_DEFECTO = '08:00';
const HORA_CIERRE_POR_DEFECTO = '23:00';
const HORA_CIERRE_SABADO_POR_DEFECTO = '18:00';
const DIAS_CERRADOS_POR_DEFECTO = '0';
const ZONA_HORARIA_POR_DEFECTO = 'America/Argentina/Cordoba';
const MAIL_FROM_POR_DEFECTO = 'turnos@clubdeploy.com.ar';
const MAIL_CONTACTO_POR_DEFECTO = 'hola@clubdeploy.com.ar';
const HORIZONTE_RESERVA_DIAS_POR_DEFECTO = 30;
const MAX_RESERVAS_ACTIVAS_SOCIO_POR_DEFECTO = 3;
const PREFIJO_CODIGO_RESERVA_POR_DEFECTO = 'RES';
const CANCELACION_MINUTOS_MINIMOS_POR_DEFECTO = 120;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function hora(nombre: string, valor: string | undefined, porDefecto: string): string {
  const v = valor?.trim() || porDefecto;
  if (!HORA.test(v)) {
    throw new Error(`${nombre} tiene un valor inválido ("${v}"): usá el formato HH:MM, por ejemplo 08:00.`);
  }
  return v;
}

/**
 * "0" o "0,6": los días en los que el club no abre, 0 domingo a 6 sábado. Vacío
 * significa que abre todos los días, y por eso se distingue de no definirla.
 */
function diasCerrados(valor: string | undefined): number[] {
  const v = valor?.trim() ?? DIAS_CERRADOS_POR_DEFECTO;
  if (v === '') return [];

  const dias = v.split(',').map((parte) => {
    const n = Number(parte.trim());
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      throw new Error(
        `DIAS_CERRADOS tiene un valor inválido ("${v}"): usá números de 0 (domingo) a 6 (sábado) separados por coma, por ejemplo 0.`,
      );
    }
    return n;
  });

  if (new Set(dias).size === 7) {
    throw new Error('DIAS_CERRADOS no puede incluir los siete días: el club no abriría nunca.');
  }
  return [...new Set(dias)].sort((a, b) => a - b);
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

// Alcanza para atajar una dirección mal tipeada al arrancar; la validación fina
// la hace el proveedor de mail cuando envía.
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mail(nombre: string, valor: string | undefined, porDefecto: string): string {
  const v = valor?.trim() || porDefecto;
  if (!MAIL.test(v)) {
    throw new Error(
      `${nombre} tiene un valor inválido ("${v}"): tiene que ser una dirección de mail, por ejemplo ${porDefecto}.`,
    );
  }
  return v;
}

function entero(
  nombre: string,
  valor: string | undefined,
  porDefecto: number,
  minimo: number,
): number {
  const v = valor?.trim();
  if (!v) return porDefecto;

  // Number('') es 0 y Number('3.5') es 3.5: los dos tienen que cortar, así que
  // se valida el texto además del resultado.
  const n = Number(v);
  if (!/^-?\d+$/.test(v) || !Number.isInteger(n) || n < minimo) {
    throw new Error(
      `${nombre} tiene un valor inválido ("${v}"): usá un número entero mayor o igual a ${minimo}, por ejemplo ${porDefecto}.`,
    );
  }
  return n;
}

// Mayúsculas y hasta 5 letras: con el guion y los 6 caracteres del sufijo, el
// código entra en el VarChar(12) de `reserva.codigo`.
const PREFIJO_CODIGO = /^[A-Z]{2,5}$/;

function prefijoCodigo(valor: string | undefined): string {
  const v = valor?.trim() || PREFIJO_CODIGO_RESERVA_POR_DEFECTO;
  if (!PREFIJO_CODIGO.test(v)) {
    throw new Error(
      `PREFIJO_CODIGO_RESERVA tiene un valor inválido ("${v}"): usá de 2 a 5 letras mayúsculas, por ejemplo ${PREFIJO_CODIGO_RESERVA_POR_DEFECTO}.`,
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

  const horaCierreSabado = hora(
    'HORA_CIERRE_SABADO',
    entorno.HORA_CIERRE_SABADO,
    HORA_CIERRE_SABADO_POR_DEFECTO,
  );
  if (horaApertura >= horaCierreSabado) {
    throw new Error(
      `HORA_APERTURA (${horaApertura}) tiene que ser anterior a HORA_CIERRE_SABADO (${horaCierreSabado}).`,
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
    horaCierreSabado,
    diasCerrados: diasCerrados(entorno.DIAS_CERRADOS),
    zonaHoraria: zonaHoraria(entorno.ZONA_HORARIA_CLUB),
    mailFrom: mail('MAIL_FROM', entorno.MAIL_FROM, MAIL_FROM_POR_DEFECTO),
    mailContacto: mail('MAIL_CONTACTO', entorno.MAIL_CONTACTO, MAIL_CONTACTO_POR_DEFECTO),
    horizonteReservaDias: entero(
      'HORIZONTE_RESERVA_DIAS',
      entorno.HORIZONTE_RESERVA_DIAS,
      HORIZONTE_RESERVA_DIAS_POR_DEFECTO,
      1,
    ),
    maxReservasActivasSocio: entero(
      'MAX_RESERVAS_ACTIVAS_SOCIO',
      entorno.MAX_RESERVAS_ACTIVAS_SOCIO,
      MAX_RESERVAS_ACTIVAS_SOCIO_POR_DEFECTO,
      1,
    ),
    prefijoCodigoReserva: prefijoCodigo(entorno.PREFIJO_CODIGO_RESERVA),
    cancelacionMinutosMinimos: entero(
      'CANCELACION_MINUTOS_MINIMOS',
      entorno.CANCELACION_MINUTOS_MINIMOS,
      CANCELACION_MINUTOS_MINIMOS_POR_DEFECTO,
      0,
    ),
    resendApiKey: enProduccion
      ? obligatoria('RESEND_API_KEY')
      : entorno.RESEND_API_KEY?.trim() || undefined,
  };
}

export const proveedorDeConfiguracion = {
  provide: CONFIGURACION,
  useFactory: (): Configuracion => leerConfiguracion(),
};
