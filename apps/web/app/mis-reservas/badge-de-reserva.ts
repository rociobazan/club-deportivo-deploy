import type { Reserva } from "@/lib/api/types";

/**
 * Módulo sin `"use client"`: lo importan tanto el listado (Client Component,
 * por las pestañas) como el detalle (Server Component). Una función exportada
 * desde un módulo cliente no se puede llamar desde el servidor.
 */
export function badgeDe(estado: Reserva["estado"]) {
  if (estado === "CONFIRMADA") return { tone: "accent" as const, texto: "Confirmada" };
  if (estado === "CANCELADA") return { tone: "danger" as const, texto: "Cancelada" };
  return { tone: "neutral" as const, texto: "Completada" };
}
