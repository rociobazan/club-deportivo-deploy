import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { badgeDe } from "@/app/mis-reservas/badge-de-reserva";
import type { Reserva } from "@/lib/api/types";
import { fechaLegible, precioLegible } from "@/lib/club";

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-subtle pb-3 text-sm last:border-0 last:pb-0">
      <span className="text-text-subtle">{etiqueta}</span>
      <span className="text-right text-text">{valor}</span>
    </div>
  );
}

/**
 * El detalle de una reserva: título con el estado, y la tarjeta con el código,
 * el turno, el equipamiento y el total. Lo comparten "Mis reservas" y la
 * administración; esta última suma el titular, porque ve reservas de todos.
 */
export function DetalleDeReserva({
  reserva,
  conTitular = false,
}: {
  reserva: Reserva;
  conTitular?: boolean;
}) {
  const badge = badgeDe(reserva.estado);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{reserva.cancha}</h1>
        <Badge tone={badge.tone}>{badge.texto}</Badge>
      </div>

      <Card className="mt-6 flex flex-col gap-3">
        {conTitular && reserva.cliente ? <Fila etiqueta="Titular" valor={reserva.cliente} /> : null}
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
    </>
  );
}
