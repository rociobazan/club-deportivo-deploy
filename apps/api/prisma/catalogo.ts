import type { Prisma } from '@prisma/client';

/**
 * Catálogo del club: datos del prototipo de Claude Design (design.md, decisión
 * 11), más el equipamiento que el club sumó después. Lo cargan el seed de
 * desarrollo (`seed.ts`) y la carga de producción (`carga-produccion.ts`).
 *
 * La carga es **idempotente y declarativa**: deja el catálogo igual a lo que
 * dice este archivo, se haya corrido antes o no. La clave para el `upsert` es
 * el nombre dentro de la disciplina, que es único desde la migración
 * `nombre_unico_por_disciplina`. Los ids no cambian, así que las reservas que
 * apunten a una cancha la siguen apuntando después de recargar.
 *
 * Lo que **no** toca: `activa`/`activo`, así que dar de baja una cancha desde
 * el panel sobrevive a una recarga.
 *
 * Y lo que **no resuelve**: como la clave es el nombre, un renombre no se
 * propaga. Si en una base ya cargada se cambia "Cancha 1" por "Polvo" acá, la
 * carga crea "Polvo" y deja "Cancha 1" donde estaba, porque no borra ni da de
 * baja lo que no conoce (a propósito: podría haber canchas dadas de alta desde
 * el panel, y una baja rompería las reservas que las apuntan). Para un renombre
 * hace falta un UPDATE a mano o recargar la base con `prisma migrate reset`.
 */

export const DISCIPLINAS = [
  { nombre: 'Tenis', duracionTurnoMin: 60 },
  { nombre: 'Pádel', duracionTurnoMin: 90 },
  { nombre: 'Fútbol 5', duracionTurnoMin: 60 },
] as const;

export const CANCHAS = [
  { disciplina: 'Tenis', nombre: 'Polvo', superficie: 'polvo de ladrillo', techada: false, precioPorTurno: 9000 },
  { disciplina: 'Tenis', nombre: 'Cemento', superficie: 'cemento', techada: false, precioPorTurno: 8000 },
  { disciplina: 'Pádel', nombre: 'Panorámica 1', superficie: 'sintético', techada: true, precioPorTurno: 14000 },
  { disciplina: 'Pádel', nombre: 'Panorámica 2', superficie: 'sintético', techada: true, precioPorTurno: 14000 },
  { disciplina: 'Pádel', nombre: 'Descubierta', superficie: 'sintético', techada: false, precioPorTurno: 12000 },
  { disciplina: 'Fútbol 5', nombre: 'Sintética', superficie: 'césped sintético', techada: false, precioPorTurno: 20000 },
] as const;

// "Tubo de pelotas" va separado por disciplina para respetar RN-08: cada
// equipamiento pertenece a una, así que lo que sirve para varias va repetido.
export const EQUIPAMIENTO = [
  { disciplina: 'Tenis', nombre: 'Raqueta de tenis', stockTotal: 4, precioPorTurno: 2500 },
  { disciplina: 'Tenis', nombre: 'Raqueta junior', stockTotal: 3, precioPorTurno: 2000 },
  { disciplina: 'Tenis', nombre: 'Tubo de pelotas de tenis', stockTotal: 5, precioPorTurno: 3500 },
  { disciplina: 'Pádel', nombre: 'Paleta de pádel', stockTotal: 6, precioPorTurno: 2500 },
  { disciplina: 'Pádel', nombre: 'Paleta junior', stockTotal: 3, precioPorTurno: 2000 },
  { disciplina: 'Pádel', nombre: 'Tubo de pelotas de pádel', stockTotal: 5, precioPorTurno: 3500 },
  { disciplina: 'Fútbol 5', nombre: 'Juego de pecheras', stockTotal: 3, precioPorTurno: 3000 },
  { disciplina: 'Fútbol 5', nombre: 'Pelota de fútbol 5', stockTotal: 4, precioPorTurno: 2000 },
  { disciplina: 'Fútbol 5', nombre: 'Guantes de arquero', stockTotal: 2, precioPorTurno: 2500 },
  { disciplina: 'Fútbol 5', nombre: 'Juego de conos', stockTotal: 2, precioPorTurno: 1500 },
] as const;

/** Se llama dentro de una transacción: un catálogo a medias mezclaría datos viejos y nuevos. */
export async function cargarCatalogo(tx: Prisma.TransactionClient): Promise<void> {
  const idDe = new Map<string, number>();
  for (const disciplina of DISCIPLINAS) {
    const fila = await tx.disciplina.upsert({
      where: { nombre: disciplina.nombre },
      update: { duracionTurnoMin: disciplina.duracionTurnoMin },
      create: disciplina,
    });
    idDe.set(disciplina.nombre, fila.id);
  }

  const disciplinaId = (nombre: string, de: string): number => {
    const id = idDe.get(nombre);
    if (id === undefined) {
      throw new Error(`"${de}" apunta a la disciplina "${nombre}", que no está en el catálogo.`);
    }
    return id;
  };

  for (const { disciplina, ...cancha } of CANCHAS) {
    const id = disciplinaId(disciplina, cancha.nombre);
    await tx.cancha.upsert({
      where: { disciplinaId_nombre: { disciplinaId: id, nombre: cancha.nombre } },
      update: cancha,
      create: { disciplinaId: id, ...cancha },
    });
  }

  for (const { disciplina, ...equipamiento } of EQUIPAMIENTO) {
    const id = disciplinaId(disciplina, equipamiento.nombre);
    await tx.equipamiento.upsert({
      where: { disciplinaId_nombre: { disciplinaId: id, nombre: equipamiento.nombre } },
      update: equipamiento,
      create: { disciplinaId: id, ...equipamiento },
    });
  }
}
