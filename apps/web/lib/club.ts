/**
 * Lo que el sitio necesita saber del club sin preguntarle a la API: la zona
 * horaria (para "hoy") y el horario de atención (para dibujar la grilla que la
 * API no devuelve). Mismos nombres y defaults que en `apps/api` (design.md,
 * decisión 9): si cambian, cambian en los dos `.env`.
 */
export const ZONA_HORARIA_CLUB =
  process.env.ZONA_HORARIA_CLUB?.trim() || "America/Argentina/Cordoba";
export const HORA_APERTURA = process.env.HORA_APERTURA?.trim() || "08:00";
export const HORA_CIERRE = process.env.HORA_CIERRE?.trim() || "23:00";

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

export const precioLegible = (monto: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(monto);
