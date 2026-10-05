"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelarReserva,
  reenviarMail,
  type EstadoAccionReserva,
  type EstadoReenvio,
} from "../acciones";

/**
 * Dos formularios, dos `useActionState`: cancelar y reenviar son mutaciones
 * independientes, cada una con su propio estado de envío y su propio error.
 * Ninguna devuelve la reserva actualizada — `revalidatePath` (en `acciones.ts`)
 * ya deja esta página con datos frescos en la misma respuesta (design.md, 4).
 */
export function AccionesDeReserva({
  id,
  puedeCancelar,
  conMotivo = false,
}: {
  id: number;
  puedeCancelar: boolean;
  /** El detalle de administración deja escribir el motivo de la cancelación (RN-10). */
  conMotivo?: boolean;
}) {
  const [estadoCancelacion, accionCancelar, cancelando] = useActionState<
    EstadoAccionReserva,
    FormData
  >(cancelarReserva, {});
  const [estadoReenvio, accionReenviar, reenviando] = useActionState<EstadoReenvio, FormData>(
    reenviarMail,
    {},
  );

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {puedeCancelar ? (
        <form action={accionCancelar} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          {conMotivo ? (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Motivo (opcional)
              <Input name="motivo" maxLength={200} className="sm:w-72" />
            </label>
          ) : null}
          <Button
            type="submit"
            variant="secondary"
            disabled={cancelando}
            className="border-danger/45 text-danger hover:border-danger hover:text-danger"
          >
            {cancelando ? "Cancelando…" : "Cancelar esta reserva"}
          </Button>
        </form>
      ) : null}

      <form action={accionReenviar}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="secondary" disabled={reenviando}>
          {reenviando ? "Reenviando…" : "Reenviar el mail"}
        </Button>
      </form>

      {estadoCancelacion.error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {estadoCancelacion.error}
        </p>
      ) : null}
      {estadoReenvio.mensaje ? (
        <p role="status" className="w-full text-sm text-accent">
          {estadoReenvio.mensaje}
        </p>
      ) : null}
      {estadoReenvio.error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {estadoReenvio.error}
        </p>
      ) : null}
    </div>
  );
}
