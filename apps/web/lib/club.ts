/**
 * Lo que el sitio necesita saber del club sin preguntarle a la API: la zona
 * horaria (para "hoy") y el horario de atención (para dibujar la grilla que la
 * API no devuelve). Mismos nombres y defaults que en `apps/api` (design.md,
 * decisión 9): si cambian, cambian en los dos `.env`.
 */
export const ZONA_HORARIA_CLUB =
  process.env.ZONA_HORARIA_CLUB?.trim() || "America/Argentina/Cordoba";
export const HORA_APERTURA = process.env.HORA_APERTURA?.trim() || "08:00";
/** Cierre de lunes a viernes. */
export const HORA_CIERRE = process.env.HORA_CIERRE?.trim() || "23:00";
/** Los sábados el club cierra antes. */
export const HORA_CIERRE_SABADO = process.env.HORA_CIERRE_SABADO?.trim() || "18:00";

/**
 * Días en los que el club no abre, 0 domingo a 6 sábado. La API valida el
 * formato al arrancar (`apps/api/src/configuracion.ts`); acá alcanza con
 * descartar lo que no sea un día, porque las dos leen la misma variable.
 */
export const DIAS_CERRADOS: readonly number[] = (process.env.DIAS_CERRADOS ?? "0")
  .split(",")
  .map((parte) => Number(parte.trim()))
  .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

export const SABADO = 6;

/**
 * Anticipación mínima para cancelar una reserva (RN-04), mismo default que la
 * API.
 *
 * Si está definida pero mal, corta en vez de caer al default: el front decide
 * con este número si muestra el botón de cancelar, así que un valor ignorado en
 * silencio le esconde a la persona una acción que la API sí le permite, y le da
 * un motivo que no es cierto. La API corta el arranque por lo mismo
 * (`apps/api/src/configuracion.ts`); acá el criterio es el mismo.
 */
export const CANCELACION_MINUTOS_MINIMOS = (() => {
  const crudo = process.env.CANCELACION_MINUTOS_MINIMOS?.trim();
  if (!crudo) return 120;

  const minutos = Number(crudo);
  // Mismo criterio que `entero()` en apps/api/src/configuracion.ts: entero > 0.
  if (!Number.isInteger(minutos) || minutos <= 0) {
    throw new Error(
      `CANCELACION_MINUTOS_MINIMOS tiene un valor inválido ("${crudo}"): usá un entero mayor que 0, ` +
        "el mismo que en apps/api/.env.",
    );
  }
  return minutos;
})();

/** La ventana de atención de un día, o `null` si ese día el club no abre. */
export type VentanaDelDia = { apertura: string; cierre: string } | null;

/**
 * El día de la semana de una fecha `YYYY-MM-DD`, 0 domingo a 6 sábado. Se arma
 * en UTC a propósito: la fecha ya viene resuelta en la zona del club, así que
 * interpretarla por el huso del navegador o del servidor la correría un día.
 */
export function diaDeLaSemana(fecha: string): number {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

/**
 * Copia consciente de `apps/api/src/common/horario.ts`, por el mismo motivo que
 * `lib/grilla.ts`: el sitio dibuja la grilla completa y necesita saber qué días
 * hay turnos sin preguntarle a la API. La API es la fuente de verdad.
 */
export function ventanaDelDia(fecha: string): VentanaDelDia {
  const dia = diaDeLaSemana(fecha);
  if (DIAS_CERRADOS.includes(dia)) return null;

  return {
    apertura: HORA_APERTURA,
    cierre: dia === SABADO ? HORA_CIERRE_SABADO : HORA_CIERRE,
  };
}

export type Momento = { fecha: string; hora: string };

/** Falla al importar con un mensaje claro, igual que la API al arrancar, y no con un RangeError suelto. */
function crearFormato(): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_HORARIA_CLUB,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    throw new Error(
      `ZONA_HORARIA_CLUB tiene un valor inválido ("${ZONA_HORARIA_CLUB}") en apps/web/.env.local: usá un nombre IANA como America/Argentina/Cordoba.`,
    );
  }
}

const formato = crearFormato();

/** Fecha `YYYY-MM-DD` y hora `HH:MM` locales del club, como las calcula la API. */
export function ahoraEnElClub(instante: Date = new Date()): Momento {
  const partes: Record<string, string> = {};
  for (const parte of formato.formatToParts(instante)) {
    if (parte.type !== "literal") partes[parte.type] = parte.value;
  }
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

export const hoyEnElClub = () => ahoraEnElClub().fecha;

/** `YYYY-MM-DD` y que la fecha exista, igual que en la API. */
export function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** "2026-09-15" → "lunes 15 de septiembre", para títulos. */
export function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

/**
 * Minutos entre `ahora` y el inicio de un turno; negativo si ya empezó. Copia
 * consciente del cálculo de `apps/api/src/reservas/reservas.service.ts`, para
 * decidir en la pantalla si todavía se puede cancelar (RN-04) sin esperar la
 * respuesta de la API. La API es la fuente de verdad: esto es solo para no
 * mostrar un botón que sabemos que va a rechazar.
 */
export function minutosHastaElTurno(fecha: string, horaInicio: string, ahora: Momento): number {
  const comoInstante = (f: string, h: string) => new Date(`${f}T${h}:00.000Z`).getTime();
  return Math.round((comoInstante(fecha, horaInicio) - comoInstante(ahora.fecha, ahora.hora)) / 60_000);
}

export const precioLegible = (monto: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(monto);
