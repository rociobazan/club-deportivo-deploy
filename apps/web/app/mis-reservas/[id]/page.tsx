import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DetalleDeReserva } from "@/components/reservas/detalle-de-reserva";
import { EstadoError } from "@/components/ui/estado-error";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Reserva } from "@/lib/api/types";
import {
  ahoraEnElClub,
  CANCELACION_MINUTOS_MINIMOS,
  duracionLegible,
  minutosHastaElTurno,
} from "@/lib/club";
import { leerToken } from "@/lib/sesion";
import { AccionesDeReserva } from "./acciones-de-reserva";

export const metadata: Metadata = { title: "Detalle de tu reserva — Deploy" };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaDetalleReserva({ params }: Props) {
  const { id } = await params;
  const token = await leerToken();

  let reserva: Reserva;
  try {
    reserva = await apiFetch<Reserva>(`/reservas/${id}`, { token, timeoutMs: 2000 });
  } catch (error) {
    // Lo que no vino de la API es un bug y va al error boundary.
    if (!(error instanceof ApiHttpError)) throw error;
    if (error.estado === 404) notFound();

    /*
     * Una sesión vencida o inválida no es un problema pasajero: `proxy.ts` mira
     * si la cookie existe, no si el token sigue vivo, así que se llega hasta
     * acá y la API contesta 401. Ofrecer "reintentar" sería mandar a la persona
     * a un bucle que nunca va a funcionar; lo que necesita es volver a ingresar.
     */
    if (error.estado === 401 || error.estado === 403) {
      redirect(`/ingresar?volver=${encodeURIComponent(`/mis-reservas/${id}`)}`);
    }
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <EstadoError
          mensaje="No pudimos cargar esta reserva. Probá de nuevo en unos segundos."
          reintentarHref={`/mis-reservas/${id}`}
        />
      </main>
    );
  }

  const ahora = ahoraEnElClub();
  const puedeCancelar =
    reserva.estado === "CONFIRMADA" &&
    minutosHastaElTurno(reserva.fecha, reserva.horaInicio, ahora) >= CANCELACION_MINUTOS_MINIMOS;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/mis-reservas" className="text-sm text-text-muted hover:text-accent">
        ← Mis reservas
      </Link>

      <DetalleDeReserva reserva={reserva} />

      {reserva.estado === "CONFIRMADA" && !puedeCancelar ? (
        <p className="mt-4 text-sm text-text-muted">
          Esta reserva ya no se puede cancelar: faltan menos de{" "}
          {duracionLegible(CANCELACION_MINUTOS_MINIMOS)} para el turno.
        </p>
      ) : null}

      <AccionesDeReserva id={reserva.id} puedeCancelar={puedeCancelar} />
    </main>
  );
}
