/**
 * Copia consciente de `apps/api/src/common/grilla.ts` (design.md, decisión 2):
 * el contrato devuelve solo los turnos libres, y el sitio necesita la grilla
 * completa para dibujar los ocupados y los pasados. La API es la fuente de
 * verdad; si divergen, el síntoma es un bloque "Libre" que no se puede reservar.
 */
export type Bloque = { horaInicio: string; horaFin: string };

export function generarGrilla(
  apertura: string,
  cierre: string,
  duracionMin: number,
): Bloque[] {
  if (!Number.isInteger(duracionMin) || duracionMin <= 0) {
    throw new Error(`La duración del turno tiene que ser un entero positivo, no ${duracionMin}.`);
  }

  const inicio = aMinutos(apertura);
  const fin = aMinutos(cierre);
  const bloques: Bloque[] = [];

  for (let t = inicio; t + duracionMin <= fin; t += duracionMin) {
    bloques.push({ horaInicio: aHora(t), horaFin: aHora(t + duracionMin) });
  }
  return bloques;
}

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type EstadoDeBloque = "libre" | "ocupada" | "pasado";

/**
 * Lo que la API devolvió es libre; si es hoy y ya empezó, es pasado; el resto
 * está ocupado (spec: "Pantalla de disponibilidad").
 */
export function estadoDeBloque(
  bloque: Bloque,
  libres: ReadonlySet<string>,
  esHoy: boolean,
  horaAhora: string,
): EstadoDeBloque {
  if (libres.has(bloque.horaInicio)) return "libre";
  if (esHoy && bloque.horaInicio < horaAhora) return "pasado";
  return "ocupada";
}
