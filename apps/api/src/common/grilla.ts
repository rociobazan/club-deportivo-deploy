/** Un turno de la grilla, con horas locales del club en `HH:MM`. */
export type Bloque = { horaInicio: string; horaFin: string };

/**
 * Grilla de turnos anclada a la apertura (design archivado, decisión 6):
 * `apertura + k × duración` mientras el bloque termine a más tardar en el
 * cierre. Un bloque que no entra completo no se ofrece. Función pura: la usa
 * la disponibilidad y la replica el front para dibujar los bloques ocupados.
 */
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

/** `'19:30'` → 1170. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** 1170 → `'19:30'`. */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
