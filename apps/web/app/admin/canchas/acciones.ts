"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { ActualizarCanchaRequest, Cancha, CrearCanchaRequest } from "@/lib/api/types";
import { aNumeroArgentino, errorDePrecio, texto } from "@/lib/formularios";
import { leerToken } from "@/lib/sesion";

/*
 * Server Functions de `/admin/canchas` (RF-12). La autorización la hace la API
 * con el token: acá solo se arma el cuerpo y se traduce la respuesta. Ante un
 * error se devuelven los valores enviados, para que el formulario no pierda lo
 * cargado (spec: "Nombre repetido desde la pantalla").
 */

export type ValoresCancha = {
  disciplinaId: string;
  nombre: string;
  superficie: string;
  techada: boolean;
  precioPorTurno: string;
};

export type EstadoFormularioCancha = {
  error?: string;
  guardado?: string;
  valores?: ValoresCancha;
  /**
   * Cuenta los envíos. El formulario la usa como `key` para re-montarse: con
   * los valores enviados después de un error, y vacío después de un alta.
   * React 19 resetea el form al terminar la action, y sin re-montar, un
   * `<select>` volvía a su primera opción.
   */
  intentos: number;
};

export type EstadoBaja = { error?: string };

function leerValores(formData: FormData): ValoresCancha {
  return {
    disciplinaId: texto(formData, "disciplinaId"),
    nombre: texto(formData, "nombre"),
    superficie: texto(formData, "superficie"),
    techada: formData.get("techada") === "on",
    precioPorTurno: texto(formData, "precioPorTurno"),
  };
}

/** Lo que se puede contestar sin ir a la API. El resto, nombre repetido incluido, lo decide la API. */
function validar(valores: ValoresCancha, conDisciplina: boolean) {
  if (conDisciplina && !valores.disciplinaId) return "Elegí la disciplina.";
  if (!valores.nombre) return "Poné el nombre de la cancha.";
  return errorDePrecio(valores.precioPorTurno);
}

/** `titulo` es el texto apto para la persona; si no vino de la API, es un bug y se propaga. */
function mensajeDe(error: unknown): string {
  if (error instanceof ApiHttpError) return error.message;
  throw error;
}

function refrescar() {
  revalidatePath("/admin/canchas");
  // El catálogo público y la disponibilidad muestran las canchas activas.
  revalidatePath("/canchas");
  revalidatePath("/disponibilidad");
}

export async function crearCancha(
  anterior: EstadoFormularioCancha,
  formData: FormData,
): Promise<EstadoFormularioCancha> {
  const valores = leerValores(formData);
  const intentos = anterior.intentos + 1;

  const invalido = validar(valores, true);
  if (invalido) return { error: invalido, valores, intentos };

  const cuerpo: CrearCanchaRequest = {
    disciplinaId: Number(valores.disciplinaId),
    nombre: valores.nombre,
    techada: valores.techada,
    precioPorTurno: aNumeroArgentino(valores.precioPorTurno),
    ...(valores.superficie ? { superficie: valores.superficie } : {}),
  };

  let creada: Cancha;
  try {
    creada = await apiFetch<Cancha>("/canchas", {
      method: "POST",
      token: await leerToken(),
      timeoutMs: 2000,
      body: cuerpo,
    });
  } catch (error) {
    return { error: mensajeDe(error), valores, intentos };
  }

  refrescar();
  return { guardado: `Diste de alta ${creada.nombre}.`, intentos };
}

export async function actualizarCancha(
  anterior: EstadoFormularioCancha,
  formData: FormData,
): Promise<EstadoFormularioCancha> {
  const id = Number(formData.get("id"));
  const valores = leerValores(formData);
  const intentos = anterior.intentos + 1;

  const invalido = validar(valores, false);
  if (invalido) return { error: invalido, valores, intentos };

  const cuerpo: ActualizarCanchaRequest = {
    nombre: valores.nombre,
    // Vacía se manda como `null`: así se borra, según el contrato.
    superficie: valores.superficie || null,
    techada: valores.techada,
    precioPorTurno: aNumeroArgentino(valores.precioPorTurno),
  };

  try {
    await apiFetch<Cancha>(`/canchas/${id}`, {
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

/** Dar de baja o reactivar: `activa` en `false` no toca las reservas que ya tiene (RN-15). */
export async function cambiarEstadoCancha(
  _anterior: EstadoBaja,
  formData: FormData,
): Promise<EstadoBaja> {
  const id = Number(formData.get("id"));
  const activa = formData.get("activa") === "true";

  try {
    await apiFetch<Cancha>(`/canchas/${id}`, {
      method: "PATCH",
      token: await leerToken(),
      timeoutMs: 2000,
      body: { activa },
    });
  } catch (error) {
    return { error: mensajeDe(error) };
  }

  refrescar();
  return {};
}
