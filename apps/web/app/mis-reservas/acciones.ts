"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { ReenvioMailResponse } from "@/lib/api/types";
import { texto } from "@/lib/formularios";
import { leerToken } from "@/lib/sesion";

/**
 * Server Functions de "Mis reservas" (design.md, decisión 4). No devuelven la
 * reserva actualizada: `revalidatePath` hace que Next vuelva a renderizar la
 * página con datos frescos de la API en la misma respuesta, así que el
 * detalle no necesita duplicar ese estado del lado del cliente.
 */

export type EstadoAccionReserva = { error?: string };

export async function cancelarReserva(
  _anterior: EstadoAccionReserva,
  formData: FormData,
): Promise<EstadoAccionReserva> {
  const id = Number(formData.get("id"));
  // Solo el detalle de administración pide el motivo; en "Mis reservas" no viene.
  const motivo = texto(formData, "motivo");
  const token = await leerToken();

  try {
    await apiFetch(`/reservas/${id}/cancelacion`, {
      method: "PATCH",
      token,
      timeoutMs: 2000,
      ...(motivo ? { body: { motivo } } : {}),
    });
  } catch (error) {
    if (!(error instanceof ApiHttpError)) throw error;
    return { error: error.message };
  }

  // La misma acción la usan el titular y el ADMIN: se refrescan las dos vistas.
  revalidatePath(`/mis-reservas/${id}`);
  revalidatePath("/mis-reservas");
  revalidatePath(`/admin/reservas/${id}`);
  revalidatePath("/admin/reservas");
  return {};
}

export type EstadoReenvio = EstadoAccionReserva & { mensaje?: string };

export async function reenviarMail(
  _anterior: EstadoReenvio,
  formData: FormData,
): Promise<EstadoReenvio> {
  const id = Number(formData.get("id"));
  const token = await leerToken();

  let respuesta: ReenvioMailResponse;
  try {
    respuesta = await apiFetch<ReenvioMailResponse>(`/reservas/${id}/reenvio-mail`, {
      method: "POST",
      token,
      timeoutMs: 2000,
    });
  } catch (error) {
    if (!(error instanceof ApiHttpError)) throw error;
    return { error: error.message };
  }

  return { mensaje: respuesta.mensaje };
}
