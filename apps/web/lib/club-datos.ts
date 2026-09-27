import {
  DIAS_CERRADOS,
  HORA_APERTURA,
  HORA_CIERRE,
  HORA_CIERRE_SABADO,
  SABADO,
} from "./club";

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

/** Cómo se nombra cada día, 0 domingo a 6 sábado. */
const PLURAL = ["Domingos", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados"];
const SINGULAR = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** El orden en que se lee una semana: de lunes a domingo. */
const SEMANA = [1, 2, 3, 4, 5, 6, 0];

function horarioDe(dia: number): string {
  if (DIAS_CERRADOS.includes(dia)) return "cerrado";
  const cierre = dia === SABADO ? HORA_CIERRE_SABADO : HORA_CIERRE;
  return `de ${horaLegible(HORA_APERTURA)} a ${horaLegible(cierre)}`;
}

/**
 * El horario en renglones, derivado de la configuración en lugar de escrito a
 * mano: si cambia una hora o un día cerrado, el pie y Contacto cambian con él.
 *
 * Agrupa días consecutivos con el mismo horario, así que "lunes a viernes de 8
 * a 23" sale solo y sigue siendo cierto si mañana se cierra un día de semana.
 */
export const HORARIO_LINEAS: readonly string[] = (() => {
  const lineas: string[] = [];
  let desde = 0;

  for (let i = 0; i < SEMANA.length; i++) {
    const actual = horarioDe(SEMANA[i]);
    const siguiente = i + 1 < SEMANA.length ? horarioDe(SEMANA[i + 1]) : null;
    if (actual === siguiente) continue;

    const nombre =
      desde === i
        ? PLURAL[SEMANA[i]]
        : `${PLURAL[SEMANA[desde]]} a ${SINGULAR[SEMANA[i]]}`;
    lineas.push(`${nombre} ${actual}`);
    desde = i + 1;
  }
  return lineas;
})();

/** La versión de un renglón, para donde no entran tres. */
export const HORARIO = HORARIO_LINEAS.join(" · ");
