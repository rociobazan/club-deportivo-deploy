"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

type EstadoBaja = { error?: string };

/**
 * "Dar de baja" o "Reactivar" una cancha o un ítem: un formulario de un solo
 * botón con su propia Server Function, que manda el estado contrario al actual.
 */
export function BotonDeBaja({
  id,
  activo,
  campo,
  nombre,
  accion,
}: {
  id: number;
  activo: boolean;
  /** `activa` en canchas, `activo` en equipamiento, como en el contrato. */
  campo: "activa" | "activo";
  /** Para el nombre accesible del botón: hay uno por fila. */
  nombre: string;
  accion: (anterior: EstadoBaja, formData: FormData) => Promise<EstadoBaja>;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoBaja, FormData>(accion, {});
  const etiqueta = activo ? "Dar de baja" : "Reactivar";

  return (
    <form action={enviar} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={campo} value={String(!activo)} />
      <Button
        type="submit"
        variant={activo ? "ghost" : "secondary"}
        disabled={enviando}
        aria-label={`${etiqueta} ${nombre}`}
      >
        {etiqueta}
      </Button>
      {estado.error ? (
        <p role="alert" className="text-sm text-danger">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
