"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ingresar, type EstadoIngreso } from "./acciones";
import { Campo } from "./campo";

// Cliente por `useActionState`: estado de envío y errores sin código de fetch.
export function FormularioIngreso({ volver }: { volver: string }) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(
    ingresar,
    {},
  );

  return (
    // `noValidate`: los mensajes los da el servidor, iguales en todos los navegadores.
    <form action={accion} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="volver" value={volver} />

      <Campo id="email" label="Mail">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.valores?.email}
          aria-invalid={estado.error ? true : undefined}
        />
      </Campo>

      <Campo id="password" label="Contraseña">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={estado.error ? true : undefined}
        />
      </Campo>

      {estado.error ? (
        <p role="alert" className="text-sm text-danger">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="mt-2">
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
