import type { Cancha, Disciplina, Equipamiento, Prisma } from '@prisma/client';

/*
 * Del registro de Prisma a la forma del contrato. `Prisma.Decimal` serializa
 * como string y el contrato promete `number`, así que el dinero se convierte
 * acá y en ningún otro lado (design.md, decisión 7). Reservas y administración
 * reutilizan estos mapeadores.
 */

export type DisciplinaPublica = {
  id: number;
  nombre: string;
  duracionTurnoMin: number;
  activa: boolean;
};

export type CanchaPublica = {
  id: number;
  nombre: string;
  disciplinaId: number;
  /** Nombre desnormalizado, como pide el contrato, para evitar una consulta extra. */
  disciplina: string;
  superficie?: string;
  techada: boolean;
  precioPorTurno: number;
  activa: boolean;
};

export type EquipamientoPublico = {
  id: number;
  nombre: string;
  disciplinaId: number;
  stockTotal: number;
  /** Solo cuando la consulta trajo `fecha` y `horaInicio`. */
  stockDisponible?: number;
  precioPorTurno: number;
  activo: boolean;
};

export const aNumero = (valor: Prisma.Decimal | number): number => Number(valor);

export function aDisciplina(d: Disciplina): DisciplinaPublica {
  return { id: d.id, nombre: d.nombre, duracionTurnoMin: d.duracionTurnoMin, activa: d.activa };
}

export function aCancha(c: Cancha & { disciplina: { nombre: string } }): CanchaPublica {
  return {
    id: c.id,
    nombre: c.nombre,
    disciplinaId: c.disciplinaId,
    disciplina: c.disciplina.nombre,
    // `undefined` no se serializa: una cancha sin superficie no lleva la clave.
    superficie: c.superficie ?? undefined,
    techada: c.techada,
    precioPorTurno: aNumero(c.precioPorTurno),
    activa: c.activa,
  };
}

export function aEquipamiento(e: Equipamiento, stockDisponible?: number): EquipamientoPublico {
  return {
    id: e.id,
    nombre: e.nombre,
    disciplinaId: e.disciplinaId,
    stockTotal: e.stockTotal,
    ...(stockDisponible === undefined ? {} : { stockDisponible }),
    precioPorTurno: aNumero(e.precioPorTurno),
    activo: e.activo,
  };
}
