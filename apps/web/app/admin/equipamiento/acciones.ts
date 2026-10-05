"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type {
  ActualizarEquipamientoRequest,
  CrearEquipamientoRequest,
  Equipamiento,
} from "@/lib/api/types";
import { aNumeroArgentino, texto } from "@/lib/formularios";
import { leerToken } from "@/lib/sesion";

/*
 * Server Functions de `/admin/equipamiento` (RF-13), con el mismo criterio que
 * las de canchas: la API decide, y ante un error se devuelven los valores
 * enviados para no perder lo cargado.
 */

export type ValoresEquipamiento = {
  disciplinaId: string;
  nombre: string;
  stockTotal: string;
  precioPorTurno: string;
};

export type EstadoFormularioEquipamiento = {
  error?: string;
  guardado?: string;
  valores?: ValoresEquipamiento;
  /** `key` del formulario: se re-monta en cada envío, como en canchas. */
  intentos: number;
};

export type EstadoBaja = { error?: string };

function leerValores(formData: FormData): ValoresEquipamiento {
  return {
    disciplinaId: texto(formData, "disciplinaId"),
    nombre: texto(formData, "nombre"),
    stockTotal: texto(formData, "stockTotal"),
    precioPorTurno: texto(formData, "precioPorTurno"),
  };
}

function validar(valores: ValoresEquipamiento, conDisciplina: boolean) {
  if (conDisciplina && !valores.disciplinaId) return "Elegí la disciplina.";
  if (!valores.nombre) return "Poné el nombre del ítem.";
  const stock = Number(valores.stockTotal);
  if (valores.stockTotal === "" || !Number.isInteger(stock) || stock < 0) {
    return "El stock tiene que ser un número entero, 0 o más.";
  }
  if (!(aNumeroArgentino(valores.precioPorTurno) > 0)) {
    return "El precio por turno tiene que ser mayor que 0.";
  }
  return null;
}

function mensajeDe(error: unknown): string {
  if (error instanceof ApiHttpError) return error.message;
  throw error;
}

function refrescar() {
  revalidatePath("/admin/equipamiento");
  // El catálogo público muestra el equipamiento activo con su stock.
  revalidatePath("/canchas");
}

export async function crearEquipamiento(
  anterior: EstadoFormularioEquipamiento,
  formData: FormData,
): Promise<EstadoFormularioEquipamiento> {
  const valores = leerValores(formData);
  const intentos = anterior.intentos + 1;

  const invalido = validar(valores, true);
  if (invalido) return { error: invalido, valores, intentos };

  const cuerpo: CrearEquipamientoRequest = {
    disciplinaId: Number(valores.disciplinaId),
    nombre: valores.nombre,
    stockTotal: Number(valores.stockTotal),
    precioPorTurno: aNumeroArgentino(valores.precioPorTurno),
  };

  let creado: Equipamiento;
  try {
    creado = await apiFetch<Equipamiento>("/equipamiento", {
      method: "POST",
      token: await leerToken(),
      timeoutMs: 2000,
      body: cuerpo,
    });
  } catch (error) {
    return { error: mensajeDe(error), valores, intentos };
  }

  refrescar();
  return { guardado: `Diste de alta ${creado.nombre}.`, intentos };
}

export async function actualizarEquipamiento(
  anterior: EstadoFormularioEquipamiento,
  formData: FormData,
): Promise<EstadoFormularioEquipamiento> {
  const id = Number(formData.get("id"));
  const valores = leerValores(formData);
  const intentos = anterior.intentos + 1;

  const invalido = validar(valores, false);
  if (invalido) return { error: invalido, valores, intentos };

  const cuerpo: ActualizarEquipamientoRequest = {
    nombre: valores.nombre,
    stockTotal: Number(valores.stockTotal),
    precioPorTurno: aNumeroArgentino(valores.precioPorTurno),
  };

  try {
    await apiFetch<Equipamiento>(`/equipamiento/${id}`, {
      method: "PATCH",
      token: await leerToken(),
      timeoutMs: 2000,
      body: cuerpo,
    });
  } catch (error) {
    return { error: mensajeDe(error), valores, intentos };
  }

  refrescar();
  return { guardado: "Guardamos los cambios.", valores, intentos };
}

/** Dar de baja o reactivar: las reservas que ya lo incluyen no cambian (RN-15). */
export async function cambiarEstadoEquipamiento(
  _anterior: EstadoBaja,
  formData: FormData,
): Promise<EstadoBaja> {
  const id = Number(formData.get("id"));
  const activo = formData.get("activo") === "true";

  try {
    await apiFetch<Equipamiento>(`/equipamiento/${id}`, {
      method: "PATCH",
      token: await leerToken(),
      timeoutMs: 2000,
      body: { activo },
    });
  } catch (error) {
    return { error: mensajeDe(error) };
  }

  refrescar();
  return {};
}
