import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EstadoError } from "@/components/ui/estado-error";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Reserva } from "@/lib/api/types";
import {
  ahoraEnElClub,
  CANCELACION_MINUTOS_MINIMOS,
  duracionLegible,
  fechaLegible,
  minutosHastaElTurno,
  precioLegible,
} from "@/lib/club";
import { leerToken } from "@/lib/sesion";
import { badgeDe } from "../badge-de-reserva";
import { AccionesDeReserva } from "./acciones-de-reserva";

export const metadata: Metadata = { title: "Detalle de tu reserva — Deploy" };

type Props = { params: Promise<{ id: string }> };

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-subtle pb-3 text-sm last:border-0 last:pb-0">
      <span className="text-text-subtle">{etiqueta}</span>
      <span className="text-right text-text">{valor}</span>
    </div>
  );
}

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
  const badge = badgeDe(reserva.estado);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/mis-reservas" className="text-sm text-text-muted hover:text-accent">
        ← Mis reservas
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{reserva.cancha}</h1>
        <Badge tone={badge.tone}>{badge.texto}</Badge>
      </div>

      <Card className="mt-6 flex flex-col gap-3">
        <Fila etiqueta="Código" valor={reserva.codigo} />
        <Fila etiqueta="Día" valor={fechaLegible(reserva.fecha)} />
        <Fila etiqueta="Horario" valor={`${reserva.horaInicio} a ${reserva.horaFin}`} />
        {reserva.cantidadJugadores ? (
          <Fila etiqueta="Jugadores" valor={String(reserva.cantidadJugadores)} />
        ) : null}
        {reserva.equipamiento?.map((item) => (
          <Fila
            key={item.equipamientoId}
            etiqueta={`${item.nombre} × ${item.cantidad}`}
            valor={precioLegible(item.subtotal)}
          />
        ))}
        {reserva.motivoCancelacion ? (
          <Fila etiqueta="Motivo" valor={reserva.motivoCancelacion} />
        ) : null}

        <div className="mt-2 flex items-baseline justify-between border-t border-border-subtle pt-4">
          <span className="text-xs uppercase tracking-wide text-text-subtle">Total</span>
          <span className="font-display text-2xl font-semibold text-accent">
            {precioLegible(reserva.montoTotal)}
          </span>
        </div>
      </Card>

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
