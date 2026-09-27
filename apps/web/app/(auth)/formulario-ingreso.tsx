"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { ingresar, type EstadoIngreso } from "./acciones";

// Cliente por `useActionState`: estado de envío y errores sin código de fetch.
export function FormularioIngreso({ volver }: { volver: string }) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(
    ingresar,
    {},
  );

  return (
    // `noValidate`: los mensajes los da el servidor, iguales en todos los navegadores.
    <form action={accion} noValidate className="flex w-full flex-col gap-4">
      <input type="hidden" name="volver" value={volver} />

      <div className="flex flex-col gap-3">
        {/*
          Las etiquetas quedan solo para lectores de pantalla porque el diseño
          usa placeholders. El `<label>` sigue asociado a cada control.
        */}
        <Campo id="email" label="Mail" ocultarEtiqueta>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Mail"
            required
            defaultValue={estado.valores?.email}
            aria-invalid={estado.error ? true : undefined}
          />
        </Campo>

        <Campo id="password" label="Contraseña" ocultarEtiqueta>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Contraseña"
            required
            aria-invalid={estado.error ? true : undefined}
          />
        </Campo>

        {estado.error ? (
          <p role="alert" className="text-sm text-danger">
            {estado.error}
          </p>
        ) : null}
      </div>

      <hr className="border-border-subtle" />

      <Button type="submit" disabled={enviando} className="w-full">
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
