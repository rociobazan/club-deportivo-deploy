import { HORA_APERTURA, HORA_CIERRE } from "./club";

/**
 * Los datos del club en un solo lugar: el pie, Contacto e Inicio los leen de
 * acá en vez de repetirlos (design.md, decisión 6). Son contenido, no
 * configuración: no cambian por entorno, a diferencia del horario y la zona,
 * que viven en `club.ts` porque la API los comparte.
 */
export const CLUB = {
  nombre: "Deploy Club",
  descripcion:
    "Club deportivo de barrio. Tenis, pádel y fútbol 5 en General Paz, Córdoba.",
  direccion: "Rivadeo 1480",
  barrio: "Barrio General Paz, Córdoba",
  telefono: "351 482 7719",
  /** Para el `href` del enlace: el mismo número en formato internacional. */
  telefonoLink: "tel:+543514827719",
  email: "hola@clubdeploy.com.ar",
  buffet: "Buffet hasta el último turno",
} as const;

/** "08:00" → "8"; "08:30" → "8:30". */
function horaLegible(hora: string): string {
  const [horas, minutos] = hora.split(":");
  return minutos === "00" ? String(Number(horas)) : `${Number(horas)}:${minutos}`;
}

/**
 * "Todos los días de 8 a 23", derivado del horario configurado en lugar de
 * escrito a mano: si cambia `HORA_CIERRE`, el pie y Contacto cambian con él.
 */
export const HORARIO = `Todos los días de ${horaLegible(HORA_APERTURA)} a ${horaLegible(HORA_CIERRE)}`;
